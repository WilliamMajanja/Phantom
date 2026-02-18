#!/bin/bash
echo "🎹 Setting up Virtual MIDI for LyraFlex..."

# Load the Virtual MIDI kernel module
# This creates a virtual MIDI cable that appears as a hardware device to both Chrome and Mixxx
if lsmod | grep -q "snd_virmidi"; then
    echo "✅ snd-virmidi is already loaded"
else
    echo "⚙️  Loading snd-virmidi module..."
    sudo modprobe snd-virmidi
    echo "✅ Module loaded"
fi

# List devices to confirm
echo "📋 Available MIDI Ports:"
aconnect -l

echo "ℹ️  Next Step: Open Mixxx Preferences -> Controllers and enable 'LyraFlex Virtual Link'"