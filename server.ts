import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import createRateLimit from "express-rate-limit";
import * as dotenv from "dotenv";
import { execFile } from "child_process";
import { promisify } from "util";
import { access, readFile } from "fs/promises";

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const PI_FM_RDS_PATH = path.join(__dirname, "pi_fm_rds");

async function commandExists(command: string) {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function hasLocalFmBinary() {
  try {
    await access(PI_FM_RDS_PATH);
    return true;
  } catch {
    return commandExists("pi_fm_rds");
  }
}

async function readPiCpuTemperature() {
  try {
    const raw = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf8");
    const temp = Number.parseInt(raw, 10) / 1000;
    return Number.isFinite(temp) ? temp : null;
  } catch {
    return null;
  }
}

async function isHttpOk(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
  return !!response?.ok;
}

const ghostSummonLimiter = createRateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const systemStatusLimiter = createRateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const spaFallbackLimiter = createRateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // WebSocket Server attached to the same HTTP server
  const wss = new WebSocketServer({ server });

  const PORT = Number.parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "0.0.0.0";

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request Logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // --- API ENDPOINTS ---

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      version: "1.2.0-PHANTOM",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Ghost AI Summoning (Local Ollama)
  app.post("/api/ghost/summon", ghostSummonLimiter, async (req, res) => {
    const { prompt, mood, bpm } = req.body;
    console.log(`[GHOST] Summoning pattern for: "${prompt || mood}" at ${bpm} BPM`);
    
    try {
      // Call the local_ghost.py script
      // We use python3 to ensure we use the correct environment on Pi
      const safePrompt = String(prompt || mood || 'dark techno').slice(0, 500);
      const { stdout, stderr } = await execFileAsync("python3", [path.join(__dirname, "scripts/local_ghost.py"), safePrompt]);
      
      if (stderr && !stdout) {
        console.error("[GHOST] Script Error:", stderr);
        throw new Error(stderr);
      }
      
      const pattern = JSON.parse(stdout);
      res.json({ success: true, pattern });
    } catch (e: any) {
      console.error("[GHOST] Error:", e.message);
      res.status(500).json({ 
        success: false, 
        error: "GHOST_SUMMON_FAILED",
        details: e.message 
      });
    }
  });

  // FM RDS Control
  app.post("/api/radio/rds", async (req, res) => {
    const { text, freq } = req.body;
    console.log(`[RADIO] Updating RDS: "${text}" on ${freq}MHz`);
    
    try {
      const rdsText = String(text || "").trim();
      const frequency = Number(freq);

      if (!rdsText || rdsText.length > 64 || !Number.isFinite(frequency) || frequency < 76 || frequency > 108) {
        res.status(400).json({ success: false, error: "INVALID_RDS_REQUEST" });
        return;
      }

      if (!(await hasLocalFmBinary())) {
        res.status(503).json({
          success: false,
          error: "FM_TRANSMITTER_UNAVAILABLE",
          details: "pi_fm_rds is required on PiNet_Os hardware for RDS broadcast control."
        });
        return;
      }

      res.json({ 
        success: true, 
        message: `RDS_RADIOTEXT_READY: ${rdsText}`,
        frequency,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // System Status (Component Availability)
  app.get("/api/system/status", systemStatusLimiter, async (req, res) => {
    const status: any = {
      ollama: false,
      hailo: false,
      minima: false,
      radio: false,
      kernel: "OK",
      cpu_temp: null
    };

    try {
      // 1. Check Ollama (Local LLM)
      status.ollama = await isHttpOk("http://localhost:11434/api/tags");

      // 2. Check Minima (Blockchain Node)
      status.minima = await isHttpOk("http://localhost:9001/status");

      // 3. Check Hailo NPU (AI Accelerator)
      try {
        const { stdout } = await execFileAsync("hailortcli", ["scan"]);
        status.hailo = stdout.includes("Device");
      } catch(e) {
        status.hailo = false;
      }

      // 4. Get CPU Temp (Pi Specific)
      status.cpu_temp = await readPiCpuTemperature();
      status.radio = await hasLocalFmBinary();

      res.json(status);
    } catch (e) {
      res.json(status);
    }
  });

  // Radio Relay Logic
  const frequencies = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] New connection from ${ip}`);
    
    let currentFreq = "101.1";

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "JOIN_FREQ") {
          if (frequencies.has(currentFreq)) {
            frequencies.get(currentFreq)?.delete(ws);
          }
          
          currentFreq = message.frequency;
          if (!frequencies.has(currentFreq)) {
            frequencies.set(currentFreq, new Set());
          }
          frequencies.get(currentFreq)?.add(ws);
          
          ws.send(JSON.stringify({ type: "FREQ_JOINED", frequency: currentFreq }));
          console.log(`[WS] Node joined frequency: ${currentFreq}`);
        }

        if (message.type === "RADIO_TRANSMISSION") {
          const peers = frequencies.get(currentFreq);
          if (peers) {
            const payload = JSON.stringify({
              type: "RADIO_RECEPTION",
              from: message.nodeId,
              payload: message.payload,
              timestamp: Date.now()
            });
            
            peers.forEach((peer) => {
              if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                peer.send(payload);
              }
            });
          }
        }

        if (message.type === "LORA_VOICE") {
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "LORA_VOICE_RECEPTION",
                payload: message.payload,
                nodeId: message.nodeId
              }));
            }
          });
        }
      } catch (e) {
        console.error("[WS] Message Error:", e);
      }
    });

    ws.on("close", () => {
      console.log(`[WS] Connection closed from ${ip}`);
      if (frequencies.has(currentFreq)) {
        frequencies.get(currentFreq)?.delete(ws);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.use(spaFallbackLimiter, (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }

      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`
██████╗ ██╗  ██╗ █████╗ ███╗   ██╗████████╗ ██████╗ ███╗   ███╗
██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔═══██╗████╗ ████║
██████╔╝███████║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
                                                               
PHANTOM CORE SERVER ACTIVE AT http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}
NODE_ENV: ${process.env.NODE_ENV || 'development'}
    `);
  });
}

startServer();
