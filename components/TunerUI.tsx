
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

  // Calculate SVG circle properties
  const size = 280;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (loraStrength / 100) * circumference;

  const Bar = ({ level, color, label }: { level: number, color: string, label: string }) => (
      <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8px] font-mono">
              <span className="text-gray-500">{label}</span>
              <span className="text-accent">{(level * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-1 bg-gray-800/50 rounded-full overflow-hidden">
              <div className={`h-full ${color} transition-all duration-500 ease-out`} style={{ width: `${Math.min(100, Math.max(0, level * 100))}%` }}></div>
          </div>
      </div>
  );

  return (
    <div className="w-64 h-64 sm:w-72 sm:h-72 lg:w-[320px] lg:h-[320px] bg-[#050505] border border-gray-800 rounded-full flex flex-col items-center justify-center relative shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 group">
        
        {/* SVG Circular Meter */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10" viewBox={`0 0 ${size} ${size}`}>
            {/* Background Circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="rgba(31, 41, 55, 0.3)"
                strokeWidth={strokeWidth}
            />
            {/* Progress Circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={isDead ? '#ef4444' : isWeak ? '#eab308' : '#00ff41'}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
                style={{ filter: `drop-shadow(0 0 5px ${isDead ? '#ef4444' : isWeak ? '#eab308' : '#00ff41'})` }}
            />
            
            {/* Ticks */}
            {[...Array(12)].map((_, i) => (
                <line
                    key={i}
                    x1={size / 2}
                    y1={size / 2 - radius + 15}
                    x2={size / 2}
                    y2={size / 2 - radius + 5}
                    stroke="rgba(156, 163, 175, 0.2)"
                    strokeWidth="1"
                    transform={`rotate(${i * 30}, ${size / 2}, ${size / 2})`}
                />
            ))}
        </svg>

        {/* Signal Status Header */}
        <div className="text-center mb-4 z-20">
            <div className="text-[8px] lg:text-[10px] text-gray-500 font-bold tracking-[0.3em] mb-1 uppercase opacity-60">SIGNAL_INTEGRITY</div>
            <div className={`text-3xl lg:text-4xl font-mono font-black tracking-tighter ${isDead ? 'text-red-600' : isWeak ? 'text-yellow-500' : 'text-accent'}`}>
                {loraStrength.toFixed(0)}<span className="text-xs lg:text-sm text-gray-600 ml-1">%</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isDead ? 'bg-red-600' : isWeak ? 'bg-yellow-500 animate-pulse' : 'bg-accent animate-pulse'}`}></div>
                <div className="text-[8px] lg:text-[10px] text-gray-400 font-mono tracking-widest uppercase">
                    {isDead ? 'NO_LINK' : isWeak ? 'WEAK_SIGNAL' : 'HIVE_SYNCED'}
                </div>
            </div>
        </div>

        {/* Tactical Grid Visualization */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full z-20 px-8 lg:px-12">
            <Bar level={stemLevels.vox} color="bg-yellow-400" label="VOX" />
            <Bar level={stemLevels.drum} color="bg-red-500" label="DRM" />
            <Bar level={stemLevels.bass} color="bg-blue-500" label="BSS" />
            <Bar level={stemLevels.other} color="bg-purple-500" label="SYN" />
        </div>

        {/* Background Grid Lines */}
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" 
             style={{ 
                 backgroundImage: 'linear-gradient(#00ff41 1px, transparent 1px), linear-gradient(90deg, #00ff41 1px, transparent 1px)', 
                 backgroundSize: '32px 32px',
                 backgroundPosition: 'center'
             }}>
        </div>
        
        {/* Animated Scanline */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent h-full w-full animate-scan pointer-events-none z-0"></div>
        
        {/* Radial Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-10"></div>
    </div>
  );
};

export default TunerUI;
