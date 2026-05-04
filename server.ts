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
import { loadRuntimeConfig } from "./services/runtimeConfig";
import { hasLocalFmBinary, probeSystemStatus } from "./services/raspberryPi";

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const runtimeConfig = loadRuntimeConfig();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function parseFrequency(value: unknown, fallback?: string): string | null {
  const frequency = Number(value ?? fallback);

  if (!Number.isFinite(frequency) || frequency < 76 || frequency > 108) {
    return null;
  }

  return frequency.toFixed(1);
}

function parseText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const ghostSummonLimiter = createRateLimit({
  windowMs: 60_000,
  limit: runtimeConfig.rateLimits.ghostSummonPerMinute,
  standardHeaders: true,
  legacyHeaders: false
});

const systemStatusLimiter = createRateLimit({
  windowMs: 60_000,
  limit: runtimeConfig.rateLimits.systemStatusPerMinute,
  standardHeaders: true,
  legacyHeaders: false
});

const productionStaticLimiter = createRateLimit({
  windowMs: 60_000,
  limit: runtimeConfig.rateLimits.productionStaticPerMinute,
  standardHeaders: true,
  legacyHeaders: false
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // WebSocket Server attached to the same HTTP server
  const wss = new WebSocketServer({ server });

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: runtimeConfig.jsonLimit }));

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
      appUrl: runtimeConfig.appUrl,
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
      const safePrompt = parseText(prompt || mood || "dark techno", 500);
      const safeBpm = Number.isFinite(Number(bpm)) ? String(Math.max(40, Math.min(240, Number(bpm)))) : "135";
      const { stdout, stderr } = await execFileAsync("python3", [path.join(__dirname, "scripts/local_ghost.py"), safePrompt, safeBpm]);
      
      if (stderr && !stdout) {
        console.error("[GHOST] Script Error:", stderr);
        throw new Error(stderr);
      }
      
      const pattern = JSON.parse(stdout.trim());
      res.json({ success: true, pattern });
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      console.error("[GHOST] Error:", message);
      res.status(500).json({ 
        success: false, 
        error: "GHOST_SUMMON_FAILED",
        details: message
      });
    }
  });

  // FM RDS Control
  app.post("/api/radio/rds", async (req, res) => {
    const { text, freq } = req.body;
    console.log(`[RADIO] Updating RDS: "${text}" on ${freq}MHz`);
    
    try {
      const rdsText = parseText(text, 64);
      const frequency = parseFrequency(freq);

      if (!rdsText || !frequency) {
        res.status(400).json({ success: false, error: "INVALID_RDS_REQUEST" });
        return;
      }

      if (!(await hasLocalFmBinary(__dirname))) {
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
        frequency: Number(frequency),
        timestamp: new Date().toISOString()
      });
    } catch (e: unknown) {
      res.status(500).json({ success: false, error: getErrorMessage(e) });
    }
  });

  // System Status (Component Availability)
  app.get("/api/system/status", systemStatusLimiter, async (req, res) => {
    try {
      res.json(await probeSystemStatus({
        appRoot: __dirname,
        ollamaTagsUrl: runtimeConfig.ollamaTagsUrl,
        minimaStatusUrl: runtimeConfig.minimaStatusUrl
      }));
    } catch (e) {
      console.error("[SYSTEM] Status probe failed:", getErrorMessage(e));
      res.status(500).json({ error: "SYSTEM_STATUS_UNAVAILABLE" });
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
        const parsed = JSON.parse(data.toString());
        if (!isRecord(parsed) || typeof parsed.type !== "string") {
          ws.send(JSON.stringify({ type: "ERROR", error: "INVALID_MESSAGE" }));
          return;
        }

        const message = parsed;

        if (message.type === "JOIN_FREQ") {
          const nextFrequency = parseFrequency(message.frequency, currentFreq);
          if (!nextFrequency) {
            ws.send(JSON.stringify({ type: "ERROR", error: "INVALID_FREQUENCY" }));
            return;
          }

          if (frequencies.has(currentFreq)) {
            frequencies.get(currentFreq)?.delete(ws);
          }
          
          currentFreq = nextFrequency;
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
              from: parseText(message.nodeId, 64),
              payload: parseText(message.payload, 2048),
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
                  payload: parseText(message.payload, 4096),
                  nodeId: parseText(message.nodeId, 64)
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
    app.use(productionStaticLimiter);
    app.use(express.static(path.join(__dirname, "dist")));
    app.use((req, res, next) => {
      if (
        (req.method !== "GET" && req.method !== "HEAD") ||
        req.path.startsWith("/api/") ||
        path.extname(req.path)
      ) {
        next();
        return;
      }

      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(runtimeConfig.port, runtimeConfig.host, () => {
    console.log(`
██████╗ ██╗  ██╗ █████╗ ███╗   ██╗████████╗ ██████╗ ███╗   ███╗
██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔═══██╗████╗ ████║
██████╔╝███████║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
                                                               
PHANTOM CORE SERVER ACTIVE AT http://${runtimeConfig.host === "0.0.0.0" ? "localhost" : runtimeConfig.host}:${runtimeConfig.port}
NODE_ENV: ${process.env.NODE_ENV || 'development'}
    `);
  });
}

startServer();
