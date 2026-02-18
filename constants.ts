
import { InstrumentType, SequencerState, Track, TrackParams, Pattern } from './types';

export const INITIAL_BPM = 120;
export const STEPS_PER_BAR = 16;
export const SCHEDULER_LOOKAHEAD = 25.0; // milliseconds
export const SCHEDULE_AHEAD_TIME = 0.1; // seconds

// Helper to create step objects
const s = (active: boolean, probability: number = 1.0, velocity: number = 0.8) => ({ active, probability, velocity });

// Default Parameter Configurations for each Instrument Type
export const INSTRUMENT_SETTINGS: Record<InstrumentType, { name: string; params: TrackParams }> = {
  [InstrumentType.KICK]: { 
      name: 'KICK_CORE', 
      params: { volume: 0.9, decay: 0.5, pitch: 50, tone: 0.2, filterCutoff: 1000 } 
  },
  [InstrumentType.SNARE]: { 
      name: 'SNARE_VOID', 
      params: { volume: 0.8, decay: 0.2, pitch: 200, tone: 0.5, filterCutoff: 3000 } 
  },
  [InstrumentType.HIHAT_CLOSED]: { 
      name: 'HAT_CLOSED', 
      params: { volume: 0.7, decay: 0.05, pitch: 1000, tone: 0.8, filterCutoff: 8000 } 
  },
  [InstrumentType.HIHAT_OPEN]: { 
      name: 'HAT_OPEN', 
      params: { volume: 0.7, decay: 0.3, pitch: 1000, tone: 0.8, filterCutoff: 8000 } 
  },
  [InstrumentType.TOM_LOW]: { 
      name: 'TOM_SEISMIC', 
      params: { volume: 0.8, decay: 0.3, pitch: 80, tone: 0.5, filterCutoff: 1500 } 
  },
  [InstrumentType.TOM_MID]: { 
      name: 'TOM_BODY', 
      params: { volume: 0.8, decay: 0.3, pitch: 120, tone: 0.5, filterCutoff: 1500 } 
  },
  [InstrumentType.TOM_HIGH]: { 
      name: 'TOM_TRANSIENT', 
      params: { volume: 0.8, decay: 0.3, pitch: 160, tone: 0.5, filterCutoff: 1500 } 
  },
  [InstrumentType.RIM_SHOT]: { 
      name: 'RIM_CLICK', 
      params: { volume: 0.8, decay: 0.1, pitch: 400, tone: 0.8, filterCutoff: 2500 } 
  },
  [InstrumentType.HAND_CLAP]: { 
      name: 'CLAP_STACK', 
      params: { volume: 0.8, decay: 0.2, pitch: 150, tone: 0.5, filterCutoff: 1500 } 
  },
  [InstrumentType.CRASH]: { 
      name: 'CRASH_IMPACT', 
      params: { volume: 0.8, decay: 1.5, pitch: 300, tone: 0.8, filterCutoff: 5000 } 
  },
  [InstrumentType.RIDE]: { 
      name: 'RIDE_CYBER', 
      params: { volume: 0.7, decay: 2.0, pitch: 600, tone: 0.8, filterCutoff: 6000 } 
  },
  [InstrumentType.BASS_FM]: { 
      name: 'BASS_REESE', 
      params: { volume: 0.8, decay: 0.4, pitch: 55, tone: 0.7, filterCutoff: 800 } 
  },
  // --- V1 Synths ---
  [InstrumentType.LEAD_SQUARE]: {
      name: 'LEAD_DETUNE',
      params: { volume: 0.7, decay: 0.3, pitch: 440, tone: 0.5, filterCutoff: 4000 }
  },
  [InstrumentType.PAD_SAW]: {
      name: 'PAD_DARK',
      params: { volume: 0.6, decay: 2.5, pitch: 220, tone: 0.3, filterCutoff: 1200 }
  },
  [InstrumentType.PLUCK_SINE]: {
      name: 'PLUCK_GLASS',
      params: { volume: 0.8, decay: 0.4, pitch: 660, tone: 0.2, filterCutoff: 6000 }
  },
  [InstrumentType.ACID_303]: {
      name: 'ACID_TB',
      params: { volume: 0.8, decay: 0.3, pitch: 110, tone: 0.8, filterCutoff: 800 }
  },
  // --- V2 Synths ---
  [InstrumentType.BASS_SUB_808]: {
      name: 'SUB_TITAN',
      params: { volume: 0.9, decay: 0.8, pitch: 40, tone: 0.1, filterCutoff: 400 }
  },
  [InstrumentType.LEAD_PWM]: {
      name: 'LEAD_CYBER',
      params: { volume: 0.7, decay: 0.4, pitch: 440, tone: 0.5, filterCutoff: 5000 }
  },
  [InstrumentType.PAD_CHOIR]: {
      name: 'PAD_ANGEL',
      params: { volume: 0.6, decay: 2.0, pitch: 220, tone: 0.8, filterCutoff: 2000 }
  },
  [InstrumentType.ARP_PLUCK]: {
      name: 'ARP_SYNTH',
      params: { volume: 0.8, decay: 0.2, pitch: 880, tone: 0.5, filterCutoff: 3000 }
  },
  [InstrumentType.FX_GLITCH]: {
      name: 'FX_DATABEND',
      params: { volume: 0.8, decay: 0.5, pitch: 1000, tone: 0.9, filterCutoff: 8000 }
  },
  // --- V3 Synths ---
  [InstrumentType.PAD_ETHEREAL]: {
      name: 'PAD_ETHER',
      params: { volume: 0.7, decay: 3.0, pitch: 330, tone: 0.4, filterCutoff: 1800 }
  }
};

