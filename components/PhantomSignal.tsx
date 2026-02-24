
import React, { useState, useEffect, useRef } from 'react';
import { phantomProtocol } from '../services/phantomProtocol';
import { radioService } from '../services/radioService';
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
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const presets = [88.1, 94.5, 101.1, 107.9];

  useEffect(() => {
    phantomProtocol.initialize().then(setMidiReady);
    
    setConnectionStatus('CONNECTING');
    const cleanup = radioService.onMessage((msg) => {
      setConnectionStatus('CONNECTED');
      setMessages(prev => [...prev.slice(-14), msg]); // Keep last 15
    });
    
    // Check connection periodically
    const interval = setInterval(() => {
        if (radioService.getNodeId()) setConnectionStatus('CONNECTED');
    }, 5000);
    
    return () => { 
        cleanup(); 
        clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setIsScanning(true);
      setTimeout(() => setIsScanning(false), 500); // Simulate scanning delay
      radioService.joinFrequency(val.toFixed(1));
      if (midiReady) {
          phantomProtocol.setFrequency(val);
      }
  };

  const sendRadioMsg = (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputMsg.trim()) return;
      radioService.transmit({ text: inputMsg });
      setMessages(prev => [...prev.slice(-8), { from: 'YOU', payload: { text: inputMsg } }]);
      setInputMsg('');
  };

  return (
    <div className="glass-panel p-3 sm:p-6 flex flex-col items-center gap-4 sm:gap-6 bg-black relative w-full max-w-full overflow-hidden group">
      {/* Background Signal Lines */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
              <div key={i} className="h-px w-full bg-accent mb-4 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
          ))}
      </div>

      <div className="w-full flex justify-between items-center border-b border-gray-800 pb-2 relative z-10">
         <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${isOnAir ? 'bg-accent animate-ping' : 'bg-gray-800'}`}></div>
             <span className="text-[8px] sm:text-[10px] text-accent font-bold tracking-[0.2em] uppercase">PHANTOM_SIGNAL // TX_CORE</span>
         </div>
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-1.5">
                 <div className={`w-1 h-1 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-accent' : connectionStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-600'}`}></div>
                 <span className={`text-[7px] font-mono ${connectionStatus === 'CONNECTED' ? 'text-accent' : 'text-gray-600'}`}>{connectionStatus}</span>
             </div>
             {isOnAir && (
                 <div className="flex items-center gap-1 bg-red-950/30 border border-red-500/50 px-2 py-0.5 rounded-sm animate-pulse">
                     <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                     <span className="text-[8px] font-black text-red-500 tracking-tighter">ON AIR</span>
                 </div>
             )}
             <span className={`text-[8px] sm:text-[9px] font-mono uppercase ${midiReady ? 'text-accent' : 'text-gray-600'}`}>
                {midiReady ? 'LINK_ESTABLISHED' : 'NO_CARRIER'}
             </span>
         </div>
      </div>

      {/* Spectrum Analyzer (Simulated) */}
      <div className="w-full h-12 flex items-end gap-0.5 px-2 relative z-10 overflow-hidden bg-black/40 border border-gray-800/50 rounded-sm">
          {[...Array(32)].map((_, i) => (
              <div 
                  key={i} 
                  className={`flex-1 transition-all duration-150 ${isOnAir || isScanning ? 'animate-bounce' : 'h-1'} ${isScanning ? 'bg-gray-500' : 'bg-accent/40'}`}
                  style={{ 
                      height: (isOnAir || isScanning) ? `${Math.random() * 100}%` : '2px',
                      animationDuration: `${0.3 + Math.random() * 0.7}s`,
                      animationDelay: `${i * 0.05}s`,
                      opacity: isScanning ? 0.1 + Math.random() * 0.4 : 0.3 + (i / 32) * 0.7
                  }}
              ></div>
          ))}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className={`text-[7px] font-mono tracking-[1em] uppercase transition-colors ${isScanning ? 'text-accent animate-pulse' : 'text-gray-700'}`}>
                  {isScanning ? 'SIGNAL_SEARCH...' : 'Spectrum_Analysis'}
              </span>
          </div>
      </div>

      <div className="flex flex-row flex-wrap gap-8 items-center justify-center w-full relative z-10">
          <div className="flex flex-col items-center gap-4">
            <Knob 
                label="TX_FILTER" 
                value={filterValue} 
                min={0} max={100} 
                onChange={handleFilterChange}
                size="sm"
                color="text-accent"
            />
            <div className="flex flex-col items-center">
                <span className="text-[7px] text-gray-600 font-bold uppercase">Resonance</span>
                <div className="w-12 h-1 bg-gray-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-accent/50" style={{ width: '40%' }}></div>
                </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
              <div className="relative">
                  {/* Decorative Rings */}
                  <div className={`absolute -inset-6 border border-accent/10 rounded-full transition-all duration-500 ${isOnAir ? 'scale-110 opacity-100 animate-pulse' : 'scale-100 opacity-0'}`}></div>
                  <div className={`absolute -inset-10 border border-accent/5 rounded-full transition-all duration-700 ${isOnAir ? 'scale-125 opacity-100 animate-pulse' : 'scale-100 opacity-0'}`} style={{ animationDelay: '0.2s' }}></div>

                  <button 
                    onClick={toggleBroadcast}
                    disabled={killSwitch}
                    className={`
                        w-20 h-20 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center border-2
                        transition-all duration-300 relative z-10 group/btn
                        ${isOnAir 
                            ? 'bg-accent/10 border-accent text-accent shadow-[0_0_40px_rgba(0,255,65,0.3),inset_0_0_20px_rgba(0,255,65,0.1)]' 
                            : 'bg-gray-900/30 border-gray-800 text-gray-700 hover:border-gray-500 hover:text-gray-400'}
                        ${killSwitch ? 'opacity-20 cursor-not-allowed' : ''}
                    `}
                  >
                     <span className={`font-mono text-3xl sm:text-5xl transition-all duration-500 ${isOnAir ? 'scale-110 rotate-12 drop-shadow-[0_0_10px_rgba(0,255,65,0.8)]' : 'scale-100'}`}>☢</span>
                     <span className={`text-[8px] font-black mt-1 tracking-widest transition-opacity ${isOnAir ? 'opacity-100' : 'opacity-40'}`}>
                         {isOnAir ? 'TRANSMITTING' : 'STANDBY'}
                     </span>
                  </button>
              </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Knob 
                label="FREQ" 
                value={frequency} 
                min={87.5} max={108.0} 
                step={0.1}
                onChange={handleFrequencyChange}
                size="sm"
                color="text-accent"
            />
            <div className="flex flex-col items-center">
                <span className="text-[7px] text-gray-600 font-bold uppercase">Stability</span>
                <div className="w-12 h-1 bg-gray-900 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500/50 animate-pulse" style={{ width: '85%' }}></div>
                </div>
            </div>
          </div>
      </div>

       <div className="w-full bg-black border border-gray-800 p-3 rounded-sm relative overflow-hidden z-10 shadow-inner">
            {isScanning && (
                <div className="absolute inset-0 bg-accent/10 backdrop-blur-[1px] animate-pulse flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black text-accent tracking-[0.3em] uppercase">SCANNING_BAND...</span>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center px-4">
                <div className="flex flex-col">
                    <span className="text-[8px] text-gray-600 font-bold tracking-[0.2em] uppercase mb-1">Carrier_Frequency</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-4xl font-mono text-accent font-black tracking-tighter tabular-nums">
                            {frequency.toFixed(1)}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-600 font-bold">MHz</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                        {presets.map(p => (
                            <button 
                                key={p}
                                onClick={() => handleFrequencyChange(p)}
                                className={`text-[7px] px-1.5 py-0.5 border rounded-sm transition-all ${frequency === p ? 'bg-accent text-black border-accent' : 'bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-gray-600 font-bold tracking-[0.2em] uppercase mb-1">Signal_Integrity</span>
                        <div className="flex items-end gap-1 h-6">
                            {[...Array(8)].map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`w-1.5 rounded-t-sm transition-all duration-300 ${i < (isOnAir ? 6 : 1) ? 'bg-accent' : 'bg-gray-900'}`}
                                    style={{ 
                                        height: `${(i + 1) * 12.5}%`,
                                        opacity: isOnAir ? 0.4 + (i / 8) * 0.6 : 0.2
                                    }}
                                ></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
       </div>

       {/* RADIO CHAT / NODE MESSENGER */}
       <div className="w-full flex flex-col gap-3 bg-gray-950/50 p-4 border border-gray-800 rounded-sm relative z-10 shadow-2xl">
           <div className="flex justify-between items-center border-b border-gray-900 pb-2">
               <div className="flex items-center gap-3">
                   <div className="flex flex-col">
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Node_Relay</span>
                       <span className="text-[7px] text-gray-600 font-mono">FREQ: {frequency.toFixed(1)} MHz</span>
                   </div>
               </div>
               <div className="flex items-center gap-2 bg-black px-2 py-1 border border-gray-800 rounded-sm">
                   <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                   <span className="text-[8px] text-accent font-black tracking-widest">ENCRYPTED_LINK</span>
               </div>
           </div>
           
           <div className="h-32 sm:h-48 overflow-y-auto flex flex-col gap-3 font-mono text-[10px] custom-scrollbar pr-2">
               {messages.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-full opacity-20 grayscale">
                       <span className="text-4xl mb-2">📡</span>
                       <span className="text-[10px] italic tracking-widest">AWAITING_INCOMING_TRANSMISSIONS...</span>
                   </div>
               )}
               {messages.map((m, i) => (
                   <div key={i} className={`flex flex-col gap-1 max-w-[90%] ${m.from === 'YOU' ? 'self-end items-end' : 'self-start items-start'}`}>
                       <div className="flex items-center gap-2 px-1">
                           <span className={`text-[7px] font-black tracking-widest ${m.from === 'YOU' ? 'text-accent' : 'text-blue-400'}`}>
                               {m.from === 'YOU' ? 'LOCAL_NODE' : `REMOTE_${m.from?.slice(0,6)}`}
                           </span>
                           <span className="text-[6px] text-gray-700">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                       </div>
                       <div className={`px-3 py-2 rounded-sm border ${m.from === 'YOU' ? 'bg-accent/5 border-accent/20 text-accent' : 'bg-blue-900/5 border-blue-500/20 text-blue-100'}`}>
                           <span className="break-all leading-relaxed font-mono">{m.payload.text}</span>
                       </div>
                   </div>
               ))}
               <div ref={chatEndRef} />
           </div>
           
           <form onSubmit={sendRadioMsg} className="flex gap-2 mt-2 pt-2 border-t border-gray-900">
               <div className="flex-1 relative">
                   <input 
                      type="text" 
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                      placeholder="ENTER_TRANSMISSION_DATA..."
                      className="w-full bg-black border border-gray-800 text-[10px] p-2.5 pl-3 text-accent focus:border-accent focus:bg-accent/5 outline-none transition-all placeholder:text-gray-800 font-mono"
                   />
                   <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-30">
                       <div className="w-1 h-1 bg-accent rounded-full"></div>
                       <div className="w-1 h-1 bg-accent rounded-full"></div>
                   </div>
               </div>
               <button 
                type="submit" 
                className="px-6 bg-gray-900 border border-gray-800 text-[10px] font-black text-gray-500 hover:bg-accent hover:text-black hover:border-accent transition-all uppercase tracking-widest"
               >
                   TX
               </button>
           </form>
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
