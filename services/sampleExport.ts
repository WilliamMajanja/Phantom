import { InstrumentType, SequencerState, Track } from '../types';

const MPC_NOTE_MAP: Partial<Record<InstrumentType, number>> = {
  [InstrumentType.KICK]: 36,
  [InstrumentType.SNARE]: 38,
  [InstrumentType.HAND_CLAP]: 39,
  [InstrumentType.HIHAT_CLOSED]: 42,
  [InstrumentType.HIHAT_OPEN]: 46,
  [InstrumentType.TOM_LOW]: 43,
  [InstrumentType.TOM_MID]: 47,
  [InstrumentType.TOM_HIGH]: 50,
  [InstrumentType.RIM_SHOT]: 37,
  [InstrumentType.CRASH]: 49,
  [InstrumentType.RIDE]: 51,
};

const sampleName = (track: Track) => `${track.name.replace(/[^a-z0-9-_]/gi, '_')}.wav`;

export const createMpcProgram = (state: SequencerState) => ({
  format: 'AKAI_MPC_PROGRAM_MANIFEST',
  version: 1,
  bpm: state.bpm,
  sequence: state.patterns[state.activePatternId]?.name || state.activePatternId,
  pads: state.tracks.map((track, index) => ({
    pad: `A${String(index + 1).padStart(2, '0')}`,
    note: MPC_NOTE_MAP[track.type] ?? 36 + index,
    name: track.name,
    sample: sampleName(track),
    mode: 'one_shot',
    mute: track.mute,
    solo: track.solo,
    pan: track.pan,
    volume: track.params.volume,
    filterCutoff: track.params.filterCutoff,
    steps: track.steps.map(step => (step.active ? 1 : 0)),
  })),
});

export const createSeratoSlabManifest = (state: SequencerState) => ({
  format: 'SERATO_SLAB_MANIFEST',
  version: 1,
  bpm: state.bpm,
  crate: state.patterns[state.activePatternId]?.name || 'PHANTOM_SESSION',
  slabs: state.tracks.map((track, index) => ({
    slot: index + 1,
    title: track.name,
    file: sampleName(track),
    tags: ['PHANTOM', track.type, state.activePatternId],
    cue_points: track.steps
      .map((step, stepIndex) => step.active ? ({
        name: `STEP_${String(stepIndex + 1).padStart(2, '0')}`,
        beat: stepIndex + 1,
        velocity: step.velocity,
        probability: step.probability,
      }) : null)
      .filter(Boolean),
  })),
});

export const createSampleManifestBlob = (manifest: unknown) => new Blob([JSON.stringify(manifest, null, 2)], {
  type: 'application/json',
});
