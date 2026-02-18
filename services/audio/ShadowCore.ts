
import { METRONOME_WORKLET_CODE } from './worklet';
import { InstrumentType, Track, TrackParams, SequencerStep } from '../../types';
import { phantomProtocol, TR8S_NOTE_MAP } from '../phantomProtocol';

export class ShadowCore {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  
  // Signal Chain
  private masterGain: GainNode | null = null; 
  private masterLimiter: DynamicsCompressorNode | null = null;
  
  // FX Section
  private lowpassFilter: BiquadFilterNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private bitCrusherShaper: WaveShaperNode | null = null;
  
  // Spatial FX
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delaySendGain: GainNode | null = null;
  
  private reverbNode: ConvolverNode | null = null;
  private reverbSendGain: GainNode | null = null;

  // Stutter State
  private stutterActive: boolean = false;
  private stutterInterval: number = 4;
  private stutterStartStep: number = 0;
  private stutterCounter: number = 0;
  
  // Loop Roller State (Slip Mode)
  private rollEngagedTime: number = 0;
  private rollOriginalOffset: number = 0; // Where we were in the track when loop started

  // Recording
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  // Prism Engine (Sample Player / DJ Deck)
  private prismBuffer: AudioBuffer | null = null;
  private prismSource: AudioBufferSourceNode | null = null;
  private prismGain: GainNode | null = null;
  public prismAnalyser: AnalyserNode | null = null; 

  // Prism EQ & Filter Nodes
  private prismEqLow: BiquadFilterNode | null = null;
  private prismEqMid: BiquadFilterNode | null = null;
  private prismEqHigh: BiquadFilterNode | null = null;
  private prismFilter: BiquadFilterNode | null = null;
  
  // Prism STEMS Engine (Parallel Crossover)
  private stemSplitterNode: GainNode | null = null;
  private stemNodes: {
      bass: { filter: BiquadFilterNode, gain: GainNode } | null,
      drums: { filter: BiquadFilterNode, gain: GainNode } | null,
      vox: { filter: BiquadFilterNode, gain: GainNode } | null,
      other: { filter: BiquadFilterNode, gain: GainNode } | null
  } = { bass: null, drums: null, vox: null, other: null };

  private prismPlaybackRate: number = 1.0;
  private prismDetune: number = 0;
  private prismLoop: boolean = false;
  private prismActive: boolean = false;
  private prismStartTime: number = 0;
  private prismOffset: number = 0;

  // Mic / Input
  private micGain: GainNode | null = null;
  private duckingAmount: number = 0; 

  private currentStep: number = 0;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  private tracks: Track[] = [];
  
  private onStepCallback: ((step: number) => void) | null = null;

  constructor() {}

  public async initialize() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // 1. Create Nodes
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    this.masterLimiter = this.audioContext.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1.0;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.001;
    this.masterLimiter.release.value = 0.1;

    // --- PRISM DJ DECK CHAIN ---
    this.prismGain = this.audioContext.createGain();
    this.prismGain.gain.value = 0.8;
    
    this.prismAnalyser = this.audioContext.createAnalyser();
    this.prismAnalyser.fftSize = 2048;

    // --- STEM SEPARATION ENGINE (Refined Crossover) ---
    this.stemSplitterNode = this.audioContext.createGain();
    this.stemSplitterNode.gain.value = 1.0;

    // 1. BASS STEM (Lowpass < 180Hz) - Tighter sub focus
    const bassFilter = this.audioContext.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 180;
    bassFilter.Q.value = 0.8;
    const bassGain = this.audioContext.createGain();
    bassFilter.connect(bassGain);
    bassGain.connect(this.prismGain);
    this.stemNodes.bass = { filter: bassFilter, gain: bassGain };

    // 2. VOX STEM (Bandpass 300Hz - 3.5kHz) - Standard vocal range
    const voxFilter = this.audioContext.createBiquadFilter();
    voxFilter.type = 'bandpass';
    voxFilter.frequency.value = 1200;
    voxFilter.Q.value = 0.8;
    const voxGain = this.audioContext.createGain();
    voxFilter.connect(voxGain);
    voxGain.connect(this.prismGain);
    this.stemNodes.vox = { filter: voxFilter, gain: voxGain };

    // 3. OTHER STEM (Highpass > 3.5kHz) - Air and details
    const otherFilter = this.audioContext.createBiquadFilter();
    otherFilter.type = 'highpass';
    otherFilter.frequency.value = 3500;
    otherFilter.Q.value = 0.7;
    const otherGain = this.audioContext.createGain();
    otherFilter.connect(otherGain);
    otherGain.connect(this.prismGain);
    this.stemNodes.other = { filter: otherFilter, gain: otherGain };

    // 4. DRUMS STEM (Notch + Shelf) - The leftovers
    // Drums occupy the full spectrum, but we notch out the vocal center to separate them
    const drumFilter = this.audioContext.createBiquadFilter();
    drumFilter.type = 'notch';
    drumFilter.frequency.value = 1200; // Notch out vocal center
    drumFilter.Q.value = 1.5;
    
