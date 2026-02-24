
import React, { useState, useRef, useEffect } from 'react';
import { shadowCore } from '../services/audio/ShadowCore';
import Knob from './Knob';

const PerformancePad: React.FC = () => {
    const [filterVal, setFilterVal] = useState(50);
    const [crushVal, setCrushVal] = useState(0);
    const [delayVal, setDelayVal] = useState(0);
    const [reverbVal, setReverbVal] = useState(0);
    const [stutterMode, setStutterMode] = useState<number | null>(null);
    const [isTapeStop, setIsTapeStop] = useState(false);
    const [isDelayFreeze, setIsDelayFreeze] = useState(false);
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

    const toggleTapeStop = () => {
        const newState = !isTapeStop;
        setIsTapeStop(newState);
        shadowCore.setTapeStop(newState);
    };

    const toggleDelayFreeze = () => {
        const newState = !isDelayFreeze;
        setIsDelayFreeze(newState);
        shadowCore.setDelayFreeze(newState);
    };

    // XY Pad Logic
    const updateXY = (clientX: number, clientY: number) => {
        if (!xyRef.current) return;
        const rect = xyRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, 1 - ((clientY - rect.top) / rect.height))); // 0 at bottom
        setXY({ x, y });
        shadowCore.setXYPad(x, y);
    };

    const handleXYDown = (e: React.MouseEvent) => {
        setDraggingXY(true);
        updateXY(e.clientX, e.clientY);
    };

    const handleXYTouchStart = (e: React.TouchEvent) => {
        setDraggingXY(true);
        updateXY(e.touches[0].clientX, e.touches[0].clientY);
    };

    useEffect(() => {
        const up = () => setDraggingXY(false);
        const move = (e: MouseEvent) => { if (draggingXY) updateXY(e.clientX, e.clientY); };
        const touchMove = (e: TouchEvent) => {
            if (draggingXY) {
                if (e.cancelable) e.preventDefault();
                updateXY(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        window.addEventListener('mouseup', up);
        window.addEventListener('mousemove', move);
        window.addEventListener('touchend', up);
        window.addEventListener('touchmove', touchMove, { passive: false });

        return () => {
            window.removeEventListener('mouseup', up);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('touchend', up);
            window.removeEventListener('touchmove', touchMove);
        };
    }, [draggingXY]);

    return (
        <div className="glass-panel p-4 sm:p-6 bg-gray-900/50 flex flex-col gap-4 sm:gap-6 border-accent/20 w-full">
            
            <div className="flex justify-between items-center w-full">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] sm:text-xs font-bold text-accent tracking-widest uppercase">PERFORMANCE_CORE</span>
                    <span className="text-[8px] sm:text-[10px] text-gray-500 font-mono">REALTIME_FX_CHAIN</span>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={toggleTapeStop}
                        className={`h-8 px-4 text-[9px] font-bold border transition-all rounded-sm ${isTapeStop ? 'bg-red-500 text-black border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-black border-gray-800 text-gray-500 hover:border-red-500/50'}`}
                    >
                        TAPE_STOP
                    </button>
                    <button 
                        onClick={toggleDelayFreeze}
                        className={`h-8 px-4 text-[9px] font-bold border transition-all rounded-sm ${isDelayFreeze ? 'bg-blue-500 text-black border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-black border-gray-800 text-gray-500 hover:border-blue-500/50'}`}
                    >
                        DLY_FREEZE
                    </button>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 sm:gap-8 items-center justify-center">
                
                {/* VECTOR CONTROL (XY PAD) */}
                <div 
                    ref={xyRef}
                    onMouseDown={handleXYDown}
                    onTouchStart={handleXYTouchStart}
                    className="w-40 h-40 sm:w-64 sm:h-64 bg-black border border-gray-700 relative cursor-crosshair overflow-hidden shadow-neo-inner group shrink-0 touch-none"
                >
                    {/* Grid Lines */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" 
                        style={{backgroundImage: 'linear-gradient(gray 1px, transparent 1px), linear-gradient(90deg, gray 1px, transparent 1px)', backgroundSize: '32px 32px'}}>
                    </div>
                    
                    {/* Axis Labels */}
                    <span className="absolute bottom-1 left-2 text-[8px] font-mono text-gray-500">FILTER FREQ</span>
                    <span className="absolute top-2 left-1 text-[8px] font-mono text-gray-500 rotate-90 origin-top-left">RES / CRUSH</span>

                    {/* Dynamic Glow */}
                    <div 
                        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                        style={{ 
                            background: `radial-gradient(circle at ${xy.x * 100}% ${100 - (xy.y * 100)}%, rgba(0, 255, 65, 0.15) 0%, transparent 50%)`,
                            opacity: draggingXY ? 1 : 0.3
                        }}
                    ></div>

                    {/* Reticle */}
                    <div 
                        className="absolute w-6 h-6 border-2 border-accent rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_15px_#00ff41] transition-transform duration-75"
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
                        <span className="text-[9px] font-bold text-gray-600 tracking-widest uppercase">FLUX_ENGINE // STUTTER</span>
                        <div className="grid grid-cols-3 gap-2">
                            {[8, 4, 2, 1, 0.5, 0.25].map((interval) => {
                                const label = interval === 8 ? '1/2' : interval === 4 ? '1/4' : interval === 2 ? '1/8' : interval === 1 ? '1/16' : interval === 0.5 ? '1/32' : '1/64';
                                const isActive = stutterMode === interval;
                                return (
                                    <button
                                        key={interval}
                                        onMouseDown={() => toggleStutter(interval)}
                                        onMouseUp={() => { if(isActive) toggleStutter(interval); }} 
                                        onTouchStart={(e) => { e.preventDefault(); toggleStutter(interval); }}
                                        onTouchEnd={(e) => { e.preventDefault(); if(isActive) toggleStutter(interval); }}
                                        className={`
                                            w-12 h-10 rounded flex items-center justify-center font-bold text-[10px] font-mono border transition-all touch-none
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
                        <span className="text-[9px] font-bold text-gray-600 tracking-widest uppercase">SCENE_LAUNCH</span>
                        <div className="grid grid-cols-2 gap-2">
                             <button className="h-10 bg-gray-900 border border-gray-700 text-[9px] font-bold text-gray-400 hover:bg-gray-800 hover:text-white hover:border-accent/50 transition-all rounded-sm">SCENE A</button>
                             <button className="h-10 bg-gray-900 border border-gray-700 text-[9px] font-bold text-gray-400 hover:bg-gray-800 hover:text-white hover:border-accent/50 transition-all rounded-sm">SCENE B</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PerformancePad;
