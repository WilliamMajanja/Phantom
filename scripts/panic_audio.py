
import numpy as np

# PHANTOM PHASE 10: AUDIO HAZARD PROTOCOL
# The "Digital Shriek" DSP Engine
# Simulates total logic board failure via bitcrushing and aliasing.

class DigitalShriek:
    def __init__(self, sample_rate=44100):
        self.active = False
        self.intensity = 0.0
        self.sample_rate = sample_rate
        # Phase tracker for the death whine oscillator
        self.phase = 0 

    def engage(self):
        """Turn on the destruction."""
        if not self.active:
            print("💀 DIGITAL SHRIEK ENGAGED")
        self.active = True
        self.intensity = 1.0

    def disengage(self):
        """Restore system integrity."""
        self.active = False
        self.intensity = 0.0

    def process(self, audio_buffer):
        """
        Destroys the incoming audio buffer in real-time.
        Expects: numpy array of floats [-1.0, 1.0] with shape (frames, channels)
        """
        if not self.active:
            return audio_buffer

        # Audio Buffer Shape: (Frames, Channels) i.e., (1024, 2)
        
        # --- STEP 1: BIT CRUSHING (Quantization) ---
        # Reduce to effectively 3-4 bits
        bit_depth = 4 
        step = 1.0 / (2 ** bit_depth)
        
        # Snap values to the grid
        crushed = np.round(audio_buffer / step) * step

        # --- STEP 2: DECIMATION (Sample Rate Reduction) ---
        # We hold every Nth sample to create "robotic" aliasing
        # Factor of 10 drops 44.1kHz to ~4.4kHz
        downsample_factor = 12 
        
        # Create a mask that repeats values (Sample-and-Hold simulation)
        # We process along axis 0 (time)
        indices = np.arange(len(crushed))
        hold_indices = (indices // downsample_factor) * downsample_factor
        
        # Apply the hold indices. 
        # Note: We need to ensure we don't go out of bounds if buffer size isn't divisible
        hold_indices = np.clip(hold_indices, 0, len(crushed) - 1)
        decimated = crushed[hold_indices]

        # --- STEP 3: THE DEATH WHINE (Sine Injection) ---
        # Simulates a capacitor discharging / feedback loop
        # 8000Hz tone that screams over the audio
        t = np.arange(len(audio_buffer))
        
        # Generate sine wave for time steps
        whine_mono = 0.15 * np.sin(2 * np.pi * 8000 * t / self.sample_rate + self.phase)
        
        # Expand dimensions to match stereo/multichannel ((1024,) -> (1024, 1))
        whine = whine_mono[:, np.newaxis]
        
        # Advance phase for next block to avoid clicking
        self.phase += len(audio_buffer) * (2 * np.pi * 8000 / self.sample_rate)
        self.phase %= (2 * np.pi)

        # --- STEP 4: STATIC INTERFERENCE ---
        noise = np.random.normal(0, 0.05, audio_buffer.shape)

        # Mix it all together (hard clipped)
        # Decimated Signal + Whine + White Noise
        final_signal = decimated + whine + noise
        
        return np.clip(final_signal, -1.0, 1.0)