    // Add a low-shelf boost to drums to reclaim kick punch lost by notch overlap
    const drumLowShelf = this.audioContext.createBiquadFilter();
    drumLowShelf.type = 'lowshelf';
    drumLowShelf.frequency.value = 200;
    drumLowShelf.gain.value = 3;

    const drumGain = this.audioContext.createGain();
    
    drumFilter.connect(drumLowShelf);
    drumLowShelf.connect(drumGain);
    drumGain.connect(this.prismGain);
    
    // We store the input filter in the struct so we can route to it
    this.stemNodes.drums = { filter: drumFilter, gain: drumGain };

    // Connect Splitter to all Filters
    this.stemSplitterNode.connect(bassFilter);
    this.stemSplitterNode.connect(voxFilter);
    this.stemSplitterNode.connect(otherFilter);
    this.stemSplitterNode.connect(drumFilter);

    // Final connection to Master Chain
    // --- PRISM EQ & FX ---
    this.prismEqLow = this.audioContext.createBiquadFilter();
    this.prismEqLow.type = 'lowshelf';
    this.prismEqLow.frequency.value = 320;

    this.prismEqMid = this.audioContext.createBiquadFilter();
    this.prismEqMid.type = 'peaking';
    this.prismEqMid.frequency.value = 1000;
    this.prismEqMid.Q.value = 0.5;

    this.prismEqHigh = this.audioContext.createBiquadFilter();
    this.prismEqHigh.type = 'highshelf';
    this.prismEqHigh.frequency.value = 3200;

    this.prismFilter = this.audioContext.createBiquadFilter();
    this.prismFilter.type = 'lowpass';
    this.prismFilter.frequency.value = 22000;

    // --- MASTER FX ---
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 22000;
    this.lowpassFilter.Q.value = 1.0;

    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 10;
    this.highpassFilter.Q.value = 1.0;

    this.bitCrusherShaper = this.audioContext.createWaveShaper();
    this.setCrushAmount(0);

    this.delayNode = this.audioContext.createDelay(5.0);
    this.delayNode.delayTime.value = 0.375;
    this.delayFeedback = this.audioContext.createGain();
    this.delayFeedback.gain.value = 0.4;
    this.delaySendGain = this.audioContext.createGain();
    this.delaySendGain.gain.value = 0;

