
# PHANTOM | AI-Native Decentralized Audio Workstation

<div align="center">
  <img src="public/phantom_logo.png" alt="Phantom Logo" width="120" />
  <h3>The Ghost in the Machine</h3>
  <p><strong>Developed by Infinity Collaborations SDH</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-00ff41.svg)](https://opensource.org/licenses/MIT)
  [![Platform](https://img.shields.io/badge/Hardware-Raspberry_Pi_5-red)](https://www.raspberrypi.com/)
  [![Core](https://img.shields.io/badge/AI-Gemini_1.5_Flash-blue)]()
</div>

---

## 🌌 The Concept
**PHANTOM** is a decentralized instrument that exists between the Edge and the Cloud. 
It uses a **Raspberry Pi 5** to process audio in real-time (via NPU) and **Google Gemini** to compose patterns based on abstract prompts. Every session is hashed to the **Minima Blockchain**, creating a permanent digital soul for your music.

---

## 🚀 Quick Start (Web Simulation)
Run the interface and audio engine on your Mac/PC for development.

1.  **Install**
    ```bash
    npm install
    ```

2.  **Configure AI**
    Create a `.env` file with your Gemini API Key:
    ```env
    API_KEY=AIzaSy...
    ```

3.  **Launch**
    ```bash
    npm start
    ```
    Access at `http://localhost:3000`.

---

## 🛠️ Hardware Forge (Raspberry Pi)
Turn a Raspberry Pi into a dedicated PHANTOM Node.

### Requirements
*   **Compute:** Raspberry Pi 5 (8GB Recommended).
*   **Storage:** NVMe SSD (Gen 3) for high-speed sampling.
*   **AI:** Hailo-8L AI Kit (for Stem Separation).
*   **Display:** Official 7" Touchscreen or HDMI Display.

### Installation
1.  **Flash OS:** Use the provided script to burn a custom **Reflex OS** image to your SSD.
    ```bash
    cd scripts
    sudo ./build_phantom_os.sh PI5
    ```
2.  **Boot:** Insert the drive into the Pi 5. The system will auto-expand and launch the Kiosk.
3.  **Cluster:** (Optional) To set up a multi-node swarm, run:
    ```bash
    sudo ./scripts/setup_cluster.sh NEXUS
    ```

---

## 🎛️ Operator's Manual

### 1. The Sequencer (Core)
*   **Grid:** Click steps to toggle triggers.
*   **Ghost Bridge:** Type a prompt like *"Hard techno rumble at 140bpm"* and press Enter. The AI will reprogram the sequencer.
*   **Modes:** Switch between **TRIG** (Note On), **VEL** (Volume), and **PROB** (Chance) to add humanization.

### 2. The Prism Deck (Sampler)
*   **Import:** Load MP3/WAV files from the **PATCHBAY** tab.
*   **Stems:** Use the faders to isolate Vocals, Drums, or Bass in real-time.
*   **Flux:** Use the "Loop Roll" buttons on the **PERFORM** tab for beat-repeat effects.

### 3. The Spirit Ledger (Blockchain)
*   **Anchor:** Click the **SECURE_HASH** button in the header.
*   **Verify:** A receipt is printed (if thermal printer connected) and the hash is sent to the Minima network.

### 4. Safety Protocols
*   **Kill Switch:** Physical GPIO 17 switch (or UI button) instantly cuts all audio and radio transmission.
*   **Panic Mode:** If CPU temp > 80°C, the interface goes Red and audio is bit-crushed to warn the operator.

---

<div align="center">
  <p><strong>Code is Law. Music is Spirit.</strong></p>
  <p>© 2024 Infinity Collaborations SDH</p>
</div>
