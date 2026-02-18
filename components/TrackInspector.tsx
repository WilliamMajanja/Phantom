

import React from 'react';
import { Track, InstrumentType } from '../types';
import Knob from './Knob';
import { midiService } from '../services/midiService';

interface TrackInspectorProps {
  track: Track;
  onChange: (updatedTrack: Track) => void;
  onDelete: (trackId: string) => void;
}

const TrackInspector: React.FC<TrackInspectorProps> = ({ track, onChange, onDelete }) => {
  
  const updateParam = (key: keyof typeof track.params, value: number) => {
    // 1. Update Internal State (App/Reflex Engine)
    onChange({
      ...track,
      params: {
        ...track.params,
        [key]: value
      }
    });

    // 2. Send MIDI CC (TR-8S Control)
    midiService.sendTR8SParam(track.type, key as string, value);
  };

  const updatePan = (val: number) => {
      // Knob returns 0-100, we need -1 to 1
      const pan = (val - 50) / 50;
      onChange({ ...track, pan });
  }

  return (
    <div className="glass-panel p-6 w-full animate-fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-textLight/20 pb-2">
         <div className="flex flex-col">
            <h3 className="text-lg font-bold text-text uppercase tracking-widest">{track.name}</h3>
            <span className="text-xs font-mono text-accent">{track.type} ENGINE</span>
         </div>
         <div className="flex gap-2">
            <button 
               onClick={() => onChange({...track, mute: !track.mute})}
               className={`px-3 py-1 text-xs font-bold rounded ${track.mute ? 'bg-accent text-white' : 'bg-surface shadow-neo text-text'}`}
            >
                MUTE
            </button>
            <button 
               onClick={() => onChange({...track, solo: !track.solo})}
               className={`px-3 py-1 text-xs font-bold rounded ${track.solo ? 'bg-indicator text-white' : 'bg-surface shadow-neo text-text'}`}
            >
                SOLO
            </button>
            <button 
                onClick={() => onDelete(track.id)}
                className="px-3 py-1 text-xs font-bold rounded bg-surface shadow-neo text-text hover:text-red-500"
            >
                DEL
            </button>
         </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-6 justify-items-center">
        <Knob 
            label="VOL" 
            value={(track.params.volume ?? 0.8) * 100} 
            min={0} max={100} 
            onChange={(v) => updateParam('volume', v/100)} 
        />
        <Knob 
            label="PAN" 
            value={(track.pan * 50) + 50} 
            min={0} max={100} 
            onChange={updatePan} 
        />
        <Knob 
            label="PITCH" 
            value={track.params.pitch} 
            min={20} max={2000} 
            onChange={(v) => updateParam('pitch', v)} 
        />
        <Knob 
            label="DECAY" 
            value={track.params.decay * 100} 
            min={1} max={200} 
            onChange={(v) => updateParam('decay', v/100)} 
        />
        <Knob 
            label="TONE" 
            value={track.params.tone * 100} 
            min={0} max={100} 
            onChange={(v) => updateParam('tone', v/100)} 
        />
        <Knob 
            label="FILTER" 
            value={track.params.filterCutoff} 
            min={50} max={15000} 
            onChange={(v) => updateParam('filterCutoff', v)} 
        />
      </div>
    </div>
  );
};

export default TrackInspector;