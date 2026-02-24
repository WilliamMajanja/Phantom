
import React from 'react';

interface TunerUIProps {
    loraStrength?: number; // 0 to 100
    stemLevels?: { 
        vox: number; 
        drum: number; 
        bass: number; 
        other: number 
    };
}

const TunerUI: React.FC<TunerUIProps> = ({ 
    loraStrength = 0, 
    stemLevels = { vox: 0, drum: 0, bass: 0, other: 0 } 
}) => {
  
  const isWeak = loraStrength < 30;
  const isDead = loraStrength === 0;

  const Bar = ({ level, color }: { level: number, color: string }) => (
      <div className="w-full h-1 bg-gray-800 mt-1">
          <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, level * 100))}%` }}></div>
      </div>
  );

  return (
    <div className="w-64 h-64 sm:w-[300px] sm:h-[300px] bg-[#0a0a0a] border border-[#333] rounded-full flex flex-col items-center justify-center relative p-4 sm:p-8 shadow-neo-inner overflow-hidden">
        
        {/* Signal Status Header */}
        <div className="text-center mb-2 sm:mb-4 z-10">
            <div className="text-[8px] sm:text-[10px] text-gray-500 font-bold tracking-[0.2em] mb-1">SIGNAL INTEGRITY</div>
            <div className={`text-xl sm:text-2xl font-mono font-bold ${isDead ? 'text-red-600' : isWeak ? 'text-yellow-500' : 'text-accent'}`}>
                {loraStrength.toFixed(0)}<span className="text-xs sm:text-sm text-gray-600">%</span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-600 font-mono mt-1">
                {isDead ? 'NO LINK' : isWeak ? 'WEAK SIGNAL' : 'HIVE SYNCED'}
            </div>
        </div>

        {/* Tactical Grid Visualization */}
        <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-4 w-full z-10 px-2">
            
            <div className="text-right">
                <div className="text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">VOX</div>
                <div className="text-[8px] sm:text-[9px] font-mono text-accent">{(stemLevels.vox * 100).toFixed(0)}</div>
                <Bar level={stemLevels.vox} color="bg-yellow-400" />
            </div>

            <div className="text-left">
                <div className="text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">DRUM</div>
                <div className="text-[8px] sm:text-[9px] font-mono text-accent">{(stemLevels.drum * 100).toFixed(0)}</div>
                <Bar level={stemLevels.drum} color="bg-red-500" />
            </div>

            <div className="text-right">
                <div className="text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">BASS</div>
                <div className="text-[8px] sm:text-[9px] font-mono text-accent">{(stemLevels.bass * 100).toFixed(0)}</div>
                <Bar level={stemLevels.bass} color="bg-blue-500" />
            </div>

            <div className="text-left">
                <div className="text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">SYNT</div>
                <div className="text-[8px] sm:text-[9px] font-mono text-accent">{(stemLevels.other * 100).toFixed(0)}</div>
                <Bar level={stemLevels.other} color="bg-purple-500" />
            </div>
        </div>

        {/* Background Grid Lines (CSS Only, Lightweight) */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
             style={{ 
                 backgroundImage: 'linear-gradient(#00ff41 1px, transparent 1px), linear-gradient(90deg, #00ff41 1px, transparent 1px)', 
                 backgroundSize: '20px 20px',
                 backgroundPosition: 'center'
             }}>
        </div>
        
        {/* Animated Scanline */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent h-full w-full animate-scan pointer-events-none z-0"></div>

    </div>
  );
};

export default TunerUI;
