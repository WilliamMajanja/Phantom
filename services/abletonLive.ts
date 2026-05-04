import { InstrumentType, SequencerState, Track } from '../types';

const TICKS_PER_BEAT = 480;
const MAX_MIDI_CHANNEL = 15;
const SYNTH_CHANNEL_COUNT = 8;
const MIN_GATE_TICKS = 12;
const MAX_MIDI_TEXT_LENGTH = 64;

const ABLETON_NOTE_MAP: Record<InstrumentType, number> = {
  [InstrumentType.KICK]: 36,
  [InstrumentType.SNARE]: 38,
  [InstrumentType.HIHAT_CLOSED]: 42,
  [InstrumentType.HIHAT_OPEN]: 46,
  [InstrumentType.TOM_LOW]: 43,
  [InstrumentType.TOM_MID]: 47,
  [InstrumentType.TOM_HIGH]: 50,
  [InstrumentType.RIM_SHOT]: 37,
  [InstrumentType.HAND_CLAP]: 39,
  [InstrumentType.CRASH]: 49,
  [InstrumentType.RIDE]: 51,
  [InstrumentType.BASS_FM]: 36,
  [InstrumentType.BASS_SUB_808]: 36,
  [InstrumentType.ACID_303]: 48,
  [InstrumentType.LEAD_SQUARE]: 60,
  [InstrumentType.LEAD_PWM]: 64,
  [InstrumentType.PAD_SAW]: 48,
  [InstrumentType.PAD_CHOIR]: 55,
  [InstrumentType.PAD_ETHEREAL]: 52,
  [InstrumentType.PLUCK_SINE]: 72,
  [InstrumentType.ARP_PLUCK]: 76,
  [InstrumentType.FX_GLITCH]: 84,
};

const ENGINE_DESCRIPTIONS = [
  {
    id: 'link-sync',
    name: 'Ableton Link Sync',
    description: 'Keeps PHANTOM clip launches, stutter rolls, and Ghost Bridge mutations aligned to Live bar boundaries.',
  },
  {
    id: 'session-clip-launcher',
    name: 'Session Clip Launcher',
    description: 'Maps PHANTOM sectors to Live Session View scenes with quantized launch metadata.',
  },
  {
    id: 'macro-bridge',
    name: 'Macro Bridge',
    description: 'Assigns eight Live rack macros to PHANTOM filter, crush, delay, reverb, swing, Prism rate, Prism detune, and stem blend.',
  },
  {
    id: 'ghost-clip-generator',
    name: 'Ghost Clip Generator',
    description: 'Marks AI-generated patterns as Live-ready MIDI clips for fast capture, mutation, and arrangement.',
  },
  {
    id: 'stem-resampler',
    name: 'Prism Stem Resampler',
    description: 'Exports stem intent and resampling lanes for drums, bass, vocals, and other material.',
  },
];

export const ABLETON_LIVE_MACROS = [
  { macro: 1, name: 'M_FILTER', source: 'Performance Core filter' },
  { macro: 2, name: 'DATA_ROT', source: 'Performance Core bit crush' },
  { macro: 3, name: 'DUB_DELAY', source: 'Performance Core delay send' },
  { macro: 4, name: 'DARK_VERB', source: 'Performance Core reverb send' },
  { macro: 5, name: 'SWING', source: 'Sequencer groove' },
  { macro: 6, name: 'PRISM_RATE', source: 'Prism Deck playback rate' },
  { macro: 7, name: 'PRISM_DETUNE', source: 'Prism Deck detune' },
  { macro: 8, name: 'STEM_BLEND', source: 'Prism stem balance' },
];

interface MidiEvent {
  tick: number;
  data: number[];
}

const toVLQ = (value: number): number[] => {
  let buffer = value & 0x7f;
  const bytes: number[] = [];

  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }

  return bytes;
};

const toBytes = (value: number, bytes: number): number[] => {
  const result: number[] = [];
  for (let index = bytes - 1; index >= 0; index--) {
    result.push((value >> (8 * index)) & 0xff);
  }
  return result;
};

const strToBytes = (value: string): number[] => Array.from(value).map((char) => char.charCodeAt(0) & 0xff);

const metaText = (type: number, value: string): number[] => {
  const bytes = strToBytes(value.slice(0, MAX_MIDI_TEXT_LENGTH));
  return [0x00, 0xff, type, ...toVLQ(bytes.length), ...bytes];
};

const buildTrackChunk = (name: string, events: MidiEvent[]): number[] => {
  const trackData: number[] = [...metaText(0x03, name)];
  let lastTick = 0;

  events
    .sort((a, b) => a.tick - b.tick)
    .forEach((event) => {
      const delta = Math.max(0, Math.round(event.tick - lastTick));
      trackData.push(...toVLQ(delta), ...event.data);
      lastTick = event.tick;
    });

  trackData.push(0x00, 0xff, 0x2f, 0x00);

  return [...strToBytes('MTrk'), ...toBytes(trackData.length, 4), ...trackData];
};

