import React from 'react';
import { SequencerState } from '../types';
import { getAbletonLiveEngines } from '../services/abletonLive';

interface AbletonLivePanelProps {
  state: SequencerState;
  onOpenExport: () => void;
}

const AbletonLivePanel: React.FC<AbletonLivePanelProps> = ({ state, onOpenExport }) => {
  const activePattern = state.patterns[state.activePatternId];
  const activeClips = activePattern?.tracks.reduce((count, track) => count + track.steps.filter((step) => step.active).length, 0) ?? 0;
  const engines = getAbletonLiveEngines();

  return (
    <div className="h-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 animate-fade-in overflow-y-auto custom-scrollbar">
      <div className="glass-panel p-6 bg-black/70 border-purple-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 text-[120px] leading-none font-black text-purple-500/5 pointer-events-none">LIVE</div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div>
            <div className="text-[10px] text-purple-300 font-bold uppercase tracking-[0.35em] mb-2">ABLETON LIVE PLUGIN MODE</div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">PHANTOM Live Bridge</h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-2xl mt-3">
              A Max for Live companion workflow that turns PHANTOM scenes into Live Session clips, routes Web MIDI through a virtual
              PHANTOM port, and exposes performance macros for racks, resampling, and Ghost Bridge clip generation.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 min-w-[280px]">
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded">
              <div className="text-[8px] text-purple-300 uppercase tracking-widest">BPM</div>
              <div className="text-xl font-black text-white">{state.bpm}</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded">
              <div className="text-[8px] text-purple-300 uppercase tracking-widest">Scenes</div>
              <div className="text-xl font-black text-white">{Object.keys(state.patterns).length}</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded">
              <div className="text-[8px] text-purple-300 uppercase tracking-widest">Clips</div>
              <div className="text-xl font-black text-white">{activeClips}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 relative z-10">
          <button
            onClick={onOpenExport}
            className="px-5 py-3 bg-purple-500 text-black text-[10px] font-black tracking-widest uppercase hover:bg-white transition-colors rounded-sm"
          >
            Export Live Pack
          </button>
          <div className="px-4 py-3 border border-gray-800 bg-black/60 rounded-sm text-[10px] text-gray-400 font-mono">
            PORT: <span className="text-accent">PHANTOM Live Bridge</span>
          </div>
          <div className="px-4 py-3 border border-gray-800 bg-black/60 rounded-sm text-[10px] text-gray-400 font-mono">
            LAUNCH: <span className="text-accent">1 BAR QUANTIZED</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {engines.map((engine) => (
          <div key={engine.id} className="glass-panel p-4 bg-gray-950/80 border-gray-800 hover:border-purple-500/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] text-purple-300 font-black uppercase tracking-widest">{engine.name}</span>
              <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_#00ff41]"></span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">{engine.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-panel p-5 bg-black/60">
          <div className="text-[10px] text-accent font-bold uppercase tracking-widest mb-4">Session View Mapping</div>
          <div className="space-y-2">
            {Object.values(state.patterns).map((pattern, index) => {
              const active = pattern.id === state.activePatternId;
              const queued = pattern.id === state.nextPatternId;
              return (
                <div
                  key={pattern.id}
                  className={`p-3 border rounded-sm flex items-center justify-between ${
                    active ? 'border-accent bg-accent/10' : queued ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-800 bg-gray-900/40'
                  }`}
                >
                  <div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest">Scene {index + 1}</div>
                    <div className="text-xs text-white font-bold">{pattern.name}</div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">{pattern.tracks.length} TRACKS</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel p-5 bg-black/60">
          <div className="text-[10px] text-accent font-bold uppercase tracking-widest mb-4">Rack Macro Targets</div>
          <div className="grid grid-cols-2 gap-2">
            {['M_FILTER', 'DATA_ROT', 'DUB_DELAY', 'DARK_VERB', 'SWING', 'PRISM_RATE', 'PRISM_DETUNE', 'STEM_BLEND'].map((macro, index) => (
              <div key={macro} className="bg-gray-900/60 border border-gray-800 p-3 rounded-sm">
                <div className="text-[8px] text-purple-300 font-mono">MACRO {index + 1}</div>
                <div className="text-[10px] text-white font-bold tracking-widest">{macro}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
            Export the plugin manifest, then mirror these targets in an Audio Effect Rack or Max for Live device to control PHANTOM from Live.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AbletonLivePanel;
