
import time
import sys
import os
from gpiozero import Button, LED, RGBLED, RotaryEncoder
from signal import pause

# ==========================================
# PHANTOM GPIO CONTROLLER
# ==========================================
# This script handles physical interactions for the Phantom DAW.
# It maps hardware controls to system actions and UI events.

# --- PIN MAPPINGS (BCM) ---
KILL_SWITCH_PIN = 17
RECORD_BTN_PIN = 27
PLAY_PAUSE_BTN_PIN = 22
STATUS_LED_R = 23
STATUS_LED_G = 24
STATUS_LED_B = 25
VOLUME_ENC_A = 5
VOLUME_ENC_B = 6

# --- INITIALIZATION ---
try:
    kill_switch = Button(KILL_SWITCH_PIN)
    record_btn = Button(RECORD_BTN_PIN)
    play_btn = Button(PLAY_PAUSE_BTN_PIN)
    status_led = RGBLED(red=STATUS_LED_R, green=STATUS_LED_G, blue=STATUS_LED_B)
    vol_encoder = RotaryEncoder(VOLUME_ENC_A, VOLUME_ENC_B)
    
    print("✅ GPIO CONTROLLER INITIALIZED")
    status_led.color = (0, 1, 0) # Green for Ready
except Exception as e:
    print(f"❌ GPIO INIT FAILED: {e}")
    sys.exit(1)

# --- EVENT HANDLERS ---

def on_kill_activated():
    print("⚠️ KILL SWITCH TRIGGERED")
    status_led.color = (1, 0, 0) # Red
    os.system("python3 /opt/phantom/scripts/kill_switch.py") # Trigger the purge

def on_record_pressed():
    print("⏺️ RECORDING TOGGLED")
    # In a real app, send a signal to the UI or Audio Engine
    status_led.pulse(fade_in_time=0.5, fade_out_time=0.5, on_color=(1, 0, 0))

def on_play_pressed():
    print("⏯️ PLAY/PAUSE TOGGLED")
    status_led.color = (0, 1, 0)

def on_volume_change():
    print(f"🔊 VOLUME STEP: {vol_encoder.steps}")
    # Example: Adjust system volume
    # os.system(f"amixer set Master {vol_encoder.value * 100}%")

# --- ATTACH EVENTS ---
kill_switch.when_pressed = on_kill_activated
record_btn.when_pressed = on_record_pressed
play_btn.when_pressed = on_play_pressed
vol_encoder.when_rotated = on_volume_change

if __name__ == "__main__":
    print("🚀 PHANTOM GPIO LISTENER ACTIVE...")
    try:
        pause()
    except KeyboardInterrupt:
        print("\n🛑 GPIO CONTROLLER SHUTTING DOWN")
        status_led.off()
