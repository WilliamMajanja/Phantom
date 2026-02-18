
import numpy as np
import sounddevice as sd
import sys
import time
import os
from panic_audio import DigitalShriek 

# Hardware Abstraction for NPU
try:
    import hailo_platform as he
    from hailo_sdk_client import ClientRunner
    HAS_NPU = True
except ImportError:
    print("⚠️  Hailo NPU libs not found. Running in Spectral Passthrough Mode.")
    HAS_NPU = False

# PRISM ENGINE v1.1
# Real-time Stem Separation & Audio Hazard Protocol

# Configuration
MODEL_PATH = "models/demucs_quantized_hailo.hef"
BLOCK_SIZE = 1024
SAMPLE_RATE = 44100
INPUT_CHANNELS = 2
# Dynamic Output Config
try:
    # Check default device capability
    dev_info = sd.query_devices(sd.default.device[1], 'output')
    max_out = dev_info['max_output_channels']
    OUTPUT_CHANNELS = min(8, max_out) # Use 8 if available, else max
except:
    OUTPUT_CHANNELS = 2

print(f"🔊 Output Configuration: {OUTPUT_CHANNELS} Channels")

class PrismEngine:
    def __init__(self):
        print("💎 Initializing Prism Engine...")
        
        self.shriek = DigitalShriek(sample_rate=SAMPLE_RATE)
        self.active = False
        
        if HAS_NPU and os.path.exists(MODEL_PATH):
            try:
                self.vdevice = he.VDevice()
                self.network_group = self.vdevice.configure(he.Hef(MODEL_PATH))[0]
                self.network_group_params = self.network_group.create_params()
                self.input_vstream = self.network_group.create_input_vstream(self.network_group_params)
                self.output_vstream = self.network_group.create_output_vstream(self.network_group_params)
                print("✅ NPU Loaded. Latency < 10ms.")
                self.active = True
            except Exception as e:
                print(f"❌ NPU Initialization Failed: {e}")
                self.active = False
        else:
            self.active = False

    def check_panic_state(self):
        if os.path.exists("/tmp/phantom_panic"):
            if not self.shriek.active:
                self.shriek.engage()
        else:
            if self.shriek.active:
                self.shriek.disengage()

    def process_block(self, indata, outdata, frames, time_info, status):
        """
        Callback: Runs every audio block.
        """
        if status:
            print(status, file=sys.stderr)

        self.check_panic_state()

        if self.shriek.active:
            # --- AUDIO HAZARD ---
            destroyed_audio = self.shriek.process(indata)
            
            # Map destroyed audio to all available outputs
            channels = outdata.shape[1]
            for i in range(0, channels, 2):
                if i+1 < channels:
                    outdata[:, i]   = destroyed_audio[:, 0]
                    outdata[:, i+1] = destroyed_audio[:, 1]
                
        elif self.active and OUTPUT_CHANNELS >= 8:
            # --- NPU STEM SEPARATION ---
            # Only valid if we have 8 outputs for stems
            input_tensor = np.expand_dims(indata, axis=0).astype(np.float32)
            self.input_vstream.send(input_tensor)
            raw_stems = self.output_vstream.recv()
            outdata[:] = raw_stems.reshape(frames, 8) 
        else:
            # --- PASSTHROUGH ---
            # Copy stereo input to output 1/2
            outdata[:, 0] = indata[:, 0]
            outdata[:, 1] = indata[:, 1]
            # Silence other channels
            if OUTPUT_CHANNELS > 2:
                outdata[:, 2:] = 0

    def start(self):
        try:
            with sd.Stream(channels=[INPUT_CHANNELS, OUTPUT_CHANNELS], 
                           samplerate=SAMPLE_RATE,
                           callback=self.process_block, 
                           blocksize=BLOCK_SIZE):
                print(f"💎 Prism Engine Active ({'NPU' if self.active else 'Passthrough'}). Listening...")
                while True:
                    sd.sleep(1000)
        except Exception as e:
            print(f"❌ Audio Stream Error: {e}")

if __name__ == "__main__":
    engine = PrismEngine()
    engine.start()
