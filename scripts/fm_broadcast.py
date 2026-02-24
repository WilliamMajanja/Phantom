
import os
import subprocess
import time
import sys

# ==========================================
# PHANTOM FM BROADCASTER (Pi-FM-RDS)
# ==========================================
# This script manages the FM transmission via GPIO 4.
# It uses pi_fm_rds to broadcast audio from a pipe or file.

FM_PIPE = "/tmp/phantom_fm_pipe"
DEFAULT_FREQ = "87.5"
DEFAULT_PS = "PHANTOM"
DEFAULT_RT = "Tactical Audio Workstation"

class FMBroadcaster:
    def __init__(self):
        self.process = None
        self.is_broadcasting = False
        
        if not os.path.exists(FM_PIPE):
            os.mkfifo(FM_PIPE)

    def start(self, freq=DEFAULT_FREQ, ps=DEFAULT_PS, rt=DEFAULT_RT):
        if self.is_broadcasting:
            self.stop()
            
        print(f"📡 STARTING FM BROADCAST ON {freq}MHz...")
        # Command: pi_fm_rds -freq 87.5 -audio /tmp/phantom_fm_pipe -ps PHANTOM -rt "Tactical Audio Workstation"
        cmd = [
            "sudo", "pi_fm_rds",
            "-freq", str(freq),
            "-audio", FM_PIPE,
            "-ps", ps,
            "-rt", rt
        ]
        
        try:
            self.process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.is_broadcasting = True
            print("✅ FM TRANSMITTER ACTIVE (GPIO 4)")
        except Exception as e:
            print(f"❌ FM START FAILED: {e}")

    def stop(self):
        if self.process:
            self.process.terminate()
            self.process = None
        os.system("sudo pkill pi_fm_rds")
        self.is_broadcasting = False
        print("🛑 FM BROADCAST STOPPED")

if __name__ == "__main__":
    broadcaster = FMBroadcaster()
    # For testing, we just start it. In production, this would be controlled via IPC/Socket.
    broadcaster.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        broadcaster.stop()
