
# PHANTOM | AI-Native Tactical Audio Workstation

<div align="center">
  <h3>The Ghost in the Machine</h3>
  <p><strong>Developed by Infinity Collaborations SDH</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-00ff41.svg)](https://opensource.org/licenses/MIT)
  [![Platform](https://img.shields.io/badge/Hardware-Raspberry_Pi_5-red)](https://www.raspberrypi.com/)
  [![Core](https://img.shields.io/badge/AI-Gemini_3_Flash-blue)]()
  [![Network](https://img.shields.io/badge/Protocol-LoRa_Mesh-orange)]()
</div>

---

## 🌌 The Concept
**PHANTOM** is a tactical, decentralized instrument designed for the Edge. 
It combines real-time audio synthesis via the **ShadowCore Engine**, AI-driven composition through the **GhostBridge**, and resilient communication via **LoRa Mesh** and **Radio Relay**. Every pattern is anchored to the **Minima Blockchain**, ensuring immutable provenance of creative output.

---

## 🚀 Quick Start (Web Simulation)
Run the full-stack interface and audio engine in your local environment.

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Launch the Core**
    ```bash
    npm run dev
    ```
    Access the workstation at `http://localhost:3000`.

---

## 📡 Tactical Communications

### 1. Hive Protocol (LoRa Mesh)
*   **Voice Transmission:** Communicate with other PHANTOM nodes over simulated 915MHz LoRa mesh.
*   **Mesh Networking:** Nodes automatically form a resilient peer-to-peer network for sync and data relay.
*   **Mic Input:** Supports standard XLR (via interface) or USB microphones for real-time voice-over-LoRa.

### 2. Radio Relay
*   **Frequency Hopping:** Join specific frequencies (e.g., 101.1 MHz) to communicate with node clusters.
*   **Node Messenger:** Send encrypted text bursts between operators on the same carrier frequency.
*   **TX Filter:** Real-time control over transmission bandwidth and signal purity.

---

## 🎛️ Operator's Manual

### 1. The Sequencer (Core)
*   **Ghost Bridge:** Use the AI sidebar to summon patterns. Try: *"Aggressive industrial breakbeat with heavy sub"* or *"Ethereal ambient swell on sector D"*.
*   **Reflex Engine:** High-fidelity synthesis including Kick, Snare, FM Bass, Acid 303, and the new **PAD_ETHER** multi-oscillator engine.

### 2. The Prism Deck (Sampler)
*   **Stem Separation:** Isolate Vocals, Drums, or Bass in real-time using the Prism crossover engine.
*   **Flux Performance:** Engage **Loop Roll** or **Stutter** on the **PERFORMANCE** tab for high-energy transitions.

### 3. The Spirit Ledger (Blockchain)
*   **Provenance:** Every pattern change generates a unique hash anchored to the Minima network.
*   **Verification:** Ensure the "soul" of your music is untampered and uniquely yours.

### 4. Safety Protocols
*   **Dead Man's Switch:** A double-guarded safety hatch (GPIO 17) that instantly kills all audio and radio transmissions in case of compromise.
*   **Panic Monitor:** Real-time hardware telemetry. If CPU temp exceeds 80°C, the system enters a "Panic" state to protect the hardware.

---

<div align="center">
  <p><strong>Code is Law. Music is Spirit.</strong></p>
  <p>© 2026 Infinity Collaborations SDH</p>
</div>
