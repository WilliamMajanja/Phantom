

import React, { useState } from 'react';
import { SequencerState } from '../types';
import { shadowCore } from '../services/audio/ShadowCore';
import { generateMidiFile } from '../services/midiWriter';

interface ExportInterfaceProps {
    isOpen: boolean;
    onClose: () => void;
    state: SequencerState;
}

const ExportInterface: React.FC<ExportInterfaceProps> = ({ isOpen, onClose, state }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [progress, setProgress] = useState(0);
    const [filename, setFilename] = useState(`PHANTOM_SESSION_${new Date().toISOString().slice(0,10)}`);

    if (!isOpen) return null;

    // --- MIDI EXPORT ---
    const handleMidiExport = () => {
        const midiBlob = generateMidiFile(state);
        const safeName = filename.replace(/[^a-z0-9-_]/gi, '_');
        downloadBlob(midiBlob, `${safeName}.mid`);
    };

    // --- AUDIO EXPORT ---
    // --- JSON EXPORT ---
    const handleJsonExport = () => {
        const sessionData = JSON.stringify(state, null, 2);
        const blob = new Blob([sessionData], { type: 'application/json' });
        const safeName = filename.replace(/[^a-z0-9-_]/gi, '_');
        downloadBlob(blob, `${safeName}.json`);
    };

    const handleAudioExport = (format: 'webm' | 'wav') => {
        if (isRecording) return;
        setIsRecording(true);
        setProgress(0);

        // 1. Calculate duration (2 Bars)
        const totalSteps = 32;
        const durationSec = (totalSteps * 60) / (state.bpm * 4);
        const durationMs = durationSec * 1000;

        // 2. Start Recording
        shadowCore.play(); // Ensure playing
        shadowCore.startRecording(format);

        // 3. Progress Bar Simulation
        const interval = 100;
        let elapsed = 0;
        const timer = setInterval(() => {
            elapsed += interval;
            setProgress(Math.min(100, (elapsed / durationMs) * 100));
            
            if (elapsed >= durationMs) {
                clearInterval(timer);
                finishRecording(format);
            }
        }, interval);
    };

    const finishRecording = (format: 'webm' | 'wav') => {
        shadowCore.stopRecording((blob) => {
            shadowCore.stop(); // Stop playback
            setIsRecording(false);
            const ext = format === 'webm' ? 'ogg' : 'wav';
            const safeName = filename.replace(/[^a-z0-9-_]/gi, '_');
            downloadBlob(blob, `${safeName}.${ext}`);
        });
    };

    const downloadBlob = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div 
                className="bg-black border border-accent/50 shadow-[0_0_50px_rgba(0,255,65,0.15)] p-8 w-full max-w-lg relative" 
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent"></div>

                <h2 className="text-2xl font-bold text-white mb-1 tracking-widest uppercase font-mono">
                    DATA EXTRUSION
                </h2>
                <p className="text-xs text-gray-500 font-mono mb-8">SELECT PROTOCOL FOR OFFLOAD</p>

                <div className="mb-6">
                    <label className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1 block">FILE IDENTITY</label>
                    <input 
                        type="text" 
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white p-3 font-mono text-sm focus:border-accent focus:outline-none"
                        placeholder="ENTER_SESSION_NAME"
                    />
                </div>

                <div className="space-y-4">
                    
                    {/* OPTION 1: MIDI */}
                    <button 
                        onClick={handleMidiExport}
                        disabled={isRecording}
                        className="w-full group relative overflow-hidden bg-gray-900 border border-gray-700 hover:border-accent p-4 text-left transition-all disabled:opacity-50"
                    >
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h3 className="text-accent font-bold text-sm tracking-wider group-hover:text-white">TR-8S PATTERN (.MID)</h3>
                                <p className="text-[10px] text-gray-500 mt-1">SMF TYPE 0 / ROLAND NOTE MAP</p>
                            </div>
                            <span className="text-2xl opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all">🎹</span>
                        </div>
                        <div className="absolute inset-0 bg-accent/10 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>

                    {/* OPTION 2: WEBM/OGG */}
                    <button 
                        onClick={() => handleAudioExport('webm')}
                        disabled={isRecording}
                        className="w-full group relative overflow-hidden bg-gray-900 border border-gray-700 hover:border-accent p-4 text-left transition-all disabled:opacity-50"
                    >
                         <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h3 className="text-accent font-bold text-sm tracking-wider group-hover:text-white">COMPRESSED AUDIO (.OGG)</h3>
                                <p className="text-[10px] text-gray-500 mt-1">OPUS CODEC / WEB OPTIMIZED</p>
                            </div>
                            <span className="text-2xl opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all">💾</span>
                        </div>
                        <div className="absolute inset-0 bg-accent/10 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>

                    {/* OPTION 3: JSON SESSION */}
                    <button 
                        onClick={handleJsonExport}
                        disabled={isRecording}
                        className="w-full group relative overflow-hidden bg-gray-900 border border-gray-700 hover:border-accent p-4 text-left transition-all disabled:opacity-50"
                    >
                         <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h3 className="text-accent font-bold text-sm tracking-wider group-hover:text-white">PHANTOM SESSION (.JSON)</h3>
                                <p className="text-[10px] text-gray-500 mt-1">FULL STATE RECOVERY / LOCAL BACKUP</p>
                            </div>
                            <span className="text-2xl opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all">⚙️</span>
                        </div>
                        <div className="absolute inset-0 bg-accent/10 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>
                </div>

                {/* RECORDING STATUS */}
                {isRecording && (
                    <div className="mt-8">
                        <div className="flex justify-between text-[10px] font-mono mb-2 text-accent">
                            <span className="animate-pulse">CAPTURING AUDIO STREAM...</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1 bg-gray-800">
                            <div 
                                className="h-full bg-accent shadow-[0_0_10px_#00ff41]" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    disabled={isRecording}
                    className="mt-8 w-full py-3 text-xs font-bold text-gray-500 hover:text-white border-t border-gray-800 hover:bg-gray-900 transition-colors"
                >
                    ABORT
                </button>
            </div>
        </div>
    );
};

export default ExportInterface;