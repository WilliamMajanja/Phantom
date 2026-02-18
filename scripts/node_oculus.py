
import asyncio
import websockets
import json
import psutil

# ==========================================
# NODE: OCULUS (The Eye)
# Hardware: Sense HAT (8x8 LED Matrix)
# Function: Visualizes sequencer state from the Nexus node.
# ==========================================

# Hardware Abstraction Layer for non-SenseHat devices
try:
    from sense_hat import SenseHat
    sense = SenseHat()
    sense.clear()
    HAS_HARDWARE = True
    print("✅ Sense HAT Hardware Detected")
except ImportError:
    print("⚠️  Sense HAT Not Found. Running in Simulation Mode.")
    HAS_HARDWARE = False
    
    class MockSenseHat:
        def clear(self): pass
        def set_pixels(self, p): pass
        def show_letter(self, l, text_colour): pass
        def get_temperature(self): return 45.0 # Mock Temp
        
    sense = MockSenseHat()

# Colors
C_BG = [0, 0, 0]
C_STEP_OFF = [20, 20, 20]
C_STEP_ON = [0, 255, 65]   # Phantom Green
C_STEP_ACT = [255, 255, 255] # Current Step
C_PANIC = [255, 0, 0]

async def send_telemetry(websocket):
    """Broadcasts temperature and humidity to the cluster."""
    while True:
        # Get Temp
        if HAS_HARDWARE:
            temp = sense.get_temperature()
            cpu_temp = psutil.sensors_temperatures()['cpu_thermal'][0].current
            calibrated_temp = temp - ((cpu_temp - temp) / 1.5)
        else:
            calibrated_temp = 42.0 # Constant mock
            try:
                 # Try to get real CPU temp even without Hat
                 cpu_temp = psutil.sensors_temperatures()['cpu_thermal'][0].current
                 calibrated_temp = cpu_temp
            except:
                 pass

        telemetry = {
            "type": "TELEMETRY",
            "payload": {
                "cpuTemp": calibrated_temp,
                "npuLoad": 0, # N/A for this node
                "pcieLaneUsage": 0,
                "memoryUsage": psutil.virtual_memory().percent
            }
        }
        await websocket.send(json.dumps(telemetry))
        await asyncio.sleep(2)

async def handler(websocket):
    print("👁️  OCULUS LINK ESTABLISHED")
    
    # Start telemetry loop task
    asyncio.create_task(send_telemetry(websocket))

    async for message in websocket:
        try:
            data = json.loads(message)
            
            if data['type'] == 'STEP':
                current_step = data['step']
                # active_tracks = data['activity'] # [bool, bool...]
                
                # --- VISUALIZATION LOGIC ---
                # Only attempt LED updates if hardware exists to save CPU
                if HAS_HARDWARE:
                    # Map 16 steps to top 2 rows (8x2)
                    pixels = [C_BG] * 64
                    
                    # 1. Sequencer Grid (Top 2 Rows)
                    for i in range(16):
                        row = 0 if i < 8 else 1
                        col = i % 8
                        idx = (row * 8) + col
                        
                        if i == current_step:
                            pixels[idx] = C_STEP_ACT
                        else:
                            pixels[idx] = C_STEP_OFF

                    # 2. Spectral/Activity (Bottom 6 Rows)
                    if current_step % 4 == 0: 
                        for y in range(2, 8):
                            for x in range(8):
                                if (x + y + current_step) % 3 == 0:
                                    idx = (y * 8) + x
                                    pixels[idx] = [0, 50, 0] 

                    sense.set_pixels(pixels)
                
        except Exception as e:
            print(f"Error: {e}")

async def main():
    print("👁️  OCULUS NODE ONLINE. Waiting for Nexus...")
    sense.show_letter("O", text_colour=[0, 255, 0])
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