const getTrackChannel = (track: Track, index: number) => {
  if (
    track.type === InstrumentType.KICK ||
    track.type === InstrumentType.SNARE ||
    track.type === InstrumentType.HIHAT_CLOSED ||
    track.type === InstrumentType.HIHAT_OPEN ||
    track.type === InstrumentType.TOM_LOW ||
    track.type === InstrumentType.TOM_MID ||
    track.type === InstrumentType.TOM_HIGH ||
    track.type === InstrumentType.RIM_SHOT ||
    track.type === InstrumentType.HAND_CLAP ||
    track.type === InstrumentType.CRASH ||
    track.type === InstrumentType.RIDE ||
    track.type === InstrumentType.FX_GLITCH
  ) {
    return 9;
  }

  return Math.min(MAX_MIDI_CHANNEL, index % SYNTH_CHANNEL_COUNT);
};

const collectTrackEvents = (track: Track, index: number, stepsPerBar: number): MidiEvent[] => {
  const events: MidiEvent[] = [];
  const ticksPerStep = TICKS_PER_BEAT / (stepsPerBar / 4);
  const channel = getTrackChannel(track, index);
  const note = ABLETON_NOTE_MAP[track.type] ?? 60;
  const gate = Math.max(MIN_GATE_TICKS, ticksPerStep * 0.9);

  track.steps.forEach((step, stepIndex) => {
    if (!step.active) return;

    const tick = Math.round(stepIndex * ticksPerStep);
    const velocity = Math.max(1, Math.min(127, Math.round((step.velocity || 0.8) * (track.params.volume || 0.8) * 127)));

    events.push({ tick, data: [0x90 | channel, note, velocity] });
    events.push({ tick: Math.round(tick + gate), data: [0x80 | channel, note, 0] });
  });

  return events;
};

export const generateAbletonLiveMidiFile = (state: SequencerState): Blob => {
  const stepsPerBar = state.timeSignature || 16;
  const mpqn = Math.floor(60_000_000 / state.bpm);
  const header = [
    ...strToBytes('MThd'),
    ...toBytes(6, 4),
    ...toBytes(1, 2),
    ...toBytes(state.tracks.length + 1, 2),
    ...toBytes(TICKS_PER_BEAT, 2),
  ];

  const tempoTrack = buildTrackChunk('PHANTOM Live Tempo', [
    { tick: 0, data: [0xff, 0x51, 0x03, ...toBytes(mpqn, 3)] },
    { tick: 0, data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] },
  ]);

  const trackChunks = state.tracks.map((track, index) =>
    buildTrackChunk(`PHANTOM ${track.name}`, collectTrackEvents(track, index, stepsPerBar))
  );

  return new Blob([new Uint8Array([...header, ...tempoTrack, ...trackChunks.flat()])], { type: 'audio/midi' });
};

export const createAbletonLivePluginManifest = (state: SequencerState) => ({
  format: 'PHANTOM_ABLETON_LIVE_PLUGIN_MANIFEST',
  version: 1,
  generatedAt: new Date().toISOString(),
  plugin: {
    name: 'PHANTOM Live Bridge',
    target: 'Ableton Live Suite / Max for Live',
    mode: 'Web MIDI + Max for Live companion device',
    midiPort: 'PHANTOM Live Bridge',
    recommendedTrackSetup: ['PHANTOM Drum Rack', 'PHANTOM Synth Rack', 'PHANTOM Prism Resampler', 'PHANTOM Ghost Capture'],
  },
  transport: {
    bpm: state.bpm,
    swing: state.swing,
    launchQuantization: '1 Bar',
    abletonLink: true,
  },
  engines: ENGINE_DESCRIPTIONS,
  macros: ABLETON_LIVE_MACROS,
  scenes: Object.values(state.patterns).map((pattern, sceneIndex) => ({
    scene: sceneIndex + 1,
    id: pattern.id,
    name: pattern.name,
    launch: pattern.id === state.activePatternId ? 'active' : pattern.id === state.nextPatternId ? 'queued' : 'available',
    clips: pattern.tracks.map((track, trackIndex) => ({
      slot: trackIndex + 1,
      name: track.name,
      type: track.type,
      channel: getTrackChannel(track, trackIndex) + 1,
      note: ABLETON_NOTE_MAP[track.type] ?? 60,
      pan: track.pan,
      volume: track.params.volume,
      mute: track.mute,
      solo: track.solo,
      steps: track.steps.map((step, stepIndex) => ({
        step: stepIndex + 1,
        active: step.active,
        velocity: step.velocity,
        probability: step.probability,
      })),
    })),
  })),
  install: [
    'Create an IAC/virtual MIDI port named "PHANTOM Live Bridge".',
    'Load the PHANTOM web app in a Max for Live WebView or browser next to Live.',
    'Enable the virtual MIDI port for Track and Remote input in Live preferences.',
    'Import the PHANTOM Live MIDI file into Session View.',
    'Use this manifest to map macros and scene names in the companion device.',
  ],
});

export const createAbletonLiveManifestBlob = (state: SequencerState): Blob =>
  new Blob([JSON.stringify(createAbletonLivePluginManifest(state), null, 2)], { type: 'application/json' });

export const getAbletonLiveEngines = () => ENGINE_DESCRIPTIONS;
