
import React, { useState, useRef, useEffect } from 'react';
import { shadowCore } from '../services/audio/ShadowCore';
import Knob from './Knob';

const PerformancePad: React.FC = () => {
    const [filterVal, setFilterVal] = useState(50);
    const [crushVal, setCrushVal] = useState(0);
    const [delayVal, setDelayVal] = useState(0);
    const [reverbVal, setReverbVal] = useState(0);
    const [stutterMode, setStutterMode] = useState<number | null>(null);
    const [xy, setXY] = useState({ x: 0.5, y: 0 }); // Center X, Bottom Y
    const [draggingXY, setDraggingXY] = useState(false);
    const xyRef = useRef<HTMLDivElement>(null);

    const handleFilterChange = (val: number) => {
        setFilterVal(val);
        const normalized = (val - 50) / 50;
        shadowCore.setMasterFilter(normalized);
    };

    const handleCrushChange = (val: number) => {
        setCrushVal(val);
        shadowCore.setCrushAmount(val / 100);
    };

    const handleDelayChange = (val: number) => {
        setDelayVal(val);
        shadowCore.setDelaySend(val / 100);
    };

    const handleReverbChange = (val: number) => {
        setReverbVal(val);
        shadowCore.setReverbSend(val / 100);
    };

    const toggleStutter = (interval: number) => {
        if (stutterMode === interval) {
            setStutterMode(null);
            shadowCore.setStutter(false);
        } else {
            setStutterMode(interval);
            shadowCore.setStutter(true, interval);
        }
    };

    // XY Pad Logic
    const updateXY = (e: MouseEvent | React.MouseEvent) => {
        if (!xyRef.current) return;
        const rect = xyRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, 1 - ((e.clientY - rect.top) / rect.height))); // 0 at bottom
        setXY({ x, y });
        shadowCore.setXYPad(x, y);
    };

    const handleXYDown = (e: React.MouseEvent) => {
        setDraggingXY(true);
        updateXY(e);
    };

    useEffect(() => {
        const up = () => setDraggingXY(false);
        const move = (e: MouseEvent) => { if (draggingXY) updateXY(e); };
        window.addEventListener('mouseup', up);
        window.addEventListener('mousemove', move);
        return () => {
            window.removeEventListener('mouseup', up);
            window.removeEventListener('mousemove', move);
        };
    }, [draggingXY]);

    return (
        <div className="glass-panel p-6 bg-gray-900/50 flex flex-col gap-6 border-accent/20">
            
            <div className="flex justify-between items-center w-full">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-accent tracking-widest uppercase">PERFORMANCE_CORE</span>
                    <span className="text-[10px] text-gray-500 font-mono">REALTIME_FX_CHAIN</span>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
                
                {/* VECTOR CONTROL (XY PAD) */}
                <div 
                    ref={xyRef}
                    onMouseDown={handleXYDown}
                    className="w-48 h-48 bg-black border border-gray-700 relative cursor-crosshair overflow-hidden shadow-neo-inner group"
                >
                    {/* Grid Lines */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" 
                        style={{backgroundImage: 'linear-gradient(gray 1px, transparent 1px), linear-gradient(90deg, gray 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                    </div>
                    
                    {/* Axis Labels */}
                    <span className="absolute bottom-1 left-2 text-[8px] font-mono text-gray-500">FILTER FREQ</span>
                    <span className="absolute top-2 left-1 text-[8px] font-mono text-gray-500 rotate-90 origin-top-left">RES / CRUSH</span>

                    {/* Reticle */}
                    <div 
                        className="absolute w-4 h-4 border-2 border-accent rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_10px_#00ff41] transition-transform duration-75"
                        style={{ left: `${xy.x * 100}%`, bottom: `${xy.y * 100}%` }}
                    >
                        <div className="absolute top-1/2 left-1/2 w-0.5 h-full bg-accent/50 -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute top-1/2 left-1/2 w-full h-0.5 bg-accent/50 -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                </div>

                {/* MACRO KNOBS */}
                <div className="grid grid-cols-2 gap-4">
                    <Knob label="M_FILTER" value={filterVal} min={0} max={100} onChange={handleFilterChange} size="sm" color={filterVal < 45 ? 'text-blue-400' : filterVal > 55 ? 'text-red-400' : 'text-gray-400'} />
                    <Knob label="DATA_ROT" value={crushVal} min={0} max={100} onChange={handleCrushChange} size="sm" color="text-yellow-500" />
                    <Knob label="DUB_DELAY" value={delayVal} min={0} max={100} onChange={handleDelayChange} size="sm" color="text-purple-400" />
                    <Knob label="DARK_VERB" value={reverbVal} min={0} max={100} onChange={handleReverbChange} size="sm" color="text-blue-300" />
                </div>

                {/* SCENE LAUNCH & STUTTER */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-gray-600 tracking-widest">FLUX_ENGINE</span>
                        <div className="flex gap-2">
                            {[4, 2, 1].map((interval) => {
                                const label = interval === 4 ? '1/4' : interval === 2 ? '1/8' : '1/16';
                                const isActive = stutterMode === interval;
                                return (
                                    <button
                                        key={interval}
                                        onMouseDown={() => toggleStutter(interval)}
                                        onMouseUp={() => { if(isActive) toggleStutter(interval); }} 
                                        className={`
                                            w-10 h-10 rounded flex items-center justify-center font-bold text-xs font-mono border transition-all
                                            ${isActive 
                                                ? 'bg-accent text-black border-accent shadow-[0_0_10px_#00ff41] scale-95' 
                                                : 'bg-black border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}
                                        `}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-gray-600 tracking-widest">SCENE_LAUNCH</span>
                        <div className="grid grid-cols-2 gap-2">
                             <button className="h-8 bg-gray-800 border border-gray-700 text-[9px] text-gray-400 hover:bg-gray-700 hover:text-white">SCENE A</button>
                             <button className="h-8 bg-gray-800 border border-gray-700 text-[9px] text-gray-400 hover:bg-gray-700 hover:text-white">SCENE B</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PerformancePad;
