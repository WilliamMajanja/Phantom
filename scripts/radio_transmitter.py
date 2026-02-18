# radio_transmitter.py
import subprocess
import os
import sys

# CONFIGURATION
FREQ = "101.1" 
STATION_NAME = "LYRA_FM"
RT_TEXT = "Broadcasting AI-Native Audio from LyraFlex"
BINARY_PATH = "./pi_fm_rds" # Path to the compiled pi_fm_rds binary

def start_transmission():
    print(f"📡 STARTING TRANSMISSION ON {FREQ} MHz")
    print(f"ℹ️  Source: Default Capture Device (Mixxx Master Output)")
    
    if not os.path.exists(BINARY_PATH):
        print(f"❌ Error: {BINARY_PATH} not found. Please compile pi_fm_rds first.")
        sys.exit(1)

    # 1. Capture Audio (arecord)
    # capturing 16-bit Little Endian, 44.1kHz, Stereo from default device
    cmd_capture = ["arecord", "-f", "S16_LE", "-r", "44100", "-c", "2", "-"]

    # 2. Transmit (pi_fm_rds)
    # Reads from Stdin (-audio -)
    cmd_transmit = [
        "sudo", BINARY_PATH, 
        "-freq", FREQ, 
        "-audio", "-", 
        "-ps", STATION_NAME, 
        "-rt", RT_TEXT
    ]

    try:
        # Create pipeline: arecord | pi_fm_rds
        p1 = subprocess.Popen(cmd_capture, stdout=subprocess.PIPE)
        p2 = subprocess.Popen(cmd_transmit, stdin=p1.stdout)
        
        # Allow p1 to receive a SIGPIPE if p2 exits.
        p1.stdout.close()
        p2.communicate()
    except KeyboardInterrupt:
        print("\n🛑 Transmission Stopped.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    start_transmission()