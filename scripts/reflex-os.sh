
#!/bin/bash

# ==========================================
# PiNet_Os Kernel ORCHESTRATOR
# ==========================================
# This script runs on boot via phantom.service.
# It initializes the hardware, AI backend, and UI Kiosk.

export PHANTOM_HOME="/opt/phantom"
export XDG_RUNTIME_DIR="/run/user/0" # If running as root

echo "👻 PHANTOM OS STARTING..."

# 1. INITIALIZE HARDWARE INTERFACES
# Start the GPIO Controller (Buttons, LEDs, Knobs)
python3 $PHANTOM_HOME/scripts/gpio_controller.py &

# Start the Dead Man's Switch Monitor
python3 $PHANTOM_HOME/scripts/kill_switch.py &

# Start the Hive Mesh (LoRa) in Listener Mode
python3 $PHANTOM_HOME/scripts/hive_mesh.py &

# Start the FM Broadcaster (GPIO 4)
python3 $PHANTOM_HOME/scripts/fm_broadcast.py &

# 2. START AI BACKEND (THE GHOST)
# Start the Ollama & NPU Bridge
python3 $PHANTOM_HOME/scripts/ollama_npu_bridge.py &

# Start the Local Llama 3 Interface
python3 $PHANTOM_HOME/scripts/local_ghost.py &

# Start the Prism Engine (Audio Processing)
# Wait a moment for PipeWire to stabilize
sleep 2
python3 $PHANTOM_HOME/scripts/prism_engine.py &

# 3. START UI SERVER
cd $PHANTOM_HOME
# In production, use 'serve -s build', but npm start works for prototype
npm start &

# 4. WAIT FOR LOCALHOST
# Loop until the React app is serving
echo "⏳ Waiting for UI Server..."
until $(curl --output /dev/null --silent --head --fail http://localhost:3000); do
    printf '.'
    sleep 1
done
echo "✅ UI Server Online."

# 5. LAUNCH GRAPHICAL KIOSK (Wayfire)
# This command takes over the TTY and displays the interface
# The config file handles launching Chromium
exec wayfire -c $PHANTOM_HOME/scripts/wayfire.ini
