

import React from 'react';
import { InstrumentType } from '../types';

interface AddTrackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: InstrumentType) => void;
}

const AddTrackModal: React.FC<AddTrackModalProps> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    const categories = {
        'KINETIC_DRUMS': [
            { type: InstrumentType.KICK, label: 'KICK_CORE', desc: 'Low-frequency impact driver.' },
            { type: InstrumentType.SNARE, label: 'SNARE_VOID', desc: 'White noise burst with tonal snap.' },
            { type: InstrumentType.TOM_LOW, label: 'TOM_SEISMIC', desc: 'Sub-bass tom resonance.' },
            { type: InstrumentType.TOM_MID, label: 'TOM_BODY', desc: 'Mid-range rhythmic pulse.' },
            { type: InstrumentType.TOM_HIGH, label: 'TOM_TRANSIENT', desc: 'High-attack percussive marker.' },
        ],
        'HIGH_FREQ_ALLOY': [
            { type: InstrumentType.HIHAT_CLOSED, label: 'HAT_CLOSED', desc: 'Short metallic transient.' },
            { type: InstrumentType.HIHAT_OPEN, label: 'HAT_OPEN', desc: 'Sustained alloy decay.' },
            { type: InstrumentType.CRASH, label: 'CRASH_IMPACT', desc: 'Full spectrum noise wash.' },
            { type: InstrumentType.RIDE, label: 'RIDE_CYBER', desc: 'Ping-based rhythm keeper.' },
        ],
        'SYNTHESIS_ENGINES': [
            { type: InstrumentType.BASS_FM, label: 'BASS_REESE', desc: 'FM-modulated sub-bass growl.' },
            { type: InstrumentType.ACID_303, label: 'ACID_TB', desc: 'Resonant low-pass filter sweep.' },
            { type: InstrumentType.LEAD_SQUARE, label: 'LEAD_DETUNE', desc: 'Dual-oscillator square wave.' },
            { type: InstrumentType.PAD_SAW, label: 'PAD_DARK', desc: 'Slow-attack atmospheric swell.' },
            { type: InstrumentType.PLUCK_SINE, label: 'PLUCK_GLASS', desc: 'FM sine pluck with transients.' },
        ],
        'ADVANCED_CYBERNETICS': [
            { type: InstrumentType.BASS_SUB_808, label: 'SUB_TITAN', desc: 'Deep sine sub-bass with saturation.' },
            { type: InstrumentType.LEAD_PWM, label: 'LEAD_CYBER', desc: 'Detuned pulse/saw hybrid lead.' },
            { type: InstrumentType.PAD_CHOIR, label: 'PAD_ANGEL', desc: 'Formant-filtered vocal synth.' },
            { type: InstrumentType.PAD_ETHEREAL, label: 'PAD_ETHER', desc: 'Multi-oscillator atmospheric swell.' },
            { type: InstrumentType.ARP_PLUCK, label: 'ARP_SYNTH', desc: 'Short-decay triangle for arpeggios.' },
            { type: InstrumentType.FX_GLITCH, label: 'FX_DATABEND', desc: 'Randomized FM noise burst.' },
        ],
        'AUXILIARY': [
            { type: InstrumentType.RIM_SHOT, label: 'RIM_CLICK', desc: 'High-pitch woodblock emulator.' },
            { type: InstrumentType.HAND_CLAP, label: 'CLAP_STACK', desc: 'Multi-layered noise burst.' },
        ]
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
                className="bg-black border border-accent/30 shadow-[0_0_30px_rgba(0,255,65,0.1)] p-6 w-full max-w-4xl m-4 relative" 
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative Corners */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-accent"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-accent"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-accent"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-accent"></div>

                {/* Header */}
                <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-[0.2em] font-mono">
                            <span className="text-accent">MODULE</span>_INJECTION
                        </h2>
                        <p className="text-[10px] text-gray-500 font-mono mt-1 tracking-widest">SELECT AUDIO ENGINE TO LOAD INTO SHADOW CORE</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-accent border border-transparent hover:border-accent transition-all font-mono"
                    >
                        ✕
                    </button>
                </div>

                {/* Grid */}
                <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(categories).map(([category, instruments]) => (
                        <div key={category}>
                            <h3 className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4 flex items-center gap-2 border-l-2 border-accent pl-3">
                                {category}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {instruments.map((inst) => (
                                    <button
                                        key={inst.type}
                                        onClick={() => onSelect(inst.type)}
                                        className="
                                            group flex flex-col items-start p-4
                                            bg-gray-900/30 border border-gray-800
                                            hover:border-accent hover:bg-gray-900/80
                                            active:bg-accent/10
                                            transition-all duration-200 relative
                                        "
                                    >
                                        <div className="flex items-center gap-3 mb-2 w-full">
                                            <div className="w-2 h-2 bg-gray-700 group-hover:bg-accent rounded-sm transition-colors"></div>
                                            <span className="text-xs font-bold text-gray-300 group-hover:text-white font-mono">{inst.label}</span>
                                        </div>
                                        <span className="text-[9px] font-mono text-gray-600 group-hover:text-gray-400 transition-colors text-left leading-tight">
                                            {inst.desc}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AddTrackModal;
