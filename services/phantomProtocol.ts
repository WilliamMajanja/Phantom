
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
    // V1 Synths (Mapped to generic notes if triggering chromatic samples)
    [InstrumentType.BASS_FM]: 0,     
    [InstrumentType.LEAD_SQUARE]: 0, 
    [InstrumentType.PAD_SAW]: 0,     
    [InstrumentType.PLUCK_SINE]: 0,  
    [InstrumentType.ACID_303]: 0,
    // V2 Synths
    [InstrumentType.BASS_SUB_808]: 0,
    [InstrumentType.LEAD_PWM]: 0,
    [InstrumentType.PAD_CHOIR]: 0,
    [InstrumentType.ARP_PLUCK]: 0,
    [InstrumentType.FX_GLITCH]: 0
};

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

export class PhantomProtocol {
    private midiAccess: MIDIAccess | null = null;
    private output: MIDIOutput | null = null;
    private isInitialized: boolean = false;

    async initialize(): Promise<boolean> {
        if (this.isInitialized && this.output) return true;

        if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
            console.warn("WebMIDI is not supported in this environment.");
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            
            // Listen for connection changes
            this.midiAccess.onstatechange = (e) => {
                console.log(`🎹 MIDI Device State Change: ${e.port.name} is ${e.port.state}`);
                if (e.port.type === 'output') {
                    this.scanOutputs();
                }
            };

            const success = this.scanOutputs();
            this.isInitialized = success;
            return success;
        } catch (err) {
            console.error("MIDI Access Request Failed", err);
            return false;
        }
    }

    private scanOutputs(): boolean {
        if (!this.midiAccess) return false;

        const outputs = Array.from(this.midiAccess.outputs.values());
        
        // Priority mapping for PHANTOM hardware or virtual ports
        const virtualPort = outputs.find(o => 
            o.name.toLowerCase().includes('virmidi') || 
            o.name.toLowerCase().includes('through') ||
            o.name.toLowerCase().includes('loop') ||
            o.name.toLowerCase().includes('tr-8s') ||
            o.name.toLowerCase().includes('phantom')
        );
        
        if (virtualPort) {
            this.output = virtualPort;
            console.log(`🎹 PHANTOM Protocol Linked: ${this.output.name}`);
            return true;
        } else if (outputs.length > 0) {
            this.output = outputs[0];
            console.log(`🎹 PHANTOM Protocol Default: ${this.output.name}`);
            return true;
        } else {
            this.output = null;
            console.warn("⚠️ No MIDI outputs found.");
            return false;
        }
    }

    sendCC(controller: number, value: number, channel: number = 0) {
        if (!this.output || this.output.state !== 'connected') return;
        try {
            const status = 0xB0 | (channel & 0xF); 
            const clampedValue = Math.max(0, Math.min(127, Math.floor(value)));
            this.output.send([status, controller, clampedValue]);
        } catch (e) {
            console.error("MIDI CC Send Failed", e);
        }
    }

    triggerNote(note: number, velocity: number = 127, channel: number = 0) {
        if (!this.output || this.output.state !== 'connected') return;
        try {
            const status = 0x90 | (channel & 0xF);
            const noteOff = 0x80 | (channel & 0xF);
            const clampedVel = Math.max(0, Math.min(127, Math.floor(velocity)));
            
            this.output.send([status, note, clampedVel]);
            setTimeout(() => {
                if (this.output && this.output.state === 'connected') {
                    this.output.send([noteOff, note, 0]);
                }
            }, 100);
        } catch (e) {
            console.error("MIDI Note Trigger Failed", e);
        }
    }

    sendTR8SParam(instrumentType: InstrumentType, param: string, value: number) {
        const ccMap = TR8S_CC_MAP[instrumentType];
        if (!ccMap || !ccMap[param]) return;

        const ccNum = ccMap[param];
        
        let midiVal = 0;
        if (param === 'filterCutoff') {
             midiVal = Math.min(127, Math.max(0, (Math.log10(value) - 1.7) * 40)); 
        } else if (param === 'pitch') {
             midiVal = Math.min(127, Math.max(0, value / 10));
        } else {
             midiVal = Math.floor(value * 127);
        }

        this.sendCC(ccNum, midiVal, 9);
    }

    triggerStationID() {
        this.triggerNote(60, 127);
    }

    setTransmissionFilter(value: number) {
        const midiValue = (value / 100) * 127;
        this.sendCC(20, midiValue);
    }
    
    setFrequency(mhz: number) {
        // Map 87.5-108.0 MHz to 0-127 MIDI CC for simulation/readout
        const min = 87.5;
        const max = 108.0;
        const normalized = (mhz - min) / (max - min);
        const midiVal = Math.floor(normalized * 127);
        // Using CC 30 (undefined) on Channel 10 (Control)
        this.sendCC(30, midiVal, 9);
    }

    emergencyFade() {
        this.sendCC(50, 0);   
        this.sendCC(51, 127); 
    }
}

export const phantomProtocol = new PhantomProtocol();