    this.reverbNode = this.audioContext.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.5, 2.0);
    this.reverbSendGain = this.audioContext.createGain();
    this.reverbSendGain.gain.value = 0;

    // 2. Routing Chain
    if (this.prismEqLow && this.prismEqMid && this.prismEqHigh && this.prismFilter) {
        // Prism Gain (Sum of Stems) -> EQ -> Global Prism Filter -> Analyser -> Master
        this.prismGain.connect(this.prismEqLow);
        this.prismEqLow.connect(this.prismEqMid);
        this.prismEqMid.connect(this.prismEqHigh);
        this.prismEqHigh.connect(this.prismFilter);
        this.prismFilter.connect(this.prismAnalyser);
        this.prismAnalyser.connect(this.masterGain);
    }

    // MASTER ROUTING
    this.masterGain.connect(this.highpassFilter);
    this.highpassFilter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.bitCrusherShaper);
    
    this.bitCrusherShaper.connect(this.masterLimiter);

    this.bitCrusherShaper.connect(this.delaySendGain);
    this.delaySendGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode); 
    this.delayNode.connect(this.masterLimiter);

    this.bitCrusherShaper.connect(this.reverbSendGain);
    this.reverbSendGain.connect(this.reverbNode);
    this.reverbNode.connect(this.masterLimiter);

    this.masterLimiter.connect(this.audioContext.destination);

    // Recording Setup
    this.mediaDest = this.audioContext.createMediaStreamDestination();
    this.masterLimiter.connect(this.mediaDest);

    // Worklet Setup
    const blob = new Blob([METRONOME_WORKLET_CODE], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(blob);

    try {
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletNode = new AudioWorkletNode(this.audioContext, "shadow-core");
      
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === "STEP") {
          this.handleStep(event.data.step);
        }
      };

      const silence = this.audioContext.createGain();
      silence.gain.value = 0;
      this.workletNode.connect(silence);
      silence.connect(this.audioContext.destination);

    } catch (e) {
      console.error("Failed to load Shadow Core Worklet", e);
    }
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
      const sampleRate = this.audioContext!.sampleRate;
      const length = sampleRate * duration;
      const impulse = this.audioContext!.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const n = i;
        const e = Math.pow(1 - n / length, decay);
        left[i] = (Math.random() * 2 - 1) * e;
        right[i] = (Math.random() * 2 - 1) * e;
      }
      return impulse;
  }

  // --- PRISM DECK ---

  public async loadPrismSample(file: File) {
    if (!this.audioContext) await this.initialize();
    if (!this.audioContext) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        this.prismBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log("💎 Prism Sample Loaded:", file.name);
        this.stopPrismPlayback();
        this.prismOffset = 0;
    } catch (e) {
        console.error("Failed to decode audio file", e);
    }
  }

  public togglePrismPlayback() {
      if (this.prismActive) {
          this.pausePrismPlayback();
      } else {
          this.startPrismPlayback();
      }
  }

  public startPrismPlayback(offset?: number) {
      if (!this.audioContext || !this.prismBuffer || !this.stemSplitterNode) return;
      
      if (this.prismSource) {
          try { this.prismSource.stop(); } catch(e) {}
      }

      this.prismSource = this.audioContext.createBufferSource();
      this.prismSource.buffer = this.prismBuffer;
      this.prismSource.playbackRate.value = this.prismPlaybackRate;
      this.prismSource.detune.value = this.prismDetune;
      this.prismSource.loop = this.prismLoop;
      
      // Connect to STEM SPLITTER instead of direct Gain
      this.prismSource.connect(this.stemSplitterNode);
      
      const startOffset = offset !== undefined ? offset : this.prismOffset;
      this.prismStartTime = this.audioContext.currentTime - startOffset;
      
      // Safe start
      const safeOffset = Math.max(0, startOffset);
      const duration = this.prismBuffer.duration;
      
      if (safeOffset < duration) {
          this.prismSource.start(0, safeOffset);
          this.prismActive = true;
      }
      
      this.prismSource.onended = () => {
          // Only handle natural end, not manual stop/loop
          if (!this.prismLoop && !this.stutterActive && this.prismBuffer && Math.abs(this.getPrismTime() - this.prismBuffer.duration) < 0.1) {
             this.prismActive = false;
             this.prismOffset = 0;
          }
      };
  }

  public pausePrismPlayback() {
      if (this.prismSource) {
          try { 
              this.prismSource.stop(); 
              this.prismOffset = (this.audioContext!.currentTime - this.prismStartTime) * this.prismPlaybackRate;
              if (this.prismBuffer) {
                  this.prismOffset = this.prismOffset % this.prismBuffer.duration;
              }
          } catch(e) {}
          this.prismSource = null;
      }
      this.prismActive = false;
  }

  public stopPrismPlayback() {
      if (this.prismSource) {
          try { this.prismSource.stop(); } catch(e) {}
          this.prismSource = null;
      }
      this.prismActive = false;
      this.prismOffset = 0;
      this.rollEngagedTime = 0;
      this.rollOriginalOffset = 0;
  }

  public jumpPrismTo(time: number) {
      const wasPlaying = this.prismActive;
      if (wasPlaying) this.pausePrismPlayback();
      this.prismOffset = time;
      if (wasPlaying) this.startPrismPlayback(time);
  }

  public getPrismTime(): number {
      if (!this.prismActive) return this.prismOffset;
      return (this.audioContext!.currentTime - this.prismStartTime) * this.prismPlaybackRate;
  }

  public getPrismDuration(): number {
      return this.prismBuffer ? this.prismBuffer.duration : 0;
  }

  public updatePrismStem(stem: 'vocals' | 'drums' | 'bass' | 'other', val: number) {
      if (!this.audioContext) return;
      
      // Map 'stem' string to the internal key
      let key: 'vox' | 'drums' | 'bass' | 'other' = 'other';
      if (stem === 'vocals') key = 'vox';
      else if (stem === 'drums') key = 'drums';
      else if (stem === 'bass') key = 'bass';
      
      const node = this.stemNodes[key];
      if (node && node.gain) {
          // Smooth ramp for volume
          node.gain.gain.setTargetAtTime(val, this.audioContext.currentTime, 0.1);
      }
  }

  // --- PRISM EQ & FX ---

  public setPrismEQ(band: 'low' | 'mid' | 'high', value: number) {
      const gain = value; 
      if (!this.audioContext) return;
      const t = this.audioContext.currentTime;
      
      if (band === 'low' && this.prismEqLow) this.prismEqLow.gain.setTargetAtTime(gain, t, 0.1);
      if (band === 'mid' && this.prismEqMid) this.prismEqMid.gain.setTargetAtTime(gain, t, 0.1);
      if (band === 'high' && this.prismEqHigh) this.prismEqHigh.gain.setTargetAtTime(gain, t, 0.1);
  }

  public setPrismFilter(value: number) {
      if (!this.prismFilter || !this.audioContext) return;
      const t = this.audioContext.currentTime;
      
      if (value < -0.1) {
          this.prismFilter.type = 'lowpass';
          const freq = 20000 * Math.pow(0.01, -value);
          this.prismFilter.frequency.setTargetAtTime(Math.max(100, freq), t, 0.1);
      } else if (value > 0.1) {
          this.prismFilter.type = 'highpass';
           const freq = 10 + (10000 * Math.pow(value, 2));
           this.prismFilter.frequency.setTargetAtTime(Math.min(10000, freq), t, 0.1);
      } else {
          this.prismFilter.type = 'lowpass';
          this.prismFilter.frequency.setTargetAtTime(22000, t, 0.1);
      }
  }

  public setPrismParam(param: string, value: number) {
      if (!this.audioContext) return;
      switch(param) {
          case 'rate':
              this.prismPlaybackRate = value;
              if (this.prismSource) this.prismSource.playbackRate.setTargetAtTime(value, this.audioContext.currentTime, 0.1);
              break;
          case 'detune':
              this.prismDetune = value;
              if (this.prismSource) this.prismSource.detune.setTargetAtTime(value, this.audioContext.currentTime, 0.1);
              break;
          case 'volume':
              if (this.prismGain) this.prismGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.1);
              break;
          case 'loop':
              this.prismLoop = value > 0.5;
              if (this.prismSource) this.prismSource.loop = this.prismLoop;
              break;
      }
  }

  // --- PERFORMANCE FX (GLOBAL) ---

  public setMasterFilter(value: number) {
      if (!this.lowpassFilter || !this.highpassFilter || !this.audioContext) return;
      const t = this.audioContext.currentTime;
      const val = Math.max(-1, Math.min(1, value));

      if (val < 0) {
          const freq = 22000 * Math.pow(0.005, -val); 
          this.lowpassFilter.frequency.setTargetAtTime(Math.max(100, freq), t, 0.05);
          this.highpassFilter.frequency.setTargetAtTime(10, t, 0.05); 
      } else {
          const freq = 10 + (15000 * Math.pow(val, 2)); 
          this.highpassFilter.frequency.setTargetAtTime(Math.min(15000, freq), t, 0.05);
          this.lowpassFilter.frequency.setTargetAtTime(22000, t, 0.05); 
      }
  }

  public setXYPad(x: number, y: number) {
      // X = Filter Freq, Y = Resonance + BitCrush
      if (!this.lowpassFilter || !this.highpassFilter || !this.audioContext) return;
      const t = this.audioContext.currentTime;

      // X: Filter Frequency (Low to High)
      // 0.0 = Lowpass 100Hz, 0.5 = Open, 1.0 = Highpass 10000Hz
      const normalizedX = (x * 2) - 1; // -1 to 1
      this.setMasterFilter(normalizedX);

      // Y: Resonance & Destruction
      // 0.0 = Clean, 1.0 = High Q + Bitcrush
      const resonance = y * 20; // 0 to 20
      this.lowpassFilter.Q.setTargetAtTime(Math.max(1, resonance), t, 0.1);
      this.highpassFilter.Q.setTargetAtTime(Math.max(1, resonance), t, 0.1);
      
      // Add bitcrush if Y > 0.5
      const crushAmount = Math.max(0, (y - 0.5) * 2); 
      this.setCrushAmount(crushAmount * 0.5); // Cap at 50% crush for usability
  }

  public setCrushAmount(amount: number) {
      if (!this.bitCrusherShaper) return;
      const k = amount * 100;
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        let x = i * 2 / n_samples - 1;
        if (amount > 0) {
            const steps = 4 + (1 - amount) * 100; 
            x = Math.round(x * steps) / steps;
        }
        if (amount > 0.1) {
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        } else {
            curve[i] = x;
        }
      }
      this.bitCrusherShaper.curve = curve;
  }

  public setDelaySend(amount: number) {
      if (this.delaySendGain && this.audioContext) {
          this.delaySendGain.gain.setTargetAtTime(amount, this.audioContext.currentTime, 0.1);
      }
  }

  public setReverbSend(amount: number) {
      if (this.reverbSendGain && this.audioContext) {
          this.reverbSendGain.gain.setTargetAtTime(amount, this.audioContext.currentTime, 0.1);
      }
  }

  // --- QUANTIZED SLIP MODE (FLUX) ---
  public setStutter(active: boolean, interval: number = 4) {
      // 1. Sequencer Stutter (Steps)
      if (active) {
          if (!this.stutterActive) {
            this.stutterActive = true;
            this.stutterStartStep = this.currentStep; 
            this.stutterCounter = 0;
          }
          this.stutterInterval = Math.max(1, Math.round(interval));
      } else {
          this.stutterActive = false;
      }

      // 2. Prism Audio Stutter (Quantized Loop Roll with SLIP)
      if (this.audioContext && this.prismBuffer && this.prismActive) {
          
          if (!active) {
               // --- SLIP RELEASE: FLUX LOGIC ---
               // Jump to where the track WOULD be if we hadn't looped
               if (this.rollEngagedTime > 0) {
                  const rollDuration = this.audioContext.currentTime - this.rollEngagedTime;
                  // Calculate new offset: Original Position + Duration of the Loop Event
                  const targetOffset = (this.rollOriginalOffset + (rollDuration * this.prismPlaybackRate)) % this.prismBuffer.duration;
                  
                  // Reset Source to target position
                  this.stopPrismPlayback(); 
                  this.startPrismPlayback(targetOffset);
               }
               return;
          }

          if (this.prismSource) {
              // --- ENGAGE: QUANTIZATION LOGIC ---
              const bpm = this.bpm || 120;
              const secPerBeat = 60.0 / bpm;
              const secPer16th = secPerBeat / 4.0;
              
              // Duration of the loop
              const loopDuration = secPer16th * interval;

              let anchor = this.prismSource.loopStart;
              
              // First Engagement: Snap to Grid
              if (this.rollEngagedTime === 0) {
                  this.rollEngagedTime = this.audioContext.currentTime;
                  
                  // Calculate exact current playback position
                  const elapsed = this.audioContext.currentTime - this.prismStartTime;
                  const currentOffset = (elapsed * this.prismPlaybackRate) % this.prismBuffer.duration;
                  
                  this.rollOriginalOffset = currentOffset; // Save for slip calculation

                  // QUANTIZE: Snap `currentOffset` to nearest 16th note grid
                  const grid = secPer16th;
                  const snappedOffset = Math.floor(currentOffset / grid) * grid;

                  anchor = snappedOffset;
              }

              this.prismSource.loop = true;
              this.prismSource.loopStart = anchor;
              this.prismSource.loopEnd = Math.min(this.prismBuffer.duration, anchor + loopDuration);
          }
      }
  }

  public setOutputDevice(deviceId: string) {
      if (!this.audioContext) return;
      try {
          const ctx = this.audioContext as any;
          if (typeof ctx.setSinkId === 'function') {
              ctx.setSinkId(deviceId);
          }
      } catch (e) {
          console.error("Output device routing failed", e);
      }
  }

  public setMasterVolume(val: number) { 
      if (this.masterGain && this.audioContext) this.masterGain.gain.setTargetAtTime(val, this.audioContext.currentTime, 0.1); 
  }
  
  public initMic(deviceId?: string) { /* Stub */ }
  public setMicGain(val: number) { /* Stub */ }
  public setDuckingAmount(val: number) { /* Stub */ }

  public setTracks(tracks: Track[]) { this.tracks = tracks; }
  public setBpm(bpm: number) {
    this.bpm = bpm;
    if (this.delayNode && this.audioContext) {
        const beatTime = 60 / Math.max(1, bpm);
        const delayTime = beatTime * 0.75; 
        this.delayNode.delayTime.setTargetAtTime(delayTime, this.audioContext.currentTime, 0.1);
    }
  }
  public setOnStepCallback(cb: (step: number) => void) { this.onStepCallback = cb; }

  public async play() {
    if (!this.audioContext) await this.initialize();
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
    if (this.isPlaying) return;
    this.isPlaying = true;
  }

  public pause() {
      this.isPlaying = false;
      if (this.audioContext && this.audioContext.state === 'running') this.audioContext.suspend();
  }

  public stop() {
    this.isPlaying = false;
    this.currentStep = 0;
    this.stutterActive = false;
    this.stopPrismPlayback(); 
    if (this.audioContext) {
        this.audioContext.suspend();
        if (this.workletNode) this.workletNode.port.postMessage({ type: "RESET" });
        if (this.onStepCallback) this.onStepCallback(0);
    }
  }
  
  public startRecording(format: 'webm' | 'wav') { 
      if (!this.mediaDest) return;
      const mimeType = format === 'webm' ? 'audio/webm' : 'audio/wav';
      this.audioChunks = [];
      try {
        this.mediaRecorder = new MediaRecorder(this.mediaDest.stream, { mimeType });
        this.mediaRecorder.ondataavailable = (e) => {
           if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.start();
      } catch (e) {
         console.error("MediaRecorder not supported", e);
      }
  }

  public stopRecording(callback: (blob: Blob) => void) {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
              callback(blob);
          };
          this.mediaRecorder.stop();
      }
  }

  private handleStep(rawStep: number) {
    if (!this.isPlaying || !this.audioContext) return;
    
    let effectiveStep = rawStep;
    if (this.stutterActive) {
        const offset = this.stutterCounter % this.stutterInterval;
        effectiveStep = (this.stutterStartStep + offset) % 16;
        this.stutterCounter++;
    } else {
        effectiveStep = rawStep;
        this.stutterCounter = 0;
    }

    this.currentStep = effectiveStep;
    this.scheduleSound(this.currentStep, this.audioContext.currentTime);
    if (this.onStepCallback) this.onStepCallback(this.currentStep);
  }

  private scheduleSound(step: number, time: number) {
    this.tracks.forEach(track => {
      if (track.mute) return;
      if (track.solo) {
          const anySolo = this.tracks.some(t => t.solo);
          if (anySolo && !track.solo) return;
      } else {
          const anySolo = this.tracks.some(t => t.solo);
          if (anySolo) return;
      }
      const stepIndex = step % track.steps.length;
      if (!track.steps[stepIndex]) return;
      const stepData = track.steps[stepIndex];
      if (stepData.active) {
        if (Math.random() <= stepData.probability) {
           this.triggerInstrument(track, time, stepData);
        }
      }
    });
  }
  
  private triggerInstrument(track: Track, time: number, stepData?: SequencerStep) {
    const midiNote = TR8S_NOTE_MAP[track.type];
    
    // Step-based Velocity Scaling
    const stepVelocity = stepData?.velocity ?? 1.0;
    const trackVolume = track.params.volume ?? 0.8;
    const finalVolume = trackVolume * stepVelocity;

    if (midiNote) {
        const velocity = Math.floor(finalVolume * 127);
        phantomProtocol.triggerNote(midiNote, velocity, 9);
    }
    
    if (!this.audioContext || !this.masterGain) return;
    const playTime = Math.max(this.audioContext.currentTime, time + 0.005);
    const panner = this.audioContext.createStereoPanner();
    panner.pan.value = track.pan || 0;
    const volume = this.audioContext.createGain();
    
    volume.gain.value = finalVolume;
    
    volume.connect(panner);
    panner.connect(this.masterGain);

    switch (track.type) {
      case InstrumentType.KICK: this.playKick(playTime, track.params, volume); break;
      case InstrumentType.SNARE: this.playSnare(playTime, track.params, volume); break;
      case InstrumentType.HIHAT_CLOSED: this.playHiHat(playTime, track.params, volume, false); break;
      case InstrumentType.HIHAT_OPEN: this.playHiHat(playTime, track.params, volume, true); break;
      case InstrumentType.BASS_FM: this.playFmSynth(playTime, track.params, volume); break;
      case InstrumentType.TOM_LOW:
      case InstrumentType.TOM_MID:
      case InstrumentType.TOM_HIGH: this.playTom(playTime, track.params, volume, track.type); break;
      case InstrumentType.RIM_SHOT: this.playRim(playTime, track.params, volume); break;
      case InstrumentType.HAND_CLAP: this.playClap(playTime, track.params, volume); break;
      case InstrumentType.CRASH: this.playCrash(playTime, track.params, volume); break;
      case InstrumentType.RIDE: this.playRide(playTime, track.params, volume); break;
      case InstrumentType.LEAD_SQUARE: this.playLeadSquare(playTime, track.params, volume); break;
      case InstrumentType.PAD_SAW: this.playPadSaw(playTime, track.params, volume); break;
      case InstrumentType.PLUCK_SINE: this.playPluckSine(playTime, track.params, volume); break;
      case InstrumentType.ACID_303: this.playAcid303(playTime, track.params, volume); break;
      case InstrumentType.BASS_SUB_808: this.playSub808(playTime, track.params, volume); break;
      case InstrumentType.LEAD_PWM: this.playLeadPwm(playTime, track.params, volume); break;
      case InstrumentType.PAD_CHOIR: this.playPadChoir(playTime, track.params, volume); break;
      case InstrumentType.ARP_PLUCK: this.playArpPluck(playTime, track.params, volume); break;
      case InstrumentType.FX_GLITCH: this.playFxGlitch(playTime, track.params, volume); break;
      case InstrumentType.PAD_ETHEREAL: this.playPadEthereal(playTime, track.params, volume); break;
    }
  }
  
  // --- SYNTH IMPLEMENTATIONS ---

  private playKick(time: number, params: TrackParams, output: AudioNode) {
    const osc = this.audioContext!.createOscillator();
    const gain = this.audioContext!.createGain();
    const filter = this.audioContext!.createBiquadFilter();

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(output);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filterCutoff || 1000, time);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + (params.decay || 0.5));
    
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (params.decay || 0.5));

    osc.start(time);
    osc.stop(time + (params.decay || 0.5));
  }

  private playSnare(time: number, params: TrackParams, output: AudioNode) {
    const bufferSize = this.audioContext!.sampleRate * 2;
    const buffer = this.audioContext!.createBuffer(1, bufferSize, this.audioContext!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioContext!.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.audioContext!.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(params.filterCutoff || 1000, time);
    
    const noiseGain = this.audioContext!.createGain();
    
    const osc = this.audioContext!.createOscillator();
    const oscGain = this.audioContext!.createGain();

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    
    osc.connect(oscGain);
    oscGain.connect(output);

    noiseGain.gain.setValueAtTime(1, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + (params.decay || 0.2));
    
    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
    
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.start(time);
    osc.start(time);
    noise.stop(time + (params.decay || 0.2));
    osc.stop(time + (params.decay || 0.2));
  }

  private playHiHat(time: number, params: TrackParams, output: AudioNode, isOpen: boolean) {
    const bufferSize = this.audioContext!.sampleRate; 
    const buffer = this.audioContext!.createBuffer(1, bufferSize, this.audioContext!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioContext!.createBufferSource();
    noise.buffer = buffer;
    
    const bandpass = this.audioContext!.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(params.filterCutoff || 10000, time);

    const highpass = this.audioContext!.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(7000, time);
    
    const gain = this.audioContext!.createGain();
    
    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(output);
    
    const decay = isOpen ? (params.decay + 0.2) : 0.05;
    
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);
    
    noise.start(time);
    noise.stop(time + decay);
  }

  private playFmSynth(time: number, params: TrackParams, output: AudioNode) {
    const carrier = this.audioContext!.createOscillator();
    const modulator = this.audioContext!.createOscillator();
    const modGain = this.audioContext!.createGain();
    const masterGain = this.audioContext!.createGain();
    const filter = this.audioContext!.createBiquadFilter();

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(output);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filterCutoff || 2000, time);
    filter.Q.value = 5; 

    const freq = params.pitch || 110;
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, time);
    
    modulator.type = 'square';
    modulator.frequency.setValueAtTime(freq * 2, time);
    
    modGain.gain.setValueAtTime(500, time);
    
    masterGain.gain.setValueAtTime(0.5, time);
    masterGain.gain.exponentialRampToValueAtTime(0.01, time + (params.decay || 0.5));
    
    carrier.start(time);
    modulator.start(time);
    carrier.stop(time + (params.decay || 0.5));
    modulator.stop(time + (params.decay || 0.5));
  }

  private playTom(time: number, params: TrackParams, output: AudioNode, type: InstrumentType) {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.connect(gain);
      gain.connect(output);

      let baseFreq = params.pitch || 100;
      if (type === InstrumentType.TOM_LOW) baseFreq = 80;
      if (type === InstrumentType.TOM_MID) baseFreq = 120;
      if (type === InstrumentType.TOM_HIGH) baseFreq = 160;

      osc.frequency.setValueAtTime(baseFreq, time);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, time + 0.3);

      gain.gain.setValueAtTime(1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (params.decay || 0.3));

      osc.start(time);
      osc.stop(time + (params.decay || 0.3));
  }

  private playRim(time: number, params: TrackParams, output: AudioNode) {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.connect(gain);
      gain.connect(output);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(params.pitch * 3 || 800, time);
      
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05); 
      
      osc.start(time);
      osc.stop(time + 0.05);
  }

  private playClap(time: number, params: TrackParams, output: AudioNode) {
      const bufferSize = this.audioContext!.sampleRate * 0.5;
      const buffer = this.audioContext!.createBuffer(1, bufferSize, this.audioContext!.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0; i<bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

      const noise = this.audioContext!.createBufferSource();
      noise.buffer = buffer;
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 1;
      
      const gain = this.audioContext!.createGain();
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      
      const t = time;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + 0.01);
      gain.gain.linearRampToValueAtTime(0, t + 0.02);
      gain.gain.linearRampToValueAtTime(1, t + 0.03);
      gain.gain.linearRampToValueAtTime(0, t + 0.04);
      gain.gain.linearRampToValueAtTime(1, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (params.decay || 0.3));
      
      noise.start(time);
      noise.stop(time + 0.4);
  }

  private playCrash(time: number, params: TrackParams, output: AudioNode) {
      this.playMetallic(time, params, output, 3.0); 
  }

  private playRide(time: number, params: TrackParams, output: AudioNode) {
      this.playMetallic(time, params, output, 1.5, true);
  }

  private playMetallic(time: number, params: TrackParams, output: AudioNode, duration: number, isRide: boolean = false) {
      const count = 4;
      for (let i=0; i<count; i++) {
          const osc = this.audioContext!.createOscillator();
          const gain = this.audioContext!.createGain();
          
          osc.type = 'square';
          const freq = (params.pitch || 300) * (isRide ? 2 : 1) + (Math.random() * 500); 
          osc.frequency.setValueAtTime(freq, time);
          
          const filter = this.audioContext!.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = isRide ? 5000 : 2000;
          
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(output);
          
          gain.gain.setValueAtTime(0.2 / count, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
          
          osc.start(time);
          osc.stop(time + duration);
      }
  }

  // --- MELODIC SYNTHS ---

  private playLeadSquare(time: number, params: TrackParams, output: AudioNode) {
      const osc1 = this.audioContext!.createOscillator();
      const osc2 = this.audioContext!.createOscillator();
      const filter = this.audioContext!.createBiquadFilter();
      const gain = this.audioContext!.createGain();

      osc1.type = 'square';
      osc2.type = 'square';

      const freq = params.pitch || 440;
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq + (freq * 0.01), time); // Detune

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(params.filterCutoff || 3000, time);
      filter.Q.value = 1.0;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(output);

      const decay = params.decay || 0.4;
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + decay);
      osc2.stop(time + decay);
  }

  private playPadSaw(time: number, params: TrackParams, output: AudioNode) {
      const osc1 = this.audioContext!.createOscillator();
      const osc2 = this.audioContext!.createOscillator();
      const filter = this.audioContext!.createBiquadFilter();
      const gain = this.audioContext!.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';

      const freq = params.pitch || 220;
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.005, time); // Subtle detune

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(params.filterCutoff || 800, time);
      filter.frequency.linearRampToValueAtTime((params.filterCutoff || 800) + 500, time + 1.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(output);

      const decay = params.decay || 2.0;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.4, time + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + decay);
      osc2.stop(time + decay);
  }

  private playPluckSine(time: number, params: TrackParams, output: AudioNode) {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(params.pitch || 660, time);

      osc.connect(gain);
      gain.connect(output);

      const decay = params.decay || 0.3;
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      osc.start(time);
      osc.stop(time + decay);
  }

  private playAcid303(time: number, params: TrackParams, output: AudioNode) {
      const osc = this.audioContext!.createOscillator();
      const filter = this.audioContext!.createBiquadFilter();
      const gain = this.audioContext!.createGain();

      osc.type = (params.tone > 0.5) ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(params.pitch || 110, time);

      filter.type = 'lowpass';
      filter.Q.value = 15; 
      
      const cutoff = params.filterCutoff || 1000;
      filter.frequency.setValueAtTime(cutoff, time);
      
      const envAmount = 2000 * (params.tone || 0.5);
      filter.frequency.linearRampToValueAtTime(cutoff + envAmount, time + 0.05);
      filter.frequency.exponentialRampToValueAtTime(cutoff, time + (params.decay || 0.3));

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(output);

      gain.gain.setValueAtTime(0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (params.decay || 0.3));

      osc.start(time);
      osc.stop(time + (params.decay || 0.3));
  }

  // --- V2 INSTRUMENTS ---
  
  private playSub808(time: number, params: TrackParams, output: AudioNode) {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      const saturation = this.audioContext!.createWaveShaper();

      // Saturation Curve
      const k = 100;
      const n = 44100;
      const curve = new Float32Array(n);
      for(let i=0; i<n; i++) {
          const x = i*2/n - 1;
          curve[i] = (3+k)*x*20*Math.PI/180 / (Math.PI + k*Math.abs(x));
      }
      saturation.curve = curve;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(params.pitch || 45, time);
      osc.frequency.exponentialRampToValueAtTime((params.pitch || 45) * 0.8, time + 0.5);

      osc.connect(saturation);
      saturation.connect(gain);
      gain.connect(output);

      gain.gain.setValueAtTime(0.9, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (params.decay || 0.8));

      osc.start(time);
      osc.stop(time + (params.decay || 0.8));
  }

  private playLeadPwm(time: number, params: TrackParams, output: AudioNode) {
      this.playLeadSquare(time, {...params, pitch: (params.pitch || 440) * 1.01}, output);
  }

  private playPadChoir(time: number, params: TrackParams, output: AudioNode) {
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600; 
      filter.Q.value = 2;
      
      const auxGain = this.audioContext!.createGain();
      auxGain.connect(filter);
      filter.connect(output);
      
      this.playPadSaw(time, params, auxGain);
  }

  private playArpPluck(time: number, params: TrackParams, output: AudioNode) {
      this.playPluckSine(time, {...params, pitch: (params.pitch || 880)}, output);
  }

  private playFxGlitch(time: number, params: TrackParams, output: AudioNode) {
      const bufferSize = this.audioContext!.sampleRate * 0.5;
      const buffer = this.audioContext!.createBuffer(1, bufferSize, this.audioContext!.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0; i<bufferSize; i++) data[i] = (Math.random() * 2 - 1);
      
      const noise = this.audioContext!.createBufferSource();
      noise.buffer = buffer;
      const gain = this.audioContext!.createGain();
      
      noise.playbackRate.value = 0.5 + Math.random();
      
      noise.connect(gain);
      gain.connect(output);
      
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      
      noise.start(time);
      noise.stop(time + 0.2);
  }

  // --- V3 INSTRUMENTS ---
  private playPadEthereal(time: number, params: TrackParams, output: AudioNode) {
      const osc1 = this.audioContext!.createOscillator();
      const osc2 = this.audioContext!.createOscillator();
      const osc3 = this.audioContext!.createOscillator(); // Sub
      
      const gain = this.audioContext!.createGain();
      const filter = this.audioContext!.createBiquadFilter();
      
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';
      
      const freq = params.pitch || 300;
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 1.5; // 5th
      osc3.frequency.value = freq * 0.5; // Octave down
      
      // Detune
      osc1.detune.value = 10;
      osc2.detune.value = -10;
      
      filter.type = 'lowpass';
      filter.frequency.value = params.filterCutoff || 2000;
      filter.Q.value = 0.5;
      
      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      
      const decay = params.decay || 3.0;
      
      // Slow Attack
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.5, time + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
      
      osc1.start(time);
      osc2.start(time);
      osc3.start(time);
      osc1.stop(time + decay);
      osc2.stop(time + decay);
      osc3.stop(time + decay);
  }
}

export const shadowCore = new ShadowCore();
