
import React, { useState } from 'react';
import { Track } from '../types';

interface SequencerGridProps {
  tracks: Track[];
  currentStep: number;
  onToggleStep: (trackIndex: number, stepIndex: number) => void;
  onSelectTrack: (trackIndex: number) => void;
  selectedTrackIndex: number | null;
  onUpdateStep?: (trackIndex: number, stepIndex: number, key: 'velocity' | 'probability', val: number) => void;
  onClearTrack?: (trackIndex: number) => void;
  onRandomizeTrack?: (trackIndex: number) => void;
  onRandomizeAll?: () => void;
}

type EditMode = 'TRIG' | 'VEL' | 'PROB';

const SequencerGrid: React.FC<SequencerGridProps> = ({ 
  tracks, currentStep, onToggleStep, onSelectTrack, selectedTrackIndex, onUpdateStep,
  onClearTrack, onRandomizeTrack, onRandomizeAll
}) => {
  const [editMode, setEditMode] = useState<EditMode>('TRIG');

  const handleStepClick = (e: React.MouseEvent, trackIndex: number, stepIndex: number) => {
      // In TRIG mode, click toggles active state
      if (editMode === 'TRIG') {
          onToggleStep(trackIndex, stepIndex);
      }
  };

  const handleMouseMove = (e: React.MouseEvent, trackIndex: number, stepIndex: number) => {
      if (e.buttons !== 1 || !onUpdateStep) return; // Only drag if mouse down
      
      const rect = e.currentTarget.getBoundingClientRect();
      const height = rect.height;
      const y = e.clientY - rect.top;
      const val = 1 - Math.max(0, Math.min(1, y / height)); // 0-1 from bottom up

      if (editMode === 'VEL') {
          onUpdateStep(trackIndex, stepIndex, 'velocity', val);
      } else if (editMode === 'PROB') {
          onUpdateStep(trackIndex, stepIndex, 'probability', val);
      }
  };

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <div className="flex flex-col gap-1 min-w-[700px] p-2">
        
        {/* Grid Toolbar */}
        <div className="flex justify-between items-end pl-24 sm:pl-28 mb-3 border-b border-gray-800 pb-2">
            {/* Step Indicators */}
            <div className="flex gap-1 sm:gap-1.5 flex-grow">
              {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`flex-1 text-center text-[8px] sm:text-[9px] font-mono transition-colors ${i === currentStep ? 'text-accent font-bold animate-pulse text-glow' : 'text-gray-700'}`}>
                      {i + 1}
                  </div>
              ))}
            </div>
            
            {/* Mode Switcher */}
            <div className="flex gap-1 ml-4 bg-gray-900 p-1 rounded-sm border border-gray-800 shadow-neo-inner">
                {(['TRIG', 'VEL', 'PROB'] as EditMode[]).map(mode => (
                    <button 
                      key={mode}
                      onClick={() => setEditMode(mode)}
                      className={`
                          text-[8px] sm:text-[9px] font-bold px-2 sm:px-3 py-1 rounded-sm transition-all font-mono
                          ${editMode === mode ? 'bg-accent text-black shadow-[0_0_8px_rgba(0,255,65,0.5)]' : 'text-gray-500 hover:text-white'}
                      `}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            {/* Global Actions */}
            <div className="flex gap-1 ml-4">
                <button 
                  onClick={onRandomizeAll}
                  className="text-[8px] sm:text-[9px] font-bold px-2 sm:px-3 py-1 bg-gray-900 border border-gray-800 text-gray-500 hover:text-accent hover:border-accent transition-all font-mono uppercase"
                  title="Randomize All Tracks"
                >
                    RAND_ALL
                </button>
            </div>
        </div>

        {tracks.map((track, trackIndex) => (
          <div 
              key={track.id} 
              className={`flex items-center gap-2 sm:gap-4 mb-1 p-1 pr-2 rounded-l border-l-2 transition-all ${selectedTrackIndex === trackIndex ? 'bg-white/5 border-l-accent' : 'border-l-transparent hover:bg-white/5'}`}
          >
            {/* Track Header */}
            <div 
              className="w-20 sm:w-24 flex-shrink-0 flex flex-col items-end cursor-pointer group py-1"
              onClick={() => onSelectTrack(trackIndex)}
            >
              <span className={`text-[9px] sm:text-[10px] font-bold truncate uppercase tracking-tight group-hover:text-accent transition-colors ${selectedTrackIndex === trackIndex ? 'text-accent' : 'text-gray-400'}`}>
                  {track.name}
              </span>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5 opacity-60">
                  <span className="text-[7px] sm:text-[8px] text-gray-500 font-mono uppercase">{track.type.split('_')[0]}</span>
                  {track.mute && <span className="text-[7px] sm:text-[8px] text-red-500 font-bold bg-red-900/20 px-1 rounded">M</span>}
                  {track.solo && <span className="text-[7px] sm:text-[8px] text-yellow-500 font-bold bg-yellow-900/20 px-1 rounded">S</span>}
              </div>
              
              {/* Track Actions */}
              <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                      onClick={(e) => { e.stopPropagation(); onClearTrack?.(trackIndex); }}
                      className="text-[7px] font-bold text-gray-500 hover:text-red-500 uppercase tracking-tighter"
                      title="Clear Track"
                  >
                      CLR
                  </button>
                  <button 
                      onClick={(e) => { e.stopPropagation(); onRandomizeTrack?.(trackIndex); }}
                      className="text-[7px] font-bold text-gray-500 hover:text-accent uppercase tracking-tighter"
                      title="Randomize Track"
                  >
                      RND
                  </button>
              </div>
            </div>

            {/* Steps */}
            <div className="flex gap-1 sm:gap-1.5 flex-grow">
            {track.steps.map((step, stepIndex) => {
              const isCurrent = stepIndex === currentStep;
              const isQuarter = stepIndex % 4 === 0;
              
              // Base State (Recessed Button)
              let bgClass = "bg-[#080808]";
              let borderClass = isQuarter ? "border-gray-700" : "border-gray-800";
              let shadowClass = "shadow-neo-inner"; // Inset shadow for depth
              
              let ledClass = "bg-gray-800 opacity-20";

              // Active Step State (Projected/Lit)
              if (step.active) {
                 bgClass = "bg-gray-800";
                 shadowClass = "shadow-none";
                 
                 // Dynamic color based on prob
                 const opacity = step.probability < 1 ? 'opacity-60' : 'opacity-100';
                 ledClass = `bg-accent ${opacity} shadow-[0_0_8px_var(--accent)] box-shadow-glow`;
              }

              // Playhead State
              if (isCurrent) {
                  bgClass = "bg-gray-700 border-gray-500";
                  if (step.active) {
                      ledClass = "bg-white shadow-[0_0_15px_#fff]";
                  }
              }
              
              return (
                <div
                  key={stepIndex}
                  onClick={(e) => handleStepClick(e, trackIndex, stepIndex)}
                  onMouseMove={(e) => handleMouseMove(e, trackIndex, stepIndex)}
                  className={`
                    flex-1 h-8 md:h-10 rounded-sm border ${borderClass} ${bgClass} ${shadowClass}
                    relative group transition-all duration-75
                    hover:border-gray-500
                    cursor-pointer
                    overflow-hidden
                  `}
                >
                    {/* Visuals based on Mode */}
                    {editMode === 'TRIG' && (
                        <div className="flex items-center justify-center w-full h-full">
                            {/* LED Indicator */}
                            <div className={`w-4 h-2 rounded-sm transition-all duration-75 ${ledClass}`}></div>
                            
                            {/* Probability Dot */}
                            {step.active && step.probability < 1 && (
                                <div className="absolute top-1 right-1 w-1 h-1 bg-yellow-500 rounded-full"></div>
                            )}
                        </div>
                    )}

                    {editMode === 'VEL' && step.active && (
                        <div className="w-full h-full relative bg-gray-900/50 flex items-end">
                            <div className="w-full bg-blue-500/80 transition-all border-t border-blue-400" style={{height: `${step.velocity * 100}%`}}></div>
                        </div>
                    )}

                    {editMode === 'PROB' && step.active && (
                        <div className="w-full h-full relative bg-gray-900/50 flex items-end">
                            <div className="w-full bg-yellow-500/80 transition-all border-t border-yellow-400" style={{height: `${step.probability * 100}%`}}></div>
                        </div>
                    )}

                    {/* Tooltip on Hover */}
                    {step.active && (editMode === 'VEL' || editMode === 'PROB') && (
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            {editMode === 'VEL' ? Math.round(step.velocity * 100) : Math.round(step.probability * 100)}
                        </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};

export default SequencerGrid;
