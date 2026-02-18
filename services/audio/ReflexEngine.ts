
import { METRONOME_WORKLET_CODE } from './worklet';
import { InstrumentType, Track, TrackParams } from '../../types';
import { midiService, TR8S_NOTE_MAP } from '../midiService';

export class ReflexEngine {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private currentStep: number = 0;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  private tracks: Track[] = [];
  
  // Callback to update UI state
  private onStepCallback: ((step: number) => void) | null = null;

  constructor() {
    // Singleton initialization logic could go here if needed
  }

  public async initialize() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const blob = new Blob([METRONOME_WORKLET_CODE], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(blob);

    try {
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletNode = new AudioWorkletNode(this.audioContext, "reflex-sequencer");
      
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
      console.error("Failed to load Reflex Sequencer Worklet", e);
    }
  }

  public setTracks(tracks: Track[]) {
    this.tracks = tracks;
  }

  public setBpm(bpm: number) {
    this.bpm = bpm;
    if (this.workletNode && this.audioContext) {
      const bpmParam = this.workletNode.parameters.get('bpm');
      if (bpmParam) {
        bpmParam.cancelScheduledValues(this.audioContext.currentTime);
        bpmParam.linearRampToValueAtTime(this.bpm, this.audioContext.currentTime + 0.1);
      }
    }
  }

  public setOnStepCallback(cb: (step: number) => void) {
    this.onStepCallback = cb;
  }

  public async start() {
    if (!this.audioContext) await this.initialize();
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();

    this.isPlaying = true;
    
    if (this.workletNode) {
       this.workletNode.port.postMessage({ type: "RESET" });
       this.setBpm(this.bpm);
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.audioContext) {
        this.audioContext.suspend();
    }
  }
  
  public async resume() {
      if (this.audioContext) {
          await this.audioContext.resume();
          this.isPlaying = true;
      }
  }

  private handleStep(step: number) {
    if (!this.audioContext) return;

    this.currentStep = step;
    this.scheduleSound(this.currentStep, this.audioContext.currentTime);

    if (this.onStepCallback) {
      this.onStepCallback(this.currentStep);
    }
  }

  private scheduleSound(step: number, time: number) {
    this.tracks.forEach(track => {
      if (track.mute) return;
      if (track.solo) {
          // Check if ANY track is soloed. If so, only play solo tracks.
          const anySolo = this.tracks.some(t => t.solo);
          if (anySolo && !track.solo) return;
      } else {
          const anySolo = this.tracks.some(t => t.solo);
          if (anySolo) return;
      }

      // Handle variable length sequences (time signature)
      const stepIndex = step % track.steps.length;
      if (!track.steps[stepIndex]) return;

      const stepData = track.steps[stepIndex];
      
      if (stepData.active) {
        if (Math.random() <= stepData.probability) {
           this.triggerInstrument(track, time);
        }
      }
    });
  }

  // --- DSP SYNTHESIS SECTION ---
  private triggerInstrument(track: Track, time: number) {
    // 1. TRIGGER MIDI (TR-8S)
    const midiNote = TR8S_NOTE_MAP[track.type];
    if (midiNote) {
        const velocity = Math.floor((track.params.volume ?? 0.8) * 127);
        // Send Note On to Channel 10 (Index 9)
        midiService.triggerNote(midiNote, velocity, 9);
    }

    // 2. TRIGGER INTERNAL AUDIO
    if (!this.audioContext) return;
    
    const playTime = Math.max(this.audioContext.currentTime, time + 0.005);
    
    // Pan Node Integration
    const panner = this.audioContext.createStereoPanner();
    panner.pan.value = track.pan || 0;
    
    // Volume Control
    const volume = this.audioContext.createGain();
    volume.gain.value = track.params.volume ?? 0.8;
    
    volume.connect(panner);
    panner.connect(this.audioContext.destination);

    switch (track.type) {
      case InstrumentType.KICK:
        this.playKick(playTime, track.params, volume);
        break;
      case InstrumentType.SNARE:
        this.playSnare(playTime, track.params, volume);
        break;
      case InstrumentType.HIHAT_CLOSED:
        this.playHiHat(playTime, track.params, volume, false);
        break;
      case InstrumentType.HIHAT_OPEN:
        this.playHiHat(playTime, track.params, volume, true);
        break;
      case InstrumentType.BASS_FM:
        this.playFmSynth(playTime, track.params, volume);
        break;
      case InstrumentType.TOM_LOW:
      case InstrumentType.TOM_MID:
      case InstrumentType.TOM_HIGH:
        this.playTom(playTime, track.params, volume, track.type);
        break;
      case InstrumentType.RIM_SHOT:
        this.playRim(playTime, track.params, volume);
        break;
      case InstrumentType.HAND_CLAP:
        this.playClap(playTime, track.params, volume);
        break;
      case InstrumentType.CRASH:
        this.playCrash(playTime, track.params, volume);
        break;
      case InstrumentType.RIDE:
        this.playRide(playTime, track.params, volume);
        break;
      // New Synths
      case InstrumentType.LEAD_SQUARE:
        this.playLeadSquare(playTime, track.params, volume);
        break;
      case InstrumentType.PAD_SAW:
        this.playPadSaw(playTime, track.params, volume);
        break;
      case InstrumentType.PLUCK_SINE:
        this.playPluckSine(playTime, track.params, volume);
        break;
      case InstrumentType.ACID_303:
        this.playAcid303(playTime, track.params, volume);
        break;
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
    // Noise Part
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
    
    // Tonal Part (Body)
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
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // Very short
      
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
      
      // Clap Envelope (Multiple bursts)
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
      // White noise + multiple square oscillators
      this.playMetallic(time, params, output, 3.0); // Long decay
  }

  private playRide(time: number, params: TrackParams, output: AudioNode) {
      // Higher pitch, FM ring
      this.playMetallic(time, params, output, 1.5, true);
  }

  private playMetallic(time: number, params: TrackParams, output: AudioNode, duration: number, isRide: boolean = false) {
      const count = 4;
      for (let i=0; i<count; i++) {
          const osc = this.audioContext!.createOscillator();
          const gain = this.audioContext!.createGain();
          
          osc.type = 'square';
          // Dissonant cluster
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

  // --- NEW MELODIC SYNTHS ---

  private playLeadSquare(time: number, params: TrackParams, output: AudioNode) {
      // Two slightly detuned square waves
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
      // Slight filter movement
      filter.frequency.linearRampToValueAtTime((params.filterCutoff || 800) + 500, time + 1.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(output);

      const decay = params.decay || 2.0;
      // Slow attack
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

      // Switchable waveform based on Tone? Default to Saw
      osc.type = (params.tone > 0.5) ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(params.pitch || 110, time);

      // The Classic Acid Filter
      filter.type = 'lowpass';
      filter.Q.value = 15; // High Resonance
      
      const cutoff = params.filterCutoff || 1000;
      filter.frequency.setValueAtTime(cutoff, time);
      
      // Envelope modulation on Filter
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
}

export const reflexEngine = new ReflexEngine();
