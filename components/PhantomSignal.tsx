
import React, { useState, useEffect } from 'react';
import { phantomProtocol } from '../services/phantomProtocol';
import Knob from './Knob';

interface PhantomSignalProps {
    onDeadManToggle: (isActive: boolean) => void;
}

const PhantomSignal: React.FC<PhantomSignalProps> = ({ onDeadManToggle }) => {
  const [isOnAir, setIsOnAir] = useState(false);
  const [midiReady, setMidiReady] = useState(false);
  const [filterValue, setFilterValue] = useState(0);
  const [killSwitch, setKillSwitch] = useState(false);
  const [isArmed, setIsArmed] = useState(false); // Safety Hatch State
  const [frequency, setFrequency] = useState(101.1);

  useEffect(() => {
    phantomProtocol.initialize().then(setMidiReady);
  }, []);

  const toggleBroadcast = () => {
    if (killSwitch) return; // Prevent broadcast if kill switch is active
    const newState = !isOnAir;
    setIsOnAir(newState);
    if (midiReady) {
        phantomProtocol.sendCC(51, newState ? 127 : 0);
    }
  };

  const toggleKillSwitch = () => {
      const newState = !killSwitch;
      setKillSwitch(newState);
      onDeadManToggle(newState);
      
      if (newState) {
          setIsOnAir(false);
          if (midiReady) phantomProtocol.emergencyFade();
      } else {
          // Resetting safety when disengaging
          setIsArmed(false);
      }
  };

  const handleFilterChange = (val: number) => {
      setFilterValue(val);
      if (midiReady) {
          phantomProtocol.setTransmissionFilter(val);
      }
  };

  const handleFrequencyChange = (val: number) => {
      setFrequency(val);
      if (midiReady) {
          phantomProtocol.setFrequency(val);
      }
  };

  return (
    <div className="glass-panel p-6 flex flex-col items-center gap-6 bg-black relative">
      <div className="w-full flex justify-between items-center border-b border-gray-800 pb-2">
         <span className="text-[10px] text-accent font-bold tracking-widest uppercase">PHANTOM SIGNAL</span>
         <span className={`text-[9px] font-mono uppercase ${midiReady ? 'text-accent' : 'text-gray-600'}`}>
            {midiReady ? 'LINK_ESTABLISHED' : 'NO_CARRIER'}
         </span>
      </div>

      <div className="flex gap-4 items-center justify-center">
          <Knob 
            label="TX_FILTER" 
            value={filterValue} 
            min={0} max={100} 
            onChange={handleFilterChange}
            size="md"
            color="text-accent"
          />

          <div className="flex flex-col items-center gap-2">
              <button 
                onClick={toggleBroadcast}
                disabled={killSwitch}
                className={`
                    w-20 h-20 rounded-full flex items-center justify-center border-2
                    transition-all duration-100 relative
                    ${isOnAir 
                        ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_#00ff41]' 
                        : 'bg-black border-gray-800 text-gray-800 hover:border-gray-600'}
                    ${killSwitch ? 'opacity-20 cursor-not-allowed' : ''}
                `}
              >
                 <span className="font-mono text-2xl">☢</span>
              </button>
              <span className={`text-[10px] font-bold tracking-widest ${isOnAir ? 'text-accent animate-pulse' : 'text-gray-600'}`}>
                {isOnAir ? 'BROADCASTING' : 'SILENT'}
              </span>
          </div>

          <Knob 
            label="FREQ" 
            value={frequency} 
            min={87.5} max={108.0} 
            step={0.1}
            onChange={handleFrequencyChange}
            size="md"
            color="text-accent"
          />
      </div>

       <div className="w-full bg-gray-900/50 border border-gray-800 p-2 rounded text-center flex justify-between items-center px-4">
            <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">CARRIER FREQ</span>
            <span className="text-lg font-mono text-accent font-bold">{frequency.toFixed(1)} <span className="text-xs text-gray-600">MHz</span></span>
       </div>

      {/* DEAD MAN'S SWITCH (Refined Safety Mechanism) */}
      <div className="w-full mt-2 pt-4 border-t border-gray-800 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-red-700 tracking-widest">SAFETY_OVERRIDE // GPIO_17</span>
            <span className={`text-[9px] font-mono ${killSwitch ? 'text-red-500 animate-pulse' : isArmed ? 'text-yellow-500 font-bold' : 'text-gray-600'}`}>
                {killSwitch ? 'PROTOCOL_ACTIVE' : isArmed ? 'ARMED // CAUTION' : 'SAFE'}
            </span>
          </div>
          
          <div className="relative h-14 w-full bg-black rounded border border-gray-700 overflow-hidden flex shadow-inner">
               {/* THE BUTTON (Behind the hatch) */}
               <button
                  onClick={toggleKillSwitch}
                  disabled={!isArmed && !killSwitch}
                  className={`
                      w-full h-full font-bold uppercase tracking-widest text-xs transition-all z-0
                      ${killSwitch 
                          ? 'bg-red-600 text-black animate-pulse' 
                          : 'bg-red-900/20 text-red-500 hover:bg-red-900/40'}
                  `}
               >
                   {killSwitch ? 'DISENGAGE KILL SWITCH' : 'ENGAGE KILL SWITCH'}
               </button>

               {/* THE SAFETY HATCH */}
               <div 
                  onClick={() => !killSwitch && setIsArmed(!isArmed)}
                  className={`
                      absolute inset-0 cursor-pointer transition-transform duration-300 ease-out origin-top z-10
                      flex items-center justify-center 
                      bg-[repeating-linear-gradient(45deg,#1a1a1a,#1a1a1a_10px,#222_10px,#222_20px)]
                      border-b border-gray-600 group
                      ${isArmed ? '-translate-y-full' : 'translate-y-0'}
                      ${killSwitch ? 'hidden' : ''}
                  `}
               >
                   <div className="bg-black/90 px-3 py-1 border border-yellow-600 rounded text-yellow-500 text-[9px] font-bold tracking-widest group-hover:text-yellow-400 group-hover:border-yellow-400 shadow-lg pointer-events-none">
                       LIFT SAFETY COVER
                   </div>
                   {/* Hatch Stripes */}
                   <div className="absolute bottom-0 w-full h-1 bg-yellow-600/50"></div>
               </div>
          </div>
      </div>
    </div>
  );
};

export default PhantomSignal;
