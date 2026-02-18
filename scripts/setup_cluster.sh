
#!/bin/bash

# ==========================================
# TRI-CORE CLUSTER PROVISIONING
# ==========================================
# Usage: sudo ./setup_cluster.sh [NEXUS|CORTEX|OCULUS]

ROLE=$1

if [ -z "$ROLE" ]; then
    echo "Usage: ./setup_cluster.sh [NEXUS|CORTEX|OCULUS]"
    echo "  NEXUS  = Node 1 (NVMe/Audio)"
    echo "  CORTEX = Node 2 (AI Hat)"
    echo "  OCULUS = Node 3 (Sense Hat)"
    exit 1
fi

echo "⚙️  Configuring Node as: $ROLE"

# Common Deps
apt-get update && apt-get install -y python3-pip git

if [ "$ROLE" == "NEXUS" ]; then
    echo "💿 Setting up NEXUS (Audio Core)..."
    # Runs the React App and Audio Engine
    # Ensure NVMe optimization is set (calling existing script)
    ./scripts/setup_nvme.sh
    echo "✅ NEXUS Ready. Run 'npm start'."

elif [ "$ROLE" == "CORTEX" ]; then
    echo "🧠 Setting up CORTEX (AI Mind)..."
    # Install Hailo-8L software stack
    apt-get install -y hailo-all
    pip3 install -r requirements_ai.txt
    # In a real deployment, we'd install Ollama here
    curl -fsSL https://ollama.com/install.sh | sh
    echo "✅ CORTEX Ready. Run 'scripts/node_cortex.py'."

elif [ "$ROLE" == "OCULUS" ]; then
    echo "👁️  Setting up OCULUS (Visualizer)..."
    apt-get install -y sense-hat
    pip3 install websockets psutil
    
    # Create SystemD Service for Oculus
    cat <<EOF > /etc/systemd/system/oculus.service
[Unit]
Description=Phantom Oculus Visualizer
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/phantom/scripts/node_oculus.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
EOF
    systemctl enable oculus.service
    systemctl start oculus.service
    echo "✅ OCULUS Service Started."

fi
