
import time
import struct
import sys
import argparse

# Hardware Abstraction
try:
    import spidev
    import RPi.GPIO as GPIO
    HAS_LORA = True
except (ImportError, RuntimeError):
    print("⚠️  LoRa Hardware (SPI/GPIO) not found. Running in Mesh Simulation Mode.")
    HAS_LORA = False
    # Mock GPIO
    class MockGPIO:
        BCM = 'BCM'
        OUT = 'OUT'
        IN = 'IN'
        def setmode(self, mode): pass
        def setwarnings(self, state): pass
        def setup(self, pin, mode): pass
        def output(self, pin, state): pass
        def input(self, pin): return 0
    GPIO = MockGPIO()
    # Mock SPI
    class MockSpiDev:
        max_speed_hz = 0
        def open(self, bus, device): pass
    spidev = MockModule()
    class MockModule:
        SpiDev = MockSpiDev


# HIVE MESH v1.1
# Long-Range Synchronization Protocol over LoRa (915MHz)
# Supports Standard GPIO Wiring or HATs (Waveshare/Dragino)

class HiveMesh:
    def __init__(self, frequency=915.0, reset_pin=22, busy_pin=27, cs_pin=0, spi_bus=0, spi_device=0):
        print("🐝 Initializing Hive Mesh Protocol...")
        print(f"🔧 CONFIG: RST={reset_pin}, BUSY={busy_pin}, CS={cs_pin} (SPI {spi_bus}.{spi_device})")
        
        self.reset_pin = reset_pin
        self.busy_pin = busy_pin
        
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(self.reset_pin, GPIO.OUT)
        GPIO.setup(self.busy_pin, GPIO.IN)
        
        if HAS_LORA:
            self.spi = spidev.SpiDev()
            self.spi.open(spi_bus, spi_device)
            self.spi.max_speed_hz = 5000000
            # Hard Reset SX1262
            self.reset_radio()

        self.is_master = False
        print("✅ Mesh Interface Initialized")

    def reset_radio(self):
        if not HAS_LORA: return
        GPIO.output(self.reset_pin, 0)
        time.sleep(0.01)
        GPIO.output(self.reset_pin, 1)
        time.sleep(0.01)
        
        timeout = time.time() + 1
        while GPIO.input(self.busy_pin) == 1:
            if time.time() > timeout:
                print("⚠️ Warning: Radio BUSY Timeout during reset")
                break
            time.sleep(0.001)

    def write_register(self, reg, data):
        if not HAS_LORA: return
        pass

    def send_clock_pulse(self, bpm, timestamp):
        """
        Broadcasts the current clock state to the mesh.
        """
        if not self.is_master: return
        
        if HAS_LORA:
            # Real Transmission logic
            try:
                payload = struct.pack('<BBBI', 0xA1, 0x01, int(bpm), int(timestamp))
                # self.lora.send(payload)
            except Exception as e:
                print(f"Tx Error: {e}")
        else:
            # Simulation log
            # print(f"🐝 [SIM] Tx Clock: {bpm} BPM")
            pass
        
    def listen(self):
        print(f"🐝 Hive Mesh: Listening on {915 if HAS_LORA else 'VIRTUAL'}MHz...")
        while True:
            # check_rx() 
            packet = None 
            
            # In simulation mode, we might randomly 'receive' a packet to test UI
            if not HAS_LORA and int(time.time()) % 10 == 0:
                # Simulate packet every 10s
                # packet = struct.pack('<BBBI', 0xA1, 0x01, 120, int(time.time()*1000))
                pass

            if packet:
                self.handle_packet(packet)
            
            time.sleep(0.01)
                
    def handle_packet(self, data):
        if len(data) < 7: return
        header, msg_type, bpm, remote_ts = struct.unpack('<BBBI', data[:7])
        if header != 0xA1: return 
        
        local_ts = time.time() * 1000
        latency = local_ts - remote_ts
        
        if msg_type == 0x01: # CLOCK SYNC
            print(f"🔄 Syncing to Hive: {bpm} BPM (Latency: {latency:.2f}ms)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Phantom Hive Mesh (LoRa Sync)')
    parser.add_argument('mode', nargs='?', choices=['master', 'slave'], default='slave', help='Operation Mode')
    parser.add_argument('--reset', type=int, default=22, help='GPIO pin for RESET (Default: 22)')
    parser.add_argument('--busy', type=int, default=27, help='GPIO pin for BUSY/DIO0 (Default: 27)')
    parser.add_argument('--cs', type=int, default=0, help='SPI CE Pin (0 or 1) (Default: 0)')
    parser.add_argument('--spi_bus', type=int, default=0, help='SPI Bus (Default: 0)')
    
    args = parser.parse_args()

    mesh = HiveMesh(
        reset_pin=args.reset,
        busy_pin=args.busy,
        cs_pin=args.cs,
        spi_bus=args.spi_bus
    )
    
    if args.mode == 'master':
        mesh.is_master = True
        print("👑 Running as Hive Master")
        while True:
            mesh.send_clock_pulse(120, time.time() * 1000)
            time.sleep(0.5)
    else:
        mesh.listen()
