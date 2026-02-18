
import React from 'react';
import { Track } from '../types';
import Knob from './Knob';

interface MixerConsoleProps {
    tracks: Track[];
    onUpdateTrack: (index: number, updates: Partial<Track>) => void;
}

const MixerConsole: React.FC<MixerConsoleProps> = ({ tracks, onUpdateTrack }) => {
    
    return (
        <div className="glass-panel p-6 w-full flex flex-col gap-4 overflow-x-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-2 sticky left-0">
                <span className="text-[10px] text-accent font-bold tracking-widest uppercase">PRODUCTION_CONSOLE // MIXER</span>
                <div className="flex gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#00ff00]"></div>
                    <span className="text-[9px] font-mono text-gray-500">AUDIO ENGINE ACTIVE</span>
                </div>
            </div>

            <div className="flex gap-2 min-w-max pb-4">
                {tracks.map((track, index) => (
                    <div key={track.id} className="w-20 bg-black/40 border border-gray-800 rounded flex flex-col items-center p-2 relative group hover:border-gray-600 transition-colors">
                        
                        {/* Name */}
                        <div className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter truncate w-full text-center mb-2" title={track.name}>
                            {track.name}
                        </div>

                        {/* Pan Knob */}
                        <div className="mb-2 scale-75">
                            <Knob 
                                label="PAN" 
                                value={(track.pan * 50) + 50} 
                                min={0} max={100} 
                                size="sm"
                                color="text-gray-400"
                                onChange={(v) => onUpdateTrack(index, { pan: (v - 50) / 50 })}
                            />
                        </div>

                        {/* Mute/Solo */}
                        <div className="flex flex-col gap-1 w-full mb-3">
                            <button 
                                onClick={() => onUpdateTrack(index, { solo: !track.solo })}
                                className={`h-5 w-full text-[8px] font-bold rounded border ${track.solo ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-gray-900 text-gray-500 border-gray-700'}`}
                            >
                                S
                            </button>
                            <button 
                                onClick={() => onUpdateTrack(index, { mute: !track.mute })}
                                className={`h-5 w-full text-[8px] font-bold rounded border ${track.mute ? 'bg-red-500 text-white border-red-500' : 'bg-gray-900 text-gray-500 border-gray-700'}`}
                            >
                                M
                            </button>
                        </div>

                        {/* Volume Fader */}
                        <div className="h-40 w-8 bg-gray-900 rounded-full relative flex justify-center py-2 border border-gray-800 shadow-inner group-hover:border-gray-600 cursor-ns-resize"
                             onMouseDown={(e) => {
                                 const startY = e.clientY;
                                 const startVal = track.params.volume || 0.8;
                                 const rect = e.currentTarget.getBoundingClientRect();
                                 
                                 const handleMove = (ev: MouseEvent) => {
                                     const deltaY = startY - ev.clientY;
                                     const range = rect.height - 20; // Padding
                                     const deltaVal = deltaY / range;
                                     const newVal = Math.max(0, Math.min(1, startVal + deltaVal));
                                     
                                     onUpdateTrack(index, { 
                                         params: { ...track.params, volume: newVal } 
                                     });
                                 };
                                 const handleUp = () => {
                                     window.removeEventListener('mousemove', handleMove);
                                     window.removeEventListener('mouseup', handleUp);
                                 };
                                 window.addEventListener('mousemove', handleMove);
                                 window.addEventListener('mouseup', handleUp);
                             }}
                        >
                            {/* Fader Track Line */}
                            <div className="w-0.5 h-full bg-gray-800"></div>
                            
                            {/* Fader Cap */}
                            <div 
                                className="absolute w-6 h-10 bg-gray-700 border border-gray-500 rounded shadow-md cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors flex items-center justify-center"
                                style={{ bottom: `${(track.params.volume || 0.8) * 100}%`, marginBottom: '-20px' }} // Center cap
                            >
                                <div className="w-4 h-0.5 bg-gray-900"></div>
                            </div>
                        </div>

                        {/* Level Readout */}
                        <div className="mt-2 text-[9px] font-mono text-accent">
                            {Math.round((track.params.volume || 0.8) * 100)}
                        </div>

                        {/* Meter (Fake) */}
                        <div className="absolute right-1 top-10 bottom-10 w-1 bg-gray-900 rounded overflow-hidden">
                             {/* In a real app, this would be an AudioWorklet message */}
                             <div className="absolute bottom-0 left-0 w-full bg-green-500 opacity-50 animate-pulse" style={{ height: `${(track.params.volume || 0) * 60}%` }}></div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

export default MixerConsole;
