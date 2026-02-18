#!/bin/bash
# LyraFlex Audio Routing Script (Reflex OS)
# Requires: pipewire, wireplumber

echo "🎛️  Initializing LyraFlex Virtual Cable..."

# 1. Create a Null Sink (The Virtual Cable)
# This creates a virtual audio device that apps can output to
pactl load-module module-null-sink sink_name=LyraSource sink_properties=device.description="LyraFlex_Output"

# 2. Verify creation
if pactl list sinks short | grep -q "LyraSource"; then
    echo "✅ LyraSource Created Successfully"
else
    echo "❌ Failed to create sink"
    exit 1
fi

echo "ℹ️  Configure your Browser to output to 'LyraFlex_Output' in PulseAudio Volume Control (pavucontrol)"
echo "ℹ️  Configure Mixxx Aux 1 Input to monitor 'LyraFlex_Output'"