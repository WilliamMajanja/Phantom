
import { SequencerState, InstrumentType } from '../types';

// THE GHOST BRIDGE
// Interface for the local Ollama-backed PiNet node.
const DEFAULT_STEP_PROBABILITY = 1.0;
const DEFAULT_ACTIVE_VELOCITY = 0.8;
const DEFAULT_INACTIVE_VELOCITY = 0.0;

export interface BridgeResponse {
    success: boolean;
    message: string;
    updates?: Partial<SequencerState>;
}

export const interpretSignal = async (
  userPrompt: string, 
  currentState: SequencerState
): Promise<BridgeResponse> => {
  try {
    const response = await fetch('/api/ghost/summon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, bpm: currentState.bpm })
    });
    
    const data = await response.json();
    if (data.success && data.pattern) {
        const updates = parseGeneratedState(data.pattern, currentState);
        return {
            success: true,
            message: "LOCAL_GHOST_ONLINE // PATTERN_SUMMONED",
            updates: updates
        };
    }

    return {
        success: false,
        message: data.error || "LOCAL_GHOST_UNAVAILABLE"
    };
  } catch (e) {
      console.error("Local Ghost unavailable:", e);
      return {
          success: false,
          message: "LOCAL_GHOST_UNAVAILABLE"
      };
  }
};

// --- HELPER: Parse AI Output ---
const parseGeneratedState = (args: any, currentState: SequencerState): Partial<SequencerState> => {
    const knownTypes = new Set(Object.values(InstrumentType));
    const toStep = (step: any) => {
        if (typeof step === 'boolean' || typeof step === 'number') {
            return {
                active: Boolean(step),
                probability: DEFAULT_STEP_PROBABILITY,
                velocity: Boolean(step) ? DEFAULT_ACTIVE_VELOCITY : DEFAULT_INACTIVE_VELOCITY
            };
        }
        return {
            active: Boolean(step?.active),
            probability: clampNumber(step?.probability, DEFAULT_STEP_PROBABILITY, 0, 1),
            velocity: clampNumber(step?.velocity, step?.active ? DEFAULT_ACTIVE_VELOCITY : DEFAULT_INACTIVE_VELOCITY, 0, 1)
        };
    };

    const sourceTracks = Array.isArray(args?.tracks) ? args.tracks : [];
    const newTracks = sourceTracks.slice(0, 12).map((t: any, index: number) => {
        const requestedType = String(t?.type || '').toLowerCase() as InstrumentType;
        const type = knownTypes.has(requestedType) ? requestedType : currentState.tracks[index]?.type ?? InstrumentType.KICK;
        const rawSteps = Array.isArray(t?.steps) ? t.steps : [];
        const normalizedSteps = Array.from({ length: currentState.timeSignature || 16 }, (_, stepIndex) => toStep(rawSteps[stepIndex]));
        return {
        id: `trk_phantom_${Date.now()}_${index}`,
        name: String(t?.name || type).toUpperCase().slice(0, 32),
        type,
        steps: normalizedSteps,
        mute: false,
        solo: false,
        pan: clampNumber(t?.pan, 0, -1, 1),
        params: {
        volume: clampNumber(t?.params?.volume, 0.8, 0, 1),
        decay: clampNumber(t?.params?.decay, 0.5, 0.01, 4),
        pitch: clampNumber(t?.params?.pitch, 100, 20, 4000),
        tone: clampNumber(t?.params?.tone, 0.5, 0, 1),
        filterCutoff: clampNumber(t?.params?.filterCutoff, 2000, 20, 20000)
        }
    };
    });

    return {
        bpm: clampNumber(args?.bpm, currentState.bpm, 40, 240),
        swing: clampNumber(args?.swing, currentState.swing, 0, 1),
        tracks: newTracks.length > 0 ? newTracks : currentState.tracks
    };
};

const clampNumber = (value: any, fallback: number, min: number, max: number): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
};
