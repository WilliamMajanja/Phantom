import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  // Radio Relay Logic
  // Nodes join "frequencies" (rooms)
  const frequencies = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws) => {
    let currentFreq = "101.1"; // Default frequency

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "JOIN_FREQ") {
          // Leave old freq
          if (frequencies.has(currentFreq)) {
            frequencies.get(currentFreq)?.delete(ws);
          }
          
          currentFreq = message.frequency;
          if (!frequencies.has(currentFreq)) {
            frequencies.set(currentFreq, new Set());
          }
          frequencies.get(currentFreq)?.add(ws);
          
          ws.send(JSON.stringify({ type: "FREQ_JOINED", frequency: currentFreq }));
        }

        if (message.type === "RADIO_TRANSMISSION") {
          // Broadcast to everyone on the same frequency except sender
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
          // LoRa Mesh Broadcast (Simulated)
          // In a real mesh, this would hop. Here we broadcast to all connected nodes.
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
        console.error("WS Error:", e);
      }
    });

    ws.on("close", () => {
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
    console.log(`PHANTOM CORE SERVER ACTIVE AT http://localhost:${PORT}`);
  });
}

startServer();
