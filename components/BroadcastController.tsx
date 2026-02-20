import React, { useState, useEffect } from 'react';
import { phantomProtocol } from '../services/phantomProtocol';
import Knob from './Knob';

const BroadcastController: React.FC = () => {
  const [isOnAir, setIsOnAir] = useState(false);
  const [midiReady, setMidiReady] = useState(false);
  const [filterValue, setFilterValue] = useState(0);
  const [frequency, setFrequency] = useState(101.1);

  useEffect(() => {
    phantomProtocol.initialize().then(setMidiReady);
  }, []);

  const toggleBroadcast = () => {
    const newState = !isOnAir;
    setIsOnAir(newState);
    
    // Send MIDI Signal to Mixxx (Talkover / Broadcast)
    if (midiReady) {
        phantomProtocol.sendCC(51, newState ? 127 : 0);
    }
  };

  const handleFilterChange = (val: number) => {
      setFilterValue(val);
      if (midiReady) {
          phantomProtocol.setTransmissionFilter(val);
      }
  };

  const handleDropID = () => {
      if (midiReady) {
          phantomProtocol.triggerStationID();
      }
  };

  const tuneFrequency = (delta: number) => {
      setFrequency(prev => {
          const next = parseFloat((prev + delta).toFixed(1));
          return Math.min(108.0, Math.max(87.5, next));
      });
  };

  return (
    <div className="glass-panel p-6 flex flex-col items-center gap-6">
      
      {/* Header / Status */}
      <div className="w-full flex justify-between items-center border-b border-white/10 pb-2">
         <span className="text-[10px] text-textLight font-bold tracking-widest uppercase">Pirate Transmission</span>
         <span className={`text-[9px] font-mono uppercase ${midiReady ? 'text-indicator' : 'text-gray-400'}`}>
            {midiReady ? 'LINK ONLINE' : 'NO MIDI'}
         </span>
      </div>

      {/* Main Controls */}
      <div className="flex gap-6 items-center">
          
          {/* Big Knob - Filter */}
          <Knob 
            label="TX FILTER" 
            value={filterValue} 
            min={0} max={100} 
            onChange={handleFilterChange}
            size="md"
            color="text-text"
          />

          {/* On Air Toggle */}
          <div className="flex flex-col items-center gap-2">
              <button 
                onClick={toggleBroadcast}
                className={`
                    w-20 h-20 rounded-full flex items-center justify-center border-4 border-surface
                    transition-all duration-300 relative
                    ${isOnAir 
                        ? 'bg-surface shadow-neo-pressed text-accent' 
                        : 'bg-surface shadow-neo text-gray-400 hover:text-text'}
                `}
              >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.788m13.788 0c3.808 3.808 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
                </svg>
                {isOnAir && <div className="absolute inset-0 rounded-full animate-ping bg-accent/10 pointer-events-none"></div>}
              </button>
              <span className={`text-[10px] font-bold tracking-widest ${isOnAir ? 'text-accent' : 'text-gray-400'}`}>
                {isOnAir ? 'ON AIR' : 'OFFLINE'}
              </span>
          </div>
      </div>

      {/* Station ID / Samples */}
      <div className="w-full flex justify-center pt-2 border-t border-white/10">
         <button 
            onClick={handleDropID}
            onMouseDown={(e) => e.currentTarget.classList.add('shadow-neo-pressed')}
            onMouseUp={(e) => e.currentTarget.classList.remove('shadow-neo-pressed')}
            className="w-full py-3 bg-surface shadow-neo rounded-xl text-text text-xs font-bold active:shadow-neo-pressed active:text-accent transition-all flex items-center justify-center gap-2"
         >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
               <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            DROP ID
         </button>
      </div>

      {/* Frequency Tuner */}
      <div className="w-full bg-plate/50 rounded-lg p-2 flex justify-between items-center shadow-neo-inner">
          <button 
            onClick={() => tuneFrequency(-0.1)}
            className="w-8 h-8 rounded-full bg-surface shadow-neo text-text hover:text-accent flex items-center justify-center font-bold"
          >-</button>
          
          <div className="flex flex-col items-center">
             <span className="text-[9px] text-textLight font-bold tracking-widest">FREQUENCY</span>
             <span className="text-lg font-mono text-text font-bold text-shadow-sm">
                FM {frequency.toFixed(1)} <span className="text-[10px]">MHz</span>
             </span>
          </div>

          <button 
             onClick={() => tuneFrequency(0.1)}
             className="w-8 h-8 rounded-full bg-surface shadow-neo text-text hover:text-accent flex items-center justify-center font-bold"
          >+</button>
      </div>
    </div>
  );
};

export default BroadcastController;