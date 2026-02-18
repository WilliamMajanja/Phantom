
export interface SequencerStep {
  active: boolean;
  accent?: boolean;
  probability: number; // 0.0 to 1.0
  velocity: number; // 0.0 to 1.0
}

export enum InstrumentType {
  KICK = 'kick',
  SNARE = 'snare',
  HIHAT_CLOSED = 'hihat_closed',
  HIHAT_OPEN = 'hihat_open',
  BASS_FM = 'bass_fm',
  TOM_LOW = 'tom_low',
  TOM_MID = 'tom_mid',
  TOM_HIGH = 'tom_high',
  RIM_SHOT = 'rim_shot',
  HAND_CLAP = 'hand_clap',
  CRASH = 'crash',
  RIDE = 'ride',
  // Melodic Types V1
  LEAD_SQUARE = 'lead_square',
  PAD_SAW = 'pad_saw',
  PLUCK_SINE = 'pluck_sine',
  ACID_303 = 'acid_303',
  // Melodic Types V2
  BASS_SUB_808 = 'bass_sub_808',
  LEAD_PWM = 'lead_pwm',
  PAD_CHOIR = 'pad_choir',
  ARP_PLUCK = 'arp_pluck',
  FX_GLITCH = 'fx_glitch',
  // V3 Instruments
  PAD_ETHEREAL = 'pad_ethereal'
}

export interface TrackParams {
  volume: number; // 0.0 to 1.0
  decay: number;
  pitch: number;
  tone: number;
  filterCutoff: number; // Frequency in Hz
}

export interface Track {
  id: string;
  name: string;
  type: InstrumentType;
  steps: SequencerStep[]; // Array of 16 steps
  mute: boolean;
  solo: boolean;
  pan: number; // -1.0 to 1.0
  params: TrackParams;
}

export interface Pattern {
    id: string;
    name: string;
    tracks: Track[];
}

export interface SequencerState {
  bpm: number;
  swing: number; // 0.0 to 1.0
  playing: boolean;
  currentStep: number;
  activePatternId: string;
  nextPatternId: string | null; // For Ableton-style queuing
  patterns: Record<string, Pattern>; // The Session View Grid
  tracks: Track[]; // Cache of currently active tracks
  timeSignature: number; // Steps per bar (default 16)
}

export interface TelemetryData {
  cpuTemp: number;
  npuLoad: number;
  pcieLaneUsage: number;
  memoryUsage: number;
}

export interface ProvenanceRecord {
  hash: string;
  timestamp: number;
  blockHeight: number;
  signature: string;
}

export interface MinimaTransaction {
  txId: string;
  timestamp: string;
  txn: {
    inputs: any[];
    outputs: any[];
    state: Record<string, string>; // Minima State Variables (0-255)
  };
}

export interface PrismState {
  active: boolean;
  stems: {
    vocals: number;
    drums: number;
    bass: number;
    other: number;
  };
  drumIsolation: boolean;
}

export interface HiveState {
  active: boolean;
  role: 'MASTER' | 'SLAVE';
  rssi: number; // Signal strength -120 to 0
  peers: number;
  latency: number; // ms
}

declare global {
  interface Window {
    MDS: {
      cmd: (command: string, callback: (resp: any) => void) => void;
      init: (callback: (msg: any) => void) => void;
      log: (msg: string) => void;
    };
  }
}