const DEFAULT_PARAMS = {
    [InstrumentType.KICK]: { volume: 0.9, decay: 0.5, pitch: 50, tone: 0.2, filterCutoff: 1000 },
};

// --- PATTERN GENERATION HELPERS ---

const createTrack = (name: string, type: InstrumentType, steps: boolean[]): Track => ({
    id: `trk_${type}_${Date.now()}_${Math.random()}`,
    name,
    type,
    steps: steps.map(act => s(act)),
    mute: false,
    solo: false,
    pan: 0,
    params: { ...INSTRUMENT_SETTINGS[type].params }
});

const PATTERN_A_TRACKS: Track[] = [
    createTrack('KICK_CORE', InstrumentType.KICK, [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]),
    createTrack('SNARE_VOID', InstrumentType.SNARE, [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]),
    createTrack('HAT_CLOSED', InstrumentType.HIHAT_CLOSED, [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true]),
    createTrack('BASS_REESE', InstrumentType.BASS_FM, [false, false, false, true, false, false, true, false, false, false, false, true, false, true, false, false])
];

const PATTERN_B_TRACKS: Track[] = [
    createTrack('KICK_CORE', InstrumentType.KICK, [true, false, false, true, false, false, true, false, false, true, false, false, true, false, true, false]),
    createTrack('SNARE_VOID', InstrumentType.SNARE, [false, false, true, false, false, false, true, false, false, false, true, false, false, true, false, true]),
    createTrack('HAT_CLOSED', InstrumentType.HIHAT_CLOSED, [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]),
    createTrack('BASS_REESE', InstrumentType.BASS_FM, [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false])
];

const PATTERN_C_TRACKS: Track[] = [
    createTrack('KICK_CORE', InstrumentType.KICK, [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false]),
    createTrack('SNARE_VOID', InstrumentType.SNARE, [false, false, false, false, true, false, false, true, false, false, false, false, true, false, true, true]),
    createTrack('HAT_OPEN', InstrumentType.HIHAT_OPEN, [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false]),
    createTrack('ACID_TB', InstrumentType.ACID_303, [true, true, true, false, true, true, false, true, true, true, false, true, true, false, true, true])
];

const PATTERN_D_TRACKS: Track[] = [
    createTrack('KICK_CORE', InstrumentType.KICK, [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true]),
    createTrack('CRASH_IMPACT', InstrumentType.CRASH, [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false]),
    createTrack('RIDE_CYBER', InstrumentType.RIDE, [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]),
    createTrack('FX_DATABEND', InstrumentType.FX_GLITCH, [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true])
];

export const INITIAL_STATE: SequencerState = {
  bpm: INITIAL_BPM,
  swing: 0,
  playing: false,
  currentStep: 0,
  activePatternId: 'SECTOR_A',
  nextPatternId: null,
  patterns: {
      'SECTOR_A': { id: 'SECTOR_A', name: 'ALPHA_LOOP', tracks: PATTERN_A_TRACKS },
      'SECTOR_B': { id: 'SECTOR_B', name: 'BETA_BREAK', tracks: PATTERN_B_TRACKS },
      'SECTOR_C': { id: 'SECTOR_C', name: 'GAMMA_ACID', tracks: PATTERN_C_TRACKS },
      'SECTOR_D': { id: 'SECTOR_D', name: 'DELTA_RUSH', tracks: PATTERN_D_TRACKS },
  },
  tracks: PATTERN_A_TRACKS,
  timeSignature: 16
};
