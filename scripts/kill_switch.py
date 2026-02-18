
from gpiozero import Button
import os
import time
import sys

# PHANTOM PHASE 9: DEAD MAN'S SWITCH
# Hardware: Safety Toggle Switch (Red)
# Wiring: GPIO 17 -> Switch -> GND

try:
    # Pull-up resistor enabled by default
    switch = Button(17) 
    print("⚠️  KILL SWITCH MONITOR ACTIVE (GPIO 17)")
except Exception as e:
    print(f"❌ GPIO Error: {e}")
    sys.exit(1)

def purge_protocol():
    print("\n\n!!! ⚠️ KILL SWITCH ACTIVATED ⚠️ !!!")
    
    # 1. Kill Radio Transmission
    print(" -> CUTTING FM SIGNAL...")
    os.system("sudo pkill rpitx")
    os.system("sudo pkill pi_fm_rds")
    
    # 2. Kill Audio Engine
    print(" -> STOPPING MIX ENGINE...")
    os.system("pkill mixxx")
    
    # 3. Wipe Session Data (TmpFS)
    print(" -> PURGING MEMORY...")
    os.system("rm -rf /tmp/phantom_session/*")
    
    # 4. Signal UI (via File Watcher or Socket)
    with open("/tmp/phantom_panic", "w") as f:
        f.write("PANIC")
        
    print(" -> SYSTEM HALTED.")
    
    # Optional: Shutdown Pi
    # os.system("sudo shutdown -h now")

# Attach interrupt
switch.when_pressed = purge_protocol

# Keep script running
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    pass
