# 💀 PHANTOM | AI-NATIVE TACTICAL DAW
### *The Ghost in the Machine*

<div align="center">
  <p><strong>A Decentralized Audio Workstation for the Edge</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-00ff41.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
  [![Platform](https://img.shields.io/badge/Hardware-Raspberry_Pi_5-red?style=for-the-badge)](https://www.raspberrypi.com/)
  [![Core](https://img.shields.io/badge/AI-Ollama%20%2B%20Gemini-blue?style=for-the-badge)]()
  [![Network](https://img.shields.io/badge/Protocol-LoRa_Mesh-orange?style=for-the-badge)]()
  [![Blockchain](https://img.shields.io/badge/Ledger-Minima-purple?style=for-the-badge)]()
</div>

---

## 🌌 THE NEURAL CORE
**PHANTOM** is a tactical, AI-native digital audio workstation designed for resilient creative output in any environment. By merging high-fidelity synthesis with decentralized communication protocols and blockchain provenance, PHANTOM exists where the cloud meets the dirt.

It is built to run on edge hardware (like the Raspberry Pi 5) while preferring local Ollama models for neural pattern generation, optionally falling back to Gemini when configured, and using the Minima blockchain for immutable asset tracking.

### ⚡ Key Technologies
*   **ShadowCore Engine**: Real-time 32-bit float audio processing with zero-latency signal paths and parallel stem isolation.
*   **GhostBridge V3**: Neural pattern synthesis powered by local Ollama first, with optional Gemini fallback, supporting multi-line tactical commands and MIDI exfiltration.
*   **Production Engines**: LMMS is detected as the local production engine and Mixxx as the local mixing engine.
*   **Hive Protocol**: Peer-to-peer LoRa Mesh networking for voice and data sync across nodes via WebSockets.
*   **Spirit Ledger**: Immutable session anchoring via Minima Omnia and unique asset tokenization via Minima Axia.

---

## 🚀 DEPLOYMENT & SETUP

PHANTOM ships with the current Express/Vite control surface and a Python Reflex application path for local-first operation.

### 🛠️ Prerequisites
- **Node.js**: v18+ recommended.
- **Ollama**: Recommended for local Ghost Bridge neural synthesis (`OLLAMA_MODEL` defaults to `llama3:8b-instruct-q4_K_M`).
- **Gemini API Key**: Optional cloud fallback for Ghost Bridge neural synthesis.
- **LMMS and Mixxx**: Optional local production and mixing engines detected by PHANTOM status APIs.
- **Minima MDS / MiniHub**: Required for Omnia anchoring and Axia token minting.
- **PiNet_Os / Raspberry Pi 5 hardware**: Required for GPIO FM RDS and Hailo NPU features.

### 📦 Installation
```bash
# Clone the repository
git clone https://github.com/infinity-collaborations/phantom.git
cd phantom

# Install dependencies
npm install
```

### ⚙️ Configuration
Create a `.env` file in the root directory (see `.env.example`):
```env
GEMINI_API_KEY=your_api_key_here
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b-instruct-q4_K_M
MINIMA_BASE_URL=http://localhost:9001
APP_URL=http://localhost:3000
PHANTOM_URL=http://localhost:3000
```

### ⚡ Launch
```bash
# Engage the core in development mode
npm run dev
```
> **Access Point:** `http://localhost:3000`

### 🐍 Python Application Mode
The Python frontend/backend lives in `phantom/` and uses Reflex. It exposes the same local-first Ghost Bridge concept, LMMS/Mixxx readiness, and sample-format support:

```bash
pip install reflex psutil
reflex run
```

The Python Ghost Bridge calls Ollama locally and falls back to deterministic responses when Ollama is offline.

### 🍓 Raspberry Pi OS Trixie Application Mode
PHANTOM can be installed as a production Raspberry Pi OS Trixie application with a systemd service and Chromium kiosk launcher:

```bash
npm run raspi:install
```

The installer copies the app to `/opt/phantom`, builds the production frontend, writes `/etc/systemd/system/phantom.service`, and installs a desktop launcher. Configure runtime values in `/etc/phantom/phantom.env`, including local Ollama/Minima endpoints and kiosk URL overrides, then manage the app with:

```bash
sudo systemctl status phantom.service
sudo systemctl restart phantom.service
```

The app binds to `0.0.0.0:3000` by default so it can be opened locally on the Pi or from another device on the same network.

### 🟣 Minima MiniDAPP
PHANTOM now ships with `minidapp.conf` for MiniHub packaging. Build the frontend with `npm run build`, include the generated `dist/` assets with `minidapp.conf`, and run the app inside Minima MDS so `window.MDS` is available. Provenance actions fail closed when MDS is unavailable instead of creating simulated transaction IDs.

---

## 🎛️ OPERATOR INTERFACE

### 🧠 Ghost Bridge (AI Neural Link)
The Ghost Bridge is your neural link to the machine. Use the command console to summon complex patterns or chat with the "Ghost in the Machine."

*   **Tactical Commands**:
    *   `/GENERATE` - Create a new rhythmic foundation from scratch.
    *   `/REMIX` - Re-interpret current instrumentation with new rhythms.
    *   `/MUTATE` - Apply subtle variations to the active pattern.
    *   `/EVOLVE` - Gradually increase signal complexity and intensity.
    *   `/CLEAR` - Wipe the sequencer grid.
*   **MIDI Exfiltration**: Every pattern generated by the AI can be exported as a Standard MIDI File (Format 0), specifically mapped for the **Roland TR-8S** drum machine.
*   **Sample Manifests**: Sessions can be exported as AKAI MPC program manifests or Serato slab manifests for local sample workflows.

### 💎 Prism Deck (Sampling & Stems)
*   **Stem Isolation**: Real-time parallel crossover engine to split any signal into Vocals, Drums, Bass, and Other.
*   **Flux FX**: Performance-grade Loop Rollers, Stutter gates, and EQ filters for high-intensity transitions.

### 🛡️ Safety & Security
*   **Panic Watchdog**: Real-time telemetry monitoring CPU thermals, NPU load, and memory usage.
*   **Kill Switch**: Instant signal blackout and data purge protocol for compromised environments.

---

## 🔗 BLOCKCHAIN PROVENANCE

PHANTOM integrates deeply with the **Minima Blockchain** to ensure your creative output is tracked and owned.

### ⚓ Omnia Anchoring
Anchor your entire session state to the blockchain. PHANTOM generates a cryptographic "Spirit Hash" of your current patterns, parameters, and telemetry, then anchors it to a Minima block. This creates an immutable record of your creative process.

### 💎 Axia Tokenization
Mint unique audio patterns as digital assets. Using the Axia protocol, you can create a unique token on the Minima chain that represents a specific pattern, complete with its metadata and provenance hash.

---

## 📡 NETWORK ARCHITECTURE

PHANTOM nodes communicate via a multi-layered protocol stack designed for reliability in disconnected environments.

| Layer | Protocol | Function |
| :--- | :--- | :--- |
| **HIVE** | WebSocket / LoRa | Real-time voice-over-mesh and peer discovery. |
| **RELAY** | Radio RF / WebSocket | Frequency-hopped text messenger and signal relay. |
| **PHANTOM** | Custom Binary | High-speed local cluster synchronization for audio sync. |

---

## 🛠️ HARDWARE FORGE
While the web simulation is powerful, PHANTOM is designed for the **Raspberry Pi 5**.
*   **Compute**: 8GB RAM + NVMe SSD for high-speed sample access.
*   **AI**: Hailo-8L NPU for local stem separation (Prism Core).
*   **Audio**: I2S DAC for low-jitter, high-fidelity output.
*   **Comms**: Waveshare LoRa Module for mesh networking.

---

<div align="center">
  <p><strong>Decentralized for Edge Computing.</strong></p>
  <p>Developed by <strong>Infinity Collaborations SDH</strong></p>
  <p>© 2026 // ALL RIGHTS RESERVED</p>
</div>
