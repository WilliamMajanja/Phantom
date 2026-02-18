// This string acts as the source file for the AudioWorklet
export const METRONOME_WORKLET_CODE = `
class ShadowCoreProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // The state of our sequencer
    this.currentStep = 0;
    this.nextStepFrame = 0;
    
    // Default 16-step pattern (1 = trigger, 0 = silence)
    this.pattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    
    // Handle messages from the Main Thread (GhostBridge)
    this.port.onmessage = (event) => {
      if (event.data.type === 'UPDATE_PATTERN') {
        this.pattern = event.data.payload;
      }
      if (event.data.type === 'RESET') {
        this.currentStep = 0;
        this.nextStepFrame = currentFrame;
      }
    };
  }

  // Define BPM as an AudioParam so it can be modulated automatically
  static get parameterDescriptors() {
    return [
      {
        name: 'bpm',
        defaultValue: 120,
        minValue: 30,
        maxValue: 300
      }
    ];
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const bpm = parameters.bpm; // This is a Float32Array of 128 values
    const channel = output[0] || new Float32Array(128);
    
    // Iterate through the 128 samples in this render quantum
    for (let i = 0; i < channel.length; i++) {
      const currentBpm = bpm.length > 1 ? bpm[i] : bpm[0];
      
      // Calculate how many samples exist per 16th note step
      // Formula: (SampleRate * 60) / (BPM * 4)
      const samplesPerStep = (sampleRate * 60) / (currentBpm * 4);

      // Check if we have reached the next step
      if (currentFrame + i >= this.nextStepFrame) {
        
        // EMIT TRIGGER
        if (this.pattern[this.currentStep] === 1) {
          channel[i] = 1.0; // "High" Signal
        } else {
          channel[i] = 0.0;
        }
        
        // Send a message back to the UI/Engine to trigger sounds
        this.port.postMessage({ type: 'STEP', step: this.currentStep });

        // Advance the step counter
        this.currentStep = (this.currentStep + 1) % 16;
        
        // Calculate the NEXT time we need to trigger
        this.nextStepFrame += samplesPerStep;
        
      } else {
        // "Low" Voltage
        channel[i] = 0.0;
      }
    }

    return true; // Keep the processor alive
  }
}

registerProcessor('shadow-core', ShadowCoreProcessor);
`;