
import { GoogleGenAI, FunctionDeclaration, Type, Tool, Content } from '@google/genai';
import { SequencerState, InstrumentType } from '../types';

// THE GHOST BRIDGE
// Interface for the Gemini 1.5 Flash Model with Local Fallback

const API_KEY = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    } catch (e) {
        console.warn("Ghost Bridge: API Key invalid, defaulting to local mode.");
    }
}

const updateSequencerTool: FunctionDeclaration = {
  name: 'summon_pattern',
  description: 'Summons a new audio pattern into the Shadow Core based on abstract intent.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      bpm: { type: Type.NUMBER, description: 'Tempo (BPM)' },
      swing: { type: Type.NUMBER, description: 'Groove/Swing (0.0-1.0)' },
      tracks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            type: { type: Type.STRING, enum: Object.values(InstrumentType) },
            steps: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                  active: { type: Type.BOOLEAN },
                  probability: { type: Type.NUMBER }
                },
                required: ['active', 'probability']
              }
            },
            params: {
              type: Type.OBJECT,
              properties: {
                decay: { type: Type.NUMBER },
                pitch: { type: Type.NUMBER },
                tone: { type: Type.NUMBER },
                filterCutoff: { type: Type.NUMBER }
              },
              required: ['decay', 'pitch', 'tone', 'filterCutoff']
            },
            pan: { type: Type.NUMBER }
          },
          required: ['name', 'type', 'steps', 'params']
        }
      }
    },
    required: ['bpm', 'tracks']
  }
};

const tools: Tool[] = [{ functionDeclarations: [updateSequencerTool] }];

export interface BridgeResponse {
    success: boolean;
    message: string;
    updates?: Partial<SequencerState>;
}

export const interpretSignal = async (
  userPrompt: string, 
  currentState: SequencerState
): Promise<BridgeResponse> => {
  
  // 1. CLOUD PROTOCOL (Gemini)
  if (ai && API_KEY) {
    try {
      const model = 'gemini-3-flash-preview';
      
      // Lightweight Context
      const contextString = JSON.stringify({
        bpm: currentState.bpm,
        swing: currentState.swing,
        activePattern: currentState.activePatternId,
        patternName: currentState.patterns[currentState.activePatternId]?.name,
        tracks: currentState.tracks.map(t => ({ 
            name: t.name, 
            type: t.type,
            activeSteps: t.steps.filter(s => s.active).length
        }))
      });

      const history: Content[] = [
        {
          role: 'user',
          parts: [{ text: `SYSTEM_STATUS: ${contextString}\nINSTRUCTION: Initialize Ghost Protocol.` }]
        },
        {
          role: 'model',
          parts: [{ text: "GHOST_BRIDGE_ONLINE. AWAITING_SIGNAL." }]
        }
      ];

      const systemInstruction = `
        You are the Ghost in the Machine, an AI music composer for the Phantom workstation.
        
        PROTOCOL:
        1. If the user asks for music/beat/pattern or uses commands like /GENERATE, /REMIX, /MUTATE, /EVOLVE, use 'summon_pattern'.
        2. If the user uses /CLEAR, use 'summon_pattern' with all steps set to active: false.
        3. If the user asks a question or chats, reply textually.
        
        COMMAND SEMANTICS:
        - /GENERATE: Create a completely new pattern from scratch.
        - /REMIX: Keep the current instrumentation but change the rhythms significantly.
        - /MUTATE: Make subtle changes to the current pattern (add/remove a few steps).
        - /EVOLVE: Gradually increase complexity or intensity.
        - /CLEAR: Wipe the sequencer.
        
        AESTHETIC:
        Favor dark, industrial, techno, and cybernetic themes. 
        Speak briefly and enigmatically. Use technical jargon like "RECONFIGURING_OSCILLATORS", "BIT_CRUSHING_SIGNAL_PATH", "SYNCHRONIZING_HIVE_NODES".
      `;

      const chat = ai.chats.create({
        model,
        config: {
          tools: tools,
          temperature: 0.6,
          systemInstruction: systemInstruction
        },
        history: history
      });

      const result = await chat.sendMessage({ message: userPrompt });
      const functionCalls = result.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'summon_pattern') {
          const args = call.args as any;
          const updates = parseGeneratedState(args, currentState);
          return {
              success: true,
              message: `PROTOCOL_EXECUTED // RECONFIGURED_${updates.tracks?.length}_MODULES`,
              updates: updates
          };
        }
      }
      
      if (result.text) {
          return { success: true, message: result.text };
      }
    } catch (e) {
      console.warn("Ghost Bridge: Cloud Signal Lost. Switching to Local Node.");
    }
  }

  // 2. LOCAL PROTOCOL (Ollama / AirLLM)
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
  } catch (e) {
      console.error("Local Ghost Error:", e);
  }

  // 3. HEURISTIC FALLBACK
  const localUpdates = generateLocalPattern(userPrompt, currentState);
  return {
      success: true,
      message: "SIGNAL_WEAK // FALLBACK_TO_HEURISTIC_GENERATOR",
      updates: localUpdates
  };
};

