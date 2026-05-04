import React, { useState, useEffect } from 'react';
import { HiveState } from '../types';
import { shadowCore } from '../services/audio/ShadowCore';
import { radioService } from '../services/radioService';

const HiveSync: React.FC = () => {
  const MAX_RSSI_DB = -30;
  const MIN_RSSI_DB = -120;
  // Latency is the only browser-visible LoRa link metric; 4ms maps to 1dB, so the -30..-120dB display spans roughly 360ms.
  const RSSI_LATENCY_FACTOR = 4;
  const calculateRssiFromLatency = (latency: number | null) => (
    Math.max(MIN_RSSI_DB, Math.min(MAX_RSSI_DB, MAX_RSSI_DB - ((latency || 0) / RSSI_LATENCY_FACTOR)))
  );
  const [hive, setHive] = useState<HiveState>({
    active: false,
    role: 'SLAVE',
    rssi: -120,
    peers: 0,
    latency: 0
  });
  const [isBroadcastingVoice, setIsBroadcastingVoice] = useState(false);

  useEffect(() => {
    const cleanup = radioService.onStatus((status) => {
      setHive(prev => ({
        ...prev,
        active: status.connected,
        rssi: status.connected ? calculateRssiFromLatency(status.latency) : MIN_RSSI_DB,
        peers: status.peers,
        latency: status.latency ? Math.round(status.latency) : 0
      }));
    });

    return () => { cleanup(); };
  }, []);

  const toggleHive = () => {
      if (!hive.active) radioService.connect();
  };

  const toggleRole = () => {
      setHive(prev => ({ ...prev, role: prev.role === 'MASTER' ? 'SLAVE' : 'MASTER' }));
  };

  const toggleVoiceLoRa = async () => {
      if (!isBroadcastingVoice) {
          await shadowCore.initMic();
          shadowCore.startLoRaBroadcast((base64) => {
              radioService.transmitLoRaVoice(base64);
          });
          setIsBroadcastingVoice(true);
      } else {
          shadowCore.stopLoRaBroadcast();
          setIsBroadcastingVoice(false);
      }
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-3">
       <div className="flex justify-between items-center border-b border-white/10 pb-2">
         <div className="flex flex-col">
            <span className="text-[10px] text-textLight font-bold tracking-widest uppercase">Hive Protocol</span>
            <span className="text-[9px] text-indicator font-mono">LORA MESH 915MHz</span>
         </div>
         <button 
            onClick={toggleHive}
            className={`px-2 py-1 text-[9px] font-bold rounded border ${hive.active ? 'border-accent text-accent animate-pulse' : 'border-textLight text-textLight'}`}
         >
            {hive.active ? 'LINKED' : 'CONNECT'}
         </button>
      </div>

      <div className={`flex flex-col gap-3 transition-opacity ${hive.active ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-text">SYNC ROLE</span>
              <button 
                onClick={toggleRole}
                className={`text-[10px] font-mono px-2 py-1 rounded bg-plate shadow-neo-inner ${hive.role === 'MASTER' ? 'text-accent' : 'text-text'}`}
              >
                  {hive.role}
              </button>
          </div>

          <div className="flex flex-col gap-2">
              <button 
                onClick={toggleVoiceLoRa}
                className={`w-full py-2 text-[10px] font-bold border transition-all ${isBroadcastingVoice ? 'bg-accent text-black border-accent animate-pulse' : 'bg-black text-accent border-accent/30 hover:border-accent'}`}
              >
                  {isBroadcastingVoice ? 'VOICE_TX_ACTIVE' : 'TRANSMIT_VOICE_OVER_LORA'}
              </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-plate rounded p-1 shadow-neo-inner">
                  <div className="text-[9px] text-textLight">RSSI</div>
                  <div className="text-xs font-mono font-bold text-text">{Math.round(hive.rssi)}db</div>
              </div>
              <div className="bg-plate rounded p-1 shadow-neo-inner">
                  <div className="text-[9px] text-textLight">PEERS</div>
                  <div className="text-xs font-mono font-bold text-text">{hive.peers}</div>
              </div>
              <div className="bg-plate rounded p-1 shadow-neo-inner">
                  <div className="text-[9px] text-textLight">LATENCY</div>
                  <div className="text-xs font-mono font-bold text-text">{hive.latency}ms</div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default HiveSync;
