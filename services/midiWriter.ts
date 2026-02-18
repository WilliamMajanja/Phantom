
import { SequencerState, InstrumentType } from '../types';
import { TR8S_NOTE_MAP } from './phantomProtocol';

/**
 * PHANTOM MIDI WRITER
 * Generates Standard MIDI File (SMF) Format 0.
 * Optimized for TR-8S/6S Pattern Import.
 */

// Helper: Convert number to Variable Length Quantity (buffer array)
const toVLQ = (val: number): number[] => {
  let buffer: number[] = [];
  let v = val;
  do {
    let byte = v & 0x7F;
    v >>= 7;
    if (buffer.length > 0) byte |= 0x80;
    buffer.unshift(byte);
  } while (v > 0);
  return buffer;
};

// Helper: Convert 32-bit int to big-endian bytes
const toBytes = (val: number, bytes: number): number[] => {
  const res = [];
  for (let i = bytes - 1; i >= 0; i--) {
    res.push((val >> (8 * i)) & 0xFF);
  }
  return res;
};

// Helper: String to char codes
const strToBytes = (str: string): number[] => str.split('').map(c => c.charCodeAt(0));

export const generateMidiFile = (state: SequencerState): Blob => {
  const TICKS_PER_BEAT = 480; // Standard resolution
  const STEPS_PER_BAR = state.timeSignature || 16;
  const TICKS_PER_STEP = TICKS_PER_BEAT / 4; // Assuming 16th notes

  // 1. COLLECT EVENTS
  // We need to flatten the sequencer grid into a linear list of MIDI events
  interface MidiEvent {
    tick: number;
    type: 'on' | 'off';
    note: number;
    velocity: number;
  }

  const events: MidiEvent[] = [];

  state.tracks.forEach(track => {
    // Skip muted tracks? No, export everything for hardware.
    const note = TR8S_NOTE_MAP[track.type];
    if (!note) return;

    track.steps.forEach((step, index) => {
      if (step.active) {
        const tickOn = index * TICKS_PER_STEP;
        const tickOff = tickOn + (TICKS_PER_STEP * 0.9); // Gate length

        events.push({ tick: tickOn, type: 'on', note: note, velocity: 100 });
        events.push({ tick: tickOff, type: 'off', note: note, velocity: 0 });
      }
    });
  });

  // Sort events by time
  events.sort((a, b) => a.tick - b.tick);

  // 2. GENERATE TRACK DATA (MTrk)
  let trackData: number[] = [];
  let lastTick = 0;

  // Add Tempo Meta Event (FF 51 03 tttttt)
  // Microseconds per quarter note = 60,000,000 / BPM
  const mpqn = Math.floor(60000000 / state.bpm);
  trackData.push(0x00); // Delta time 0
  trackData.push(0xFF, 0x51, 0x03, ...toBytes(mpqn, 3));

  // Add Note Events
  events.forEach(event => {
    const delta = event.tick - lastTick;
    trackData.push(...toVLQ(delta));
    
    // Status Byte (Note On ch10 = 0x99, Note Off ch10 = 0x89)
    // TR-8S usually expects drums on Channel 10 (0x09 low nibble)
    const status = event.type === 'on' ? 0x99 : 0x89;
    
    trackData.push(status, event.note, event.velocity);
    lastTick = event.tick;
  });

  // End of Track Meta Event (FF 2F 00)
  trackData.push(0x00, 0xFF, 0x2F, 0x00);

  // 3. GENERATE HEADER (MThd)
  const header: number[] = [
    ...strToBytes('MThd'),
    ...toBytes(6, 4), // Header size
    ...toBytes(0, 2), // Format 0 (Single Track)
    ...toBytes(1, 2), // Number of tracks
    ...toBytes(TICKS_PER_BEAT, 2) // Time division
  ];

  // 4. COMBINE
  const trackHeader = [
    ...strToBytes('MTrk'),
    ...toBytes(trackData.length, 4)
  ];

  const fileData = new Uint8Array([...header, ...trackHeader, ...trackData]);
  
  return new Blob([fileData], { type: 'audio/midi' });
};