// --- HELPER: Parse Gemini Output ---
const parseGeneratedState = (args: any, currentState: SequencerState): Partial<SequencerState> => {
    const newTracks = args.tracks.map((t: any, index: number) => ({
        id: `trk_phantom_${Date.now()}_${index}`,
        name: t.name.toUpperCase(),
        type: t.type as InstrumentType,
        steps: t.steps.map((s: any) => ({
        active: s.active,
        probability: s.probability ?? 1.0
        })),
        mute: false,
        solo: false,
        pan: t.pan ?? 0,
        params: {
        decay: t.params?.decay ?? 0.5,
        pitch: t.params?.pitch ?? 100,
        tone: t.params?.tone ?? 0.5,
        filterCutoff: t.params?.filterCutoff ?? 2000
        }
    }));

    return {
        bpm: args.bpm,
        swing: args.swing ?? currentState.swing,
        tracks: newTracks
    };
};

// --- HELPER: Local Heuristic Engine ---
const generateLocalPattern = (prompt: string, state: SequencerState): Partial<SequencerState> => {
    const p = prompt.toLowerCase();
    let bpm = state.bpm;
    
    // 1. Analyze Intent
    if (p.includes("techno") || p.includes("industrial")) bpm = 135;
    if (p.includes("house")) bpm = 124;
    if (p.includes("dnb") || p.includes("jungle")) bpm = 174;
    if (p.includes("hip hop") || p.includes("trap")) bpm = 140; 
    if (p.includes("slow") || p.includes("downtempo")) bpm = 90;
    if (p.includes("fast")) bpm = 145;

    // 2. Modify Tracks
    const newTracks = state.tracks.map(track => {
        const newTrack = { ...track, steps: [...track.steps] };
        
        // Reset
        if (p.includes("clear") || p.includes("reset") || p.includes("empty")) {
            newTrack.steps = newTrack.steps.map(s => ({...s, active: false}));
            return newTrack;
        }

        // Kick Patterns
        if (track.type === InstrumentType.KICK) {
            if (p.includes("4/4") || p.includes("techno") || p.includes("house") || p.includes("trance")) {
                newTrack.steps = newTrack.steps.map((s, i) => ({...s, active: i % 4 === 0}));
            } else if (p.includes("break") || p.includes("dnb")) {
                newTrack.steps = newTrack.steps.map(s => ({...s, active: false}));
                [0, 10].forEach(i => { if(newTrack.steps[i]) newTrack.steps[i].active = true; });
            }
        }

        // HiHat Patterns
        if (track.type === InstrumentType.HIHAT_CLOSED) {
             if (p.includes("techno") || p.includes("house")) {
                 newTrack.steps = newTrack.steps.map((s, i) => ({...s, active: i % 2 === 0})); // Offbeats often handled by open hat, this puts on 8ths
                 if (p.includes("16") || p.includes("driving")) {
                    newTrack.steps = newTrack.steps.map(s => ({...s, active: true}));
                 }
             }
        }
        
        // Snare/Clap Patterns
        if (track.type === InstrumentType.SNARE || track.type === InstrumentType.HAND_CLAP) {
            if (p.includes("techno") || p.includes("house")) {
                newTrack.steps = newTrack.steps.map(s => ({...s, active: false}));
                [4, 12].forEach(i => { if(newTrack.steps[i]) newTrack.steps[i].active = true; });
            } else if (p.includes("trap") || p.includes("hip hop")) {
                newTrack.steps = newTrack.steps.map(s => ({...s, active: false}));
                if(newTrack.steps[8]) newTrack.steps[8].active = true; // Half time feel
            }
        }

        return newTrack;
    });

    return { bpm, tracks: newTracks };
};
