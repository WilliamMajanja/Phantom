
import { InstrumentType } from '../types';

// TR-8S / General MIDI Drum Map
export const TR8S_NOTE_MAP: Record<string, number> = {
    [InstrumentType.KICK]: 36,        // C1
    [InstrumentType.SNARE]: 38,       // D1
    [InstrumentType.HIHAT_CLOSED]: 42,// F#1
    [InstrumentType.HIHAT_OPEN]: 46,  // A#1
    [InstrumentType.TOM_LOW]: 41,     // F1
    [InstrumentType.TOM_MID]: 45,     // A1
    [InstrumentType.TOM_HIGH]: 50,    // D2
    [InstrumentType.RIM_SHOT]: 37,    // C#1
    [InstrumentType.HAND_CLAP]: 39,   // D#1
    [InstrumentType.CRASH]: 49,       // C#2
    [InstrumentType.RIDE]: 51,        // D#2
    [InstrumentType.BASS_FM]: 0,      // Synth
    [InstrumentType.LEAD_SQUARE]: 0,  // Synth
    [InstrumentType.PAD_SAW]: 0,      // Synth
    [InstrumentType.PLUCK_SINE]: 0,   // Synth
    [InstrumentType.ACID_303]: 0      // Synth
};

// Parameter Mapping to CCs (Simplified for demonstration)
// Assuming a custom mapping or standard macro controls on the hardware
export const TR8S_CC_MAP: Record<string, Record<string, number>> = {
    [InstrumentType.KICK]: { pitch: 20, decay: 21, tone: 22, filterCutoff: 23 },
    [InstrumentType.SNARE]: { pitch: 24, decay: 25, tone: 26, filterCutoff: 27 },
    [InstrumentType.HIHAT_CLOSED]: { pitch: 28, decay: 29, tone: 30 },
    [InstrumentType.HIHAT_OPEN]: { pitch: 31, decay: 32, tone: 33 },
    [InstrumentType.HAND_CLAP]: { pitch: 34, decay: 35, tone: 36 },
    [InstrumentType.TOM_LOW]: { pitch: 37, decay: 38 },
    [InstrumentType.TOM_MID]: { pitch: 39, decay: 40 },
    [InstrumentType.TOM_HIGH]: { pitch: 41, decay: 42 },
};

export class MidiService {
    private midiAccess: MIDIAccess | null = null;
    private output: MIDIOutput | null = null;

    async initialize(): Promise<boolean> {
        if (!navigator.requestMIDIAccess) {
            console.warn("WebMIDI is not supported in this browser.");
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            const outputs = Array.from(this.midiAccess.outputs.values());
            
            // Priority: Look for "VirMIDI" or "Midi Through" (Linux/Pi Virtual Cables)
            // This ensures we connect to the OS loopback driver, not a random plugged-in keyboard.
            const virtualPort = outputs.find(o => 
                o.name.toLowerCase().includes('virmidi') || 
                o.name.toLowerCase().includes('through') ||
                o.name.toLowerCase().includes('loop') ||
                o.name.toLowerCase().includes('tr-8s') // Prioritize hardware if connected
            );
            
            if (virtualPort) {
                this.output = virtualPort;
                console.log(`🎹 MIDI Connected (Virtual/HW): ${this.output.name}`);
            } else if (outputs.length > 0) {
                this.output = outputs[0];
                console.log(`🎹 MIDI Connected (Default): ${this.output.name}`);
            } else {
                console.warn("⚠️ No MIDI outputs found. Is 'snd-virmidi' loaded?");
                return false;
            }
            
            return true;
        } catch (err) {
            console.error("MIDI Connection Failed", err);
            return false;
        }
    }

    /**
     * Sends a Control Change (CC) message.
     * @param controller - The CC number (0-127)
     * @param value - The value (0-127)
     * @param channel - MIDI Channel (0-15)
     */
    sendCC(controller: number, value: number, channel: number = 0) {
        if (!this.output) return;
        const status = 0xB0 | channel; // 0xB0 is CC for Ch 1
        const clampedValue = Math.max(0, Math.min(127, Math.floor(value)));
        this.output.send([status, controller, clampedValue]);
    }

    /**
     * Triggers a specific Note On/Off event.
     */
    triggerNote(note: number, velocity: number = 127, channel: number = 0) {
        if (!this.output) return;
        const noteOn = 0x90 | channel;
        const noteOff = 0x80 | channel;
        
        this.output.send([noteOn, note, velocity]);
        // Auto note-off after 100ms
        setTimeout(() => {
            this.output?.send([noteOff, note, 0]);
        }, 100);
    }

    // --- TR-8S INTEGRATION ---

    /**
     * Sends a parameter update for the TR-8S
     * @param instrumentType The LyraFlex instrument
     * @param param The parameter name (pitch, decay, tone, etc)
     * @param value Normalized value 0.0 to 1.0 (or absolute Hz for filter)
     */
    sendTR8SParam(instrumentType: InstrumentType, param: string, value: number) {
        const ccMap = TR8S_CC_MAP[instrumentType];
        if (!ccMap || !ccMap[param]) return;

        const ccNum = ccMap[param];
        
        // Normalize Logic
        let midiVal = 0;
        if (param === 'filterCutoff') {
             // Map Hz (50-15000) to 0-127 roughly
             midiVal = Math.min(127, Math.max(0, (Math.log10(value) - 1.7) * 40)); 
        } else if (param === 'pitch') {
             // Arbitrary mapping for demo
             midiVal = Math.min(127, Math.max(0, value / 10));
        } else {
             // Standard 0-1 mapping
             midiVal = Math.floor(value * 127);
        }

        // Send on Channel 10 (Index 9)
        this.sendCC(ccNum, midiVal, 9);
    }

    // --- BROADCAST PRESETS ---

    /**
     * Triggers Sample Deck 1 (Station ID Drop)
     * Mapped to Note 60 (Middle C)
     */
    triggerStationID() {
        this.triggerNote(60, 127);
    }

    /**
     * Controls the Master Filter (QuickEffectRack1)
     * Mapped to CC 20
     * @param value - 0 to 100 (UI Range)
     */
    setTransmissionFilter(value: number) {
        // Map 0-100 to 0-127
        const midiValue = (value / 100) * 127;
        this.sendCC(20, midiValue);
    }

    /**
     * Emergency Fade: Fader down, Talkover On
     */
    emergencyFade() {
        this.sendCC(50, 0);   // Fader Down
        this.sendCC(51, 127); // Talkover On
    }
}

export const midiService = new MidiService();
