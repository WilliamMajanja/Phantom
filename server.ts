import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // WebSocket Server attached to the same HTTP server
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

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
  app.post("/api/ghost/summon", async (req, res) => {
    const { prompt, mood, bpm } = req.body;
    console.log(`[GHOST] Summoning pattern for: "${prompt || mood}" at ${bpm} BPM`);
    
    try {
      // Call the local_ghost.py script
      // We use python3 to ensure we use the correct environment on Pi
      const { stdout, stderr } = await execAsync(`python3 scripts/local_ghost.py "${prompt || mood || 'dark techno'}"`);
      
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
      // In a real Pi deployment, this interacts with the FM transmitter hardware
      // We simulate success but log the action for the system log
      res.json({ 
        success: true, 
        message: `RDS_UPDATED: ${text}`,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // System Status (Component Availability)
  app.get("/api/system/status", async (req, res) => {
    const status: any = {
      ollama: false,
      hailo: false,
      minima: false,
      radio: true,
      kernel: "OK",
      cpu_temp: 0
    };

    try {
      // 1. Check Ollama (Local LLM)
      const ollamaRes = await fetch("http://localhost:11434/api/tags").catch(() => null);
      status.ollama = !!ollamaRes;

      // 2. Check Minima (Blockchain Node)
      const minimaRes = await fetch("http://localhost:9001/status").catch(() => null);
      status.minima = !!minimaRes;

      // 3. Check Hailo NPU (AI Accelerator)
      try {
        const { stdout } = await execAsync("hailortcli scan");
        status.hailo = stdout.includes("Device");
      } catch(e) {
        status.hailo = false;
      }

      // 4. Get CPU Temp (Pi Specific)
      try {
        const { stdout } = await execAsync("cat /sys/class/thermal/thermal_zone0/temp");
        status.cpu_temp = parseInt(stdout) / 1000;
      } catch(e) {
        status.cpu_temp = 45; // Fallback for non-Pi environments
      }

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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`
██████╗ ██╗  ██╗ █████╗ ███╗   ██╗████████╗ ██████╗ ███╗   ███╗
██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔═══██╗████╗ ████║
██████╔╝███████║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║
██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║
██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
                                                               
PHANTOM CORE SERVER ACTIVE AT http://localhost:${PORT}
NODE_ENV: ${process.env.NODE_ENV || 'development'}
    `);
  });
}

startServer();
