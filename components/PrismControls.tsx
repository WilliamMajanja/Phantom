
import React, { useState, useEffect, useRef } from 'react';
import Knob from './Knob';
import { shadowCore } from '../services/audio/ShadowCore';
import { radioService } from '../services/radioService';

interface PrismControlsProps {
    onSessionImport?: (json: any) => void;
    onFreqChange?: (freq: number) => void;
}

interface AudioFile {
    id: string;
    name: string;
    file: File;
}

const PrismControls: React.FC<PrismControlsProps> = ({ onSessionImport, onFreqChange }) => {
  const [active, setActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  
  // Library State
  const [library, setLibrary] = useState<AudioFile[]>([]);
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);

  // Device Lists
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');
  
  // Audio State
  const [stems, setStems] = useState({ vocals: 100, drums: 100, bass: 100, other: 100 });
  const [stemMutes, setStemMutes] = useState({ vocals: false, drums: false, bass: false, other: false });
  
  const [micParams, setMicParams] = useState({ gain: 0, ducking: 0, feedback: 0 });
  const [sampleParams, setSampleParams] = useState({ rate: 100, detune: 0, volume: 80, loop: 0 });
  const [masterVolume, setMasterVolume] = useState(80);
  
  // Performance Core State
  const [perfParams, setPerfParams] = useState({ filter: 50, crush: 0, delay: 0, reverb: 0 });
  const [loopActive, setLoopActive] = useState<number | null>(null);

  const sessionInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Dragging State for Stems
  const [draggingStem, setDraggingStem] = useState<string | null>(null);

  useEffect(() => {
      const getDevices = async () => {
          try {
              await navigator.mediaDevices.getUserMedia({ audio: true });
              const devs = await navigator.mediaDevices.enumerateDevices();
              setInputDevices(devs.filter(d => d.kind === 'audioinput'));
              setOutputDevices(devs.filter(d => d.kind === 'audiooutput'));
          } catch (e) {
              console.warn("Device enumeration failed", e);
          }
      };
      getDevices();
  }, []);

  // --- STEMS LOGIC ---
  const updateStem = (stem: keyof typeof stems, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setStems(prev => ({ ...prev, [stem]: clamped }));
    // Only update audio if not muted
    if (!stemMutes[stem]) {
        shadowCore.updatePrismStem(stem as any, clamped / 100);
    }
  };

  const toggleStemMute = (stem: keyof typeof stems) => {
      const isMuted = !stemMutes[stem];
      setStemMutes(prev => ({...prev, [stem]: isMuted}));
      shadowCore.updatePrismStem(stem as any, isMuted ? 0 : stems[stem] / 100);
  };

  const handleStemDrag = (e: React.MouseEvent | MouseEvent, stem: keyof typeof stems, rect: DOMRect) => {
      const height = rect.height;
      const bottom = rect.bottom;
      const y = e.clientY;
      const delta = bottom - y;
      const percent = (delta / height) * 100;
      updateStem(stem, percent);
  };

  // --- SAMPLE PLAYER LOGIC ---
  const toggleSample = () => {
      setIsPlayingSample(!isPlayingSample);
      shadowCore.togglePrismPlayback();
  }

  const updateSampleParam = (param: keyof typeof sampleParams, val: number) => {
      setSampleParams(prev => ({ ...prev, [param]: val }));
      
      if (param === 'rate') shadowCore.setPrismParam('rate', val / 100);
      if (param === 'detune') shadowCore.setPrismParam('detune', val); // Direct Cents
      if (param === 'volume') shadowCore.setPrismParam('volume', val / 100);
      if (param === 'loop') shadowCore.setPrismParam('loop', val); // 0 or 1
  }

  const loadTrackFromLibrary = (id: string) => {
      const track = library.find(t => t.id === id);
      if (track) {
          shadowCore.loadPrismSample(track.file);
          setLoadedTrackId(id);
          setActive(true);
      }
  };

  // --- MIC LOGIC ---
  const toggleMic = () => {
      const newState = !micActive;
      setMicActive(newState);
      if (newState) {
          shadowCore.initMic(selectedInputId);
          shadowCore.setMicGain(micParams.gain / 100);
      } else {
          shadowCore.setMicGain(0);
      }
  };

  const updateMicParam = (param: keyof typeof micParams, val: number) => {
      setMicParams(prev => ({ ...prev, [param]: val }));
      const norm = val / 100;
      if (param === 'gain' && micActive) shadowCore.setMicGain(norm);
      if (param === 'ducking') shadowCore.setDuckingAmount(norm);
  };

  // --- PERFORMANCE FX LOGIC ---
  const updatePerfParam = (param: keyof typeof perfParams, val: number) => {
      setPerfParams(prev => ({ ...prev, [param]: val }));
      
      if (param === 'filter') {
          shadowCore.setMasterFilter((val - 50) / 50);
      } else if (param === 'crush') {
          shadowCore.setCrushAmount(val / 100);
      } else if (param === 'delay') {
          shadowCore.setDelaySend(val / 100);
      } else if (param === 'reverb') {
          shadowCore.setReverbSend(val / 100);
      }
  }

  // --- LOOP ROLLER LOGIC ---
  const handleLoop = (interval: number, isRelease: boolean = false) => {
    if (isRelease) {
        if (loopActive === interval) {
            setLoopActive(null);
            shadowCore.setStutter(false);
        }
    } else {
        // Press
        setLoopActive(interval);
        shadowCore.setStutter(true, interval);
    }
  };

  // --- IO HANDLERS ---
  const handleOutputChange = (deviceId: string) => {
      setSelectedOutputId(deviceId);
      shadowCore.setOutputDevice(deviceId);
  };

  const handleMasterVolChange = (val: number) => {
      setMasterVolume(val);
      shadowCore.setMasterVolume(val / 100);
  }

  const handleSessionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onSessionImport) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const json = JSON.parse(evt.target?.result as string);
              const state = json.state || json; 
              onSessionImport(state);
          } catch (err) {
              console.error("Invalid Session File");
          }
      };
      reader.readAsText(file);
  };

  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          const newTracks = Array.from(files).map((f: File) => ({
              id: `prism_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
              name: f.name.replace(/\.[^/.]+$/, ""), // strip extension
              file: f
          }));
          
          setLibrary(prev => [...prev, ...newTracks]);
          
          // Auto-load first if active empty
          if (!loadedTrackId && newTracks.length > 0) {
             loadTrackFromLibrary(newTracks[0].id);
          }
      }
  };

  return (
    <div className="glass-panel p-4 sm:p-6 flex flex-col gap-6 sm:gap-8 h-full bg-black/50">
      
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
         <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-textLight font-bold tracking-widest uppercase">I/O Matrix</span>
            <span className="text-[8px] sm:text-[10px] text-accent font-mono">ROUTING // SAMPLER // FX</span>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
          
          {/* LEFT COLUMN: SOURCE & SAMPLER */}
          <div className="space-y-6">
              
              {/* DATA INGEST */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="file" ref={sessionInputRef} onChange={handleSessionFile} accept=".json" className="hidden" />
                  <button 
                     onClick={() => sessionInputRef.current?.click()}
                     className="bg-gray-900 border border-gray-700 hover:border-accent p-2 sm:p-3 text-left group transition-all"
                  >
                      <div className="text-[8px] sm:text-[9px] text-gray-500 group-hover:text-accent font-bold mb-1 uppercase">DATA IMPORT</div>
                      <div className="text-[10px] sm:text-xs text-white font-mono">LOAD SESSION</div>
                  </button>

                  <input type="file" ref={audioInputRef} onChange={handleAudioFile} accept="audio/*" multiple className="hidden" />
                  <button 
                     onClick={() => audioInputRef.current?.click()}
                     className={`bg-gray-900 border ${loadedTrackId ? 'border-accent/50' : 'border-gray-700'} hover:border-accent p-2 sm:p-3 text-left group transition-all`}
                  >
                      <div className="text-[8px] sm:text-[9px] text-gray-500 group-hover:text-accent font-bold mb-1 uppercase">AUDIO IMPORT</div>
                      <div className="text-[10px] sm:text-xs text-white font-mono">{library.length > 0 ? `${library.length} TRACKS` : 'LOAD MP3/WAV'}</div>
                  </button>
              </div>

              {/* LIBRARY QUEUE */}
              {library.length > 0 && (
                  <div className="max-h-32 overflow-y-auto bg-black/40 border border-gray-800 rounded custom-scrollbar">
                      {library.map(track => (
                          <div 
                            key={track.id}
                            onClick={() => loadTrackFromLibrary(track.id)}
                            className={`
                                p-2 text-[10px] font-mono border-b border-gray-800 cursor-pointer flex justify-between items-center hover:bg-white/5
                                ${loadedTrackId === track.id ? 'text-accent bg-accent/5' : 'text-gray-400'}
                            `}
                          >
                              <span className="truncate max-w-[80%]">{track.name}</span>
                              {loadedTrackId === track.id && <span className="animate-pulse">▶</span>}
                          </div>
                      ))}
                  </div>
              )}

              {/* SAMPLE OPERATIONS */}
              <div className={`transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-50'}`}>
                  <div className="flex justify-between items-center mb-3">
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">PRISM_DECK // TRANSPORT</span>
                     <div className="flex gap-1.5">
                        <button 
                            onClick={() => updateSampleParam('loop', sampleParams.loop ? 0 : 1)}
                            className={`px-2 py-1 text-[8px] font-bold border rounded transition-all ${sampleParams.loop ? 'border-accent text-accent bg-accent/10' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}
                        >
                            LOOP
                        </button>
                        <div className="flex bg-gray-900 rounded border border-gray-800 p-0.5">
                            <button 
                                onClick={() => {
                                    if (isPlayingSample) {
                                        toggleSample();
                                    } else {
                                        toggleSample();
                                    }
                                }}
                                disabled={!loadedTrackId}
                                className={`px-3 py-1 text-[9px] font-bold rounded-sm transition-all ${isPlayingSample ? 'bg-accent text-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                {isPlayingSample ? 'PAUSE' : 'PLAY'}
                            </button>
                            <button 
                                onClick={() => {
                                    setIsPlayingSample(false);
                                    shadowCore.stopPrismPlayback();
                                }}
                                disabled={!loadedTrackId}
                                className="px-3 py-1 text-[9px] font-bold text-gray-400 hover:text-red-500 transition-all border-l border-gray-800"
                            >
                                STOP
                            </button>
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Knob label="RATE" value={sampleParams.rate} min={10} max={200} onChange={(v) => updateSampleParam('rate', v)} size="sm" color="text-yellow-400" />
                    <Knob label="DETUNE" value={sampleParams.detune} min={-1200} max={1200} step={50} onChange={(v) => updateSampleParam('detune', v)} size="sm" color="text-purple-400" />
                    <Knob label="VOL" value={sampleParams.volume} min={0} max={100} onChange={(v) => updateSampleParam('volume', v)} size="sm" color="text-white" />
                    
                    {/* Stems control */}
                    <div className="flex flex-col items-center justify-end pb-0 relative h-20 bg-gray-900/40 rounded border border-gray-800 p-1 col-span-1">
                         <div className="flex gap-1 w-full h-full items-end justify-between px-1">
                             {/* STEM COLUMNS with MUTE TOGGLES */}
                             {[
                                 { key: 'bass', color: 'bg-blue-500', label: 'BASS' },
                                 { key: 'drums', color: 'bg-red-500', label: 'DRUM' },
                                 { key: 'vocals', color: 'bg-yellow-400', label: 'VOX' },
                                 { key: 'other', color: 'bg-purple-500', label: 'SYN' }
                             ].map((stem) => {
                                 const k = stem.key as keyof typeof stems;
                                 return (
                                     <div key={k} className="w-1/4 h-full flex flex-col justify-end group relative">
                                         <div 
                                            className={`w-full flex-grow bg-gray-800 rounded-sm relative overflow-hidden cursor-ns-resize ${stemMutes[k] ? 'opacity-30' : ''}`}
                                            onMouseDown={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                handleStemDrag(e, k, rect);
                                                const moveHandler = (ev: MouseEvent) => handleStemDrag(ev, k, rect);
                                                const upHandler = () => {
                                                    window.removeEventListener('mousemove', moveHandler);
                                                    window.removeEventListener('mouseup', upHandler);
                                                };
                                                window.addEventListener('mousemove', moveHandler);
                                                window.addEventListener('mouseup', upHandler);
                                            }}
                                         >
                                             <div className={`absolute bottom-0 left-0 w-full ${stem.color} transition-all pointer-events-none`} style={{height: `${stems[k]}%`}}></div>
                                         </div>
                                         <button 
                                            onClick={() => toggleStemMute(k)}
                                            className={`text-[8px] font-mono mt-1 uppercase tracking-wider text-center hover:text-white ${stemMutes[k] ? 'text-red-500 line-through' : 'text-gray-500'}`}
                                         >
                                             {stem.label}
                                         </button>
                                     </div>
                                 )
                             })}
                         </div>
                    </div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: FX & OUTPUT */}
          <div className="space-y-6">
              
              {/* PERFORMANCE CORE */}
              <div className="border border-white/10 rounded p-4 bg-black/20">
                  <div className="flex justify-between items-center mb-3">
                     <span className="text-[10px] font-bold text-gray-500">PERFORMANCE_CORE // FLUX_ENGINE</span>
                     <div className={`text-[9px] font-mono ${loopActive !== null ? 'text-accent animate-pulse shadow-[0_0_5px_#00ff41]' : 'text-gray-600'}`}>
                        {loopActive !== null ? 'SLIP_ENGAGED' : 'QUANTIZE_READY'}
                     </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                      <Knob label="FILTER" value={perfParams.filter} min={0} max={100} onChange={(v) => updatePerfParam('filter', v)} size="sm" color={perfParams.filter < 45 ? 'text-blue-400' : perfParams.filter > 55 ? 'text-red-400' : 'text-gray-400'} />
                      <Knob label="CRUSH" value={perfParams.crush} min={0} max={100} onChange={(v) => updatePerfParam('crush', v)} size="sm" color="text-yellow-500" />
                      <Knob label="DELAY" value={perfParams.delay} min={0} max={100} onChange={(v) => updatePerfParam('delay', v)} size="sm" color="text-purple-400" />
                      <Knob label="VERB" value={perfParams.reverb} min={0} max={100} onChange={(v) => updatePerfParam('reverb', v)} size="sm" color="text-blue-300" />
                  </div>

                  <div className="mt-3 flex flex-col gap-2 bg-gray-900/40 p-2 rounded border border-gray-800">
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500">QUANTIZED_SLIP</span>
                        <span className="text-[8px] font-mono text-gray-600">BPM_SYNC</span>
                    </div>
                    <div className="flex gap-1 justify-between w-full">
                        {[
                            { l: '1/2', v: 8 },
                            { l: '1/4', v: 4 },
                            { l: '1/8', v: 2 },
                            { l: '1/16', v: 1 },
                            { l: '1/32', v: 0.5 }
                        ].map(opt => (
                            <button
                                key={opt.v}
                                onMouseDown={() => handleLoop(opt.v, false)}
                                onMouseUp={() => handleLoop(opt.v, true)}
                                onMouseLeave={() => handleLoop(opt.v, true)}
                                onTouchStart={(e) => { e.preventDefault(); handleLoop(opt.v, false); }}
                                onTouchEnd={(e) => { e.preventDefault(); handleLoop(opt.v, true); }}
                                className={`
                                    h-8 flex-1 rounded flex items-center justify-center border text-[9px] font-bold font-mono transition-all
                                    ${loopActive === opt.v
                                        ? 'bg-accent text-black border-accent shadow-[0_0_10px_#00ff41] scale-95' 
                                        : 'bg-black border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}
                                `}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>
                  </div>
              </div>

              {/* INPUT SOURCE (MIC) */}
              <div>
                  <div className="flex justify-between items-center mb-3">
                     <span className="text-[10px] font-bold text-gray-500">SOURCE_A // MIC</span>
                     <div className="flex items-center gap-2">
                         <select 
                            value={selectedInputId}
                            onChange={(e) => setSelectedInputId(e.target.value)}
                            className="bg-black text-[9px] text-gray-400 border border-gray-800 rounded px-2 py-1 max-w-[100px]"
                         >
                             {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `In ${d.deviceId.slice(0,4)}`}</option>)}
                         </select>
                         <button 
                            onClick={toggleMic}
                            className={`px-2 py-1 text-[9px] font-bold border rounded ${micActive ? 'border-red-500 text-red-500 animate-pulse' : 'border-gray-700 text-gray-500'}`}
                         >
                             {micActive ? 'ON AIR' : 'MUTED'}
                         </button>
                     </div>
                  </div>

                  <div className={`grid grid-cols-3 gap-2 transition-opacity ${micActive ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      <Knob label="GAIN" value={micParams.gain} min={0} max={100} onChange={(v) => updateMicParam('gain', v)} size="sm" color="text-red-500" />
                      <Knob label="DUCKING" value={micParams.ducking} min={0} max={100} onChange={(v) => updateMicParam('ducking', v)} size="sm" color="text-accent" />
                      <Knob label="FB_KILL" value={micParams.feedback} min={0} max={100} onChange={(v) => updateMicParam('feedback', v)} size="sm" color="text-gray-400" />
                  </div>
              </div>

              {/* MASTER OUTPUT & BROADCAST */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="bg-accent/5 border border-accent/20 rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                         <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                             <span className="text-[10px] font-black text-accent tracking-[0.2em] uppercase">Pirate_Radio // FM_RDS</span>
                         </div>
                         <span className="text-[8px] font-mono text-gray-500">GPIO_04 // ACTIVE</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                          <div className="flex-1 bg-black border border-gray-800 rounded flex items-center px-3 py-1.5">
                              <span className="text-[10px] font-mono text-gray-600 mr-2">FREQ:</span>
                              <input 
                                  type="number" 
                                  step="0.1"
                                  defaultValue="101.1" 
                                  className="bg-transparent text-sm font-mono text-accent w-full focus:outline-none tabular-nums"
                                  onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val)) radioService.joinFrequency(val.toFixed(1));
                                  }}
                              />
                              <span className="text-[10px] font-mono text-gray-600 ml-2">MHz</span>
                          </div>
                          <button 
                             className="px-4 py-2 bg-accent text-black text-[10px] font-black rounded-sm hover:bg-accent/80 transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,65,0.2)]"
                             onClick={() => {
                                 // Simulation of starting the Python script via radioService or similar
                                 console.log("FM Broadcast Started");
                             }}
                          >
                              TX_START
                          </button>
                      </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-bold text-accent tracking-widest">MASTER_BUS // OUT</span>
                     <select 
                        value={selectedOutputId}
                        onChange={(e) => handleOutputChange(e.target.value)}
                        className="bg-black text-[9px] text-accent border border-gray-700 rounded px-2 py-1 max-w-[140px] focus:border-accent outline-none"
                     >
                         <option value="">Default Output</option>
                         {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Out ${d.deviceId.slice(0,4)}`}</option>)}
                     </select>
                  </div>

                  <div className="flex items-center justify-between gap-4 bg-gray-900/40 p-3 rounded border border-gray-800">
                      <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_5px_#00ff41]"></div>
                              <span className="text-[9px] text-gray-400 font-mono">LIMITER_ENGAGED</span>
                          </div>
                          <div className="text-[7px] text-gray-600 font-mono">THR: -0.1dB // REL: 50ms</div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                          <div className="h-12 w-1.5 bg-gray-800 rounded-full overflow-hidden flex flex-col justify-end shadow-inner">
                              <div className="w-full bg-accent transition-all duration-100" style={{ height: `${masterVolume}%`, filter: 'brightness(1.2)' }}></div>
                          </div>
                          <Knob 
                            label="MASTER VOL" 
                            value={masterVolume} 
                            min={0} max={100} 
                            onChange={handleMasterVolChange} 
                            size="md" 
                            color="text-white" 
                          />
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PrismControls;
