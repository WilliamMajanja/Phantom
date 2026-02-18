import { GoogleGenAI, FunctionDeclaration, Type, Tool, Content } from '@google/genai';
import { SequencerState, InstrumentType } from '../types';

// IMPORTANT: process.env.API_KEY is handled externally.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Phase 2 Tool Definition
const updateSequencerTool: FunctionDeclaration = {
  name: 'update_sequencer_state',
  description: 'Updates the LyraFlex sequencer state based on the user\'s musical intent. Use this to change BPM, add instruments, or modify patterns.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      bpm: {
        type: Type.NUMBER,
        description: 'The tempo in beats per minute (e.g., 120-140 for Techno).',
      },
      swing: {
        type: Type.NUMBER,
        description: 'Swing amount from 0.0 (rigid) to 0.7 (heavy groove).',
      },
      tracks: {
        type: Type.ARRAY,
        description: 'List of tracks to update or create.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Name of the track' },
            type: { 
              type: Type.STRING, 
              enum: Object.values(InstrumentType), 
              description: 'The specific sound engine to load.' 
            },
            steps: {
              type: Type.ARRAY,
              description: 'Array of 16 step objects.',
              items: { 
                type: Type.OBJECT,
                properties: {
                  active: { type: Type.BOOLEAN },
                  probability: { type: Type.NUMBER, description: '0.0 to 1.0' }
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
            pan: { type: Type.NUMBER, description: '-1.0 (Left) to 1.0 (Right)' }
          },
          required: ['name', 'type', 'steps', 'params']
        }
      }
    },
    required: ['bpm', 'tracks']
  }
};

const tools: Tool[] = [{ functionDeclarations: [updateSequencerTool] }];

export const interpretPrompt = async (
  userPrompt: string, 
  currentState: SequencerState
): Promise<Partial<SequencerState> | null> => {
  
  const model = 'gemini-3-flash-preview';

  // Context Injection: Prepare the history
  // We strip out heavy objects to keep the token count reasonable if needed, 
  // but for Flash models, sending the full JSON is fine.
  const contextString = JSON.stringify({
    bpm: currentState.bpm,
    swing: currentState.swing,
    tracks: currentState.tracks.map(t => ({
        name: t.name,
        type: t.type,
        steps: t.steps.map(s => s.active ? 1 : 0), // Simplified for context to save tokens, AI infers pattern
        pan: t.pan
    }))
  });

  const history: Content[] = [
    {
      role: 'user',
      parts: [{ text: `Current System State: ${contextString}` }]
    },
    {
      role: 'model',
      parts: [{ text: "Understood. I have the current sequencer state in context and am ready to modify it." }]
    }
  ];

  try {
    const chat = ai.chats.create({
      model,
      config: {
        tools: tools,
        temperature: 0.5, // Lower temperature for more deterministic tool use
      },
      history: history
    });

    const result = await chat.sendMessage({ message: userPrompt });
    const functionCalls = result.functionCalls;
    
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === 'update_sequencer_state') {
        const args = call.args as any;
        
        console.log("⚡ Neural Bridge: Executing State Change...");
        console.log(`-> Set BPM to: ${args.bpm}`);
        
        const newTracks = args.tracks.map((t: any, index: number) => ({
          id: `trk_gen_${Date.now()}_${index}`,
          name: t.name,
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
      }
    }
    
    console.warn("AI did not trigger the sequencer tool.");
    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};