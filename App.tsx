
import React, { useState, useEffect, useCallback, useRef } from 'react';
import SequencerGrid from './components/SequencerGrid';
import TelemetryDeck from './components/TelemetryDeck';
import ProvenanceDeck from './components/ProvenanceDeck';
import ClusterMonitor from './components/ClusterMonitor';
import GhostBridge from './components/GhostBridge';
import Knob from './components/Knob';
import PhantomSignal from './components/PhantomSignal';
import TrackInspector from './components/TrackInspector';
import PrismControls from './components/PrismControls';
import HiveSync from './components/HiveSync';
import AddTrackModal from './components/AddTrackModal';
import TunerUI from './components/TunerUI';
import PanicMonitor from './components/PanicMonitor';
import ExportInterface from './components/ExportInterface';
import PerformancePad from './components/PerformancePad';
import MixerConsole from './components/MixerConsole';
import SplashScreen from './components/SplashScreen';
import { INITIAL_STATE, INSTRUMENT_SETTINGS } from './constants';
import { SequencerState, ProvenanceRecord, InstrumentType, Track, TelemetryData, Pattern } from './types';
import { shadowCore } from './services/audio/ShadowCore';
import { anchorSpirit, captureSpiritHash, mintAxiaToken } from './services/spiritLedger';
import { phantomProtocol } from './services/phantomProtocol';
import { clusterService } from './services/clusterService';
import { radioService } from './services/radioService';

// TAB DEFINITIONS
enum Tab {
  CORE = 'SEQUENCER',
  PERFORM = 'PERFORMANCE',
  PATCHBAY = 'PATCHBAY',
  NETWORK = 'NETWORK'
}

const App: React.FC = () => {
  const [bootComplete, setBootComplete] = useState(false);
  const [state, setState] = useState<SequencerState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [provenance, setProvenance] = useState<ProvenanceRecord | null>(null);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [axiaToken, setAxiaToken] = useState<any | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);
  const [isAddTrackModalOpen, setIsAddTrackModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isClusterOnline, setIsClusterOnline] = useState(false);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CORE);

  // Hardware State
  const [telemetry, setTelemetry] = useState<TelemetryData>({
      cpuTemp: 45, npuLoad: 12, pcieLaneUsage: 20, memoryUsage: 3.2
  });
  const [tunerData, setTunerData] = useState({ rssi: 85, stems: { vox: 0.2, drum: 0.8, bass: 0.6, other: 0.4 } });
  const [isKillSwitchActive, setIsKillSwitchActive] = useState(false);

  // Refs for audio sync
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Simulation Loop
  useEffect(() => {
    if (!bootComplete) return;

    clusterService.connect(); 

    const interval = setInterval(() => {
        setTelemetry(prev => ({
            // Safe Mode: Cap temp at 70 to prevent accidental Panic Trigger (80C)
            cpuTemp: Math.min(70, Math.max(35, prev.cpuTemp + (Math.random() - 0.5) * 3)),
            npuLoad: Math.min(100, Math.max(0, prev.npuLoad + (Math.random() - 0.5) * 10)),
            pcieLaneUsage: Math.min(100, Math.max(10, prev.pcieLaneUsage + (Math.random() - 0.5) * 2)),
            memoryUsage: prev.memoryUsage
        }));

        setTunerData(prev => ({
            rssi: Math.min(100, Math.max(10, prev.rssi + (Math.random() * 10 - 5))),
            stems: {
                vox: Math.max(0, Math.min(1, prev.stems.vox + (Math.random() - 0.5) * 0.2)),
                drum: Math.max(0, Math.min(1, prev.stems.drum + (Math.random() - 0.5) * 0.2)),
                bass: Math.max(0, Math.min(1, prev.stems.bass + (Math.random() - 0.5) * 0.2)),
                other: Math.max(0, Math.min(1, prev.stems.other + (Math.random() - 0.5) * 0.2))
            }
        }));

        const nodes = clusterService.getStatus();
        setIsClusterOnline(nodes.some(n => n.id !== 'NEXUS' && n.online));

    }, 1000);
    return () => clearInterval(interval);
  }, [bootComplete]);

  // Audio Engine Synchronization
  useEffect(() => {
    shadowCore.setBpm(state.bpm);
  }, [state.bpm]);

  useEffect(() => {
      const activeTracks = state.patterns[state.activePatternId]?.tracks || [];
      shadowCore.setTracks(activeTracks);
  }, [state.activePatternId, state.patterns]);

  // Core Scheduler
  useEffect(() => {
    radioService.connect();
    
    shadowCore.setOnStepCallback((step) => {
        setCurrentStep(step);
        
        if (step === 0) {
            setState(prev => {
                if (prev.nextPatternId && prev.nextPatternId !== prev.activePatternId) {
                    return {
                        ...prev,
                        activePatternId: prev.nextPatternId,
                        nextPatternId: null,
                        tracks: prev.patterns[prev.nextPatternId].tracks
                    };
                }
                return prev;
            });
        }

        const activeTracks = stateRef.current.tracks.map(t => {
            const s = t.steps[step % t.steps.length];
            return s && s.active;
        });
        clusterService.broadcastStep(step, activeTracks);
    });
    phantomProtocol.initialize();
  }, []); 

  const handleToggleStep = useCallback((trackIndex: number, stepIndex: number) => {
    setState(prev => {
      const patternId = prev.activePatternId;
      const currentPattern = prev.patterns[patternId];
      
      const newTracks = [...currentPattern.tracks];
      const track = { ...newTracks[trackIndex] };
      const newSteps = [...track.steps];
      const currentStep = newSteps[stepIndex];
      // Toggle logic
      newSteps[stepIndex] = { 
          ...currentStep, 
          active: !currentStep.active,
          velocity: currentStep.velocity || 0.8,
          probability: currentStep.probability || 1
      };
      track.steps = newSteps;
      newTracks[trackIndex] = track;

      return { 
          ...prev, 
          tracks: newTracks, 
          patterns: {
              ...prev.patterns,
              [patternId]: {
                  ...currentPattern,
                  tracks: newTracks
              }
          }
      };
    });
  }, []);

  const handleUpdateStep = useCallback((trackIndex: number, stepIndex: number, key: 'velocity' | 'probability', val: number) => {
      setState(prev => {
          const patternId = prev.activePatternId;
          const currentPattern = prev.patterns[patternId];
          const newTracks = [...currentPattern.tracks];
          const track = { ...newTracks[trackIndex] };
          const newSteps = [...track.steps];
          
          newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              [key]: val
          };
          
          track.steps = newSteps;
          newTracks[trackIndex] = track;
          
          return {
              ...prev,
              tracks: newTracks,
              patterns: {
                  ...prev.patterns,
                  [patternId]: { ...currentPattern, tracks: newTracks }
              }
          }
      });
  }, []);

  const handleClearTrack = useCallback((trackIndex: number) => {
      setState(prev => {
          const patternId = prev.activePatternId;
          const currentPattern = prev.patterns[patternId];
          const newTracks = [...currentPattern.tracks];
          const track = { ...newTracks[trackIndex] };
          track.steps = track.steps.map(s => ({ ...s, active: false }));
          newTracks[trackIndex] = track;
          
          return {
              ...prev,
              tracks: newTracks,
              patterns: {
                  ...prev.patterns,
                  [patternId]: { ...currentPattern, tracks: newTracks }
              }
          };
      });
  }, []);

  const handleRandomizeTrack = useCallback((trackIndex: number) => {
      setState(prev => {
          const patternId = prev.activePatternId;
          const currentPattern = prev.patterns[patternId];
          const newTracks = [...currentPattern.tracks];
          const track = { ...newTracks[trackIndex] };
          track.steps = track.steps.map(s => ({ 
              ...s, 
              active: Math.random() > 0.7,
              velocity: 0.5 + Math.random() * 0.5,
              probability: 0.5 + Math.random() * 0.5
          }));
          newTracks[trackIndex] = track;
          
          return {
              ...prev,
              tracks: newTracks,
              patterns: {
                  ...prev.patterns,
                  [patternId]: { ...currentPattern, tracks: newTracks }
              }
          };
      });
  }, []);

  const handleRandomizeAll = useCallback(() => {
      setState(prev => {
          const patternId = prev.activePatternId;
          const currentPattern = prev.patterns[patternId];
          const newTracks = currentPattern.tracks.map(track => ({
              ...track,
              steps: track.steps.map(s => ({
                  ...s,
                  active: Math.random() > 0.8,
                  velocity: 0.4 + Math.random() * 0.6,
                  probability: 0.6 + Math.random() * 0.4
              }))
          }));
          
          return {
              ...prev,
              tracks: newTracks,
              patterns: {
                  ...prev.patterns,
                  [patternId]: { ...currentPattern, tracks: newTracks }
              }
          };
      });
  }, []);

  const handleUpdateTrack = useCallback((trackIndex: number, updates: Partial<Track>) => {
      setState(prev => {
          const patternId = prev.activePatternId;
          const currentPattern = prev.patterns[patternId];
          const newTracks = [...currentPattern.tracks];
          newTracks[trackIndex] = { ...newTracks[trackIndex], ...updates };
          
          return {
              ...prev,
              tracks: newTracks,
              patterns: {
                  ...prev.patterns,
                  [patternId]: { ...currentPattern, tracks: newTracks }
              }
          };
      });
  }, []);

  // --- TRANSPORT CONTROLS ---

  const handlePlay = async () => {
      if (isKillSwitchActive) return;
      await shadowCore.play();
      setState(prev => ({ ...prev, playing: true }));
  };

  const handlePause = () => {
      shadowCore.pause();
      setState(prev => ({ ...prev, playing: false }));
  };

  const handleStop = () => {
      shadowCore.stop();
      setState(prev => ({ ...prev, playing: false }));
      setCurrentStep(0);
  };

  const queuePattern = (patternId: string) => {
      setState(prev => ({ ...prev, nextPatternId: patternId }));
  };

  const handleAIUpdate = (updates: Partial<SequencerState>) => {
      setState(prev => ({ ...prev, ...updates }));
  };

  const handleExportSession = async () => {
    if (isAnchoring || isKillSwitchActive) return;
    setIsAnchoring(true);
    try {
      const { hash } = await captureSpiritHash(state);
      const record = await anchorSpirit(hash);
      setProvenance(record);
    } catch (e) {
      console.error("Spirit Anchor failed", e);
    } finally {
      setIsAnchoring(false);
    }
  };

  const handleMintAxia = async () => {
    if (isMinting || isKillSwitchActive) return;
    setIsMinting(true);
    try {
      const { hash } = await captureSpiritHash(state);
      const patternName = state.patterns[state.activePatternId]?.name || "UNNAMED";
      const token = await mintAxiaToken(patternName, hash);
      setAxiaToken(token);
    } catch (e) {
      console.error("Axia Mint failed", e);
    } finally {
      setIsMinting(false);
    }
  };

  const handleSessionImport = (newState: any) => {
      if (newState && newState.tracks && newState.bpm) {
          setState(prev => ({
              ...prev,
              bpm: newState.bpm,
              tracks: newState.tracks,
              swing: newState.swing || 0
          }));
      }
  };

  const confirmAddTrack = (type: InstrumentType) => {
      const settings = INSTRUMENT_SETTINGS[type];
      const newTrack: Track = {
          id: `trk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: settings.name,
          type: type,
          steps: Array(state.timeSignature).fill(null).map(() => ({ active: false, probability: 1, velocity: 0.8 })),
          mute: false,
          solo: false,
          pan: 0,
          params: { ...settings.params } 
      };

      setState(prev => {
          const pid = prev.activePatternId;
          const p = prev.patterns[pid];
          const newTracks = [...p.tracks, newTrack];
          return {
              ...prev,
              tracks: newTracks,
              patterns: {
                  ...prev.patterns,
                  [pid]: { ...p, tracks: newTracks }
              }
          };
      });
      setIsAddTrackModalOpen(false);
  };

  useEffect(() => {
      if (isKillSwitchActive && state.playing) {
          handleStop();
      }
  }, [isKillSwitchActive]);

  // --- BOOT SEQUENCE ---
  if (!bootComplete) {
      return <SplashScreen onComplete={() => setBootComplete(true)} />;
  }

  // --- TAB NAVIGATION COMPONENT ---
  const TabButton = ({ label, tab }: { label: string, tab: Tab }) => (
      <button
          onClick={() => setActiveTab(tab)}
          className={`
              relative px-3 sm:px-6 py-2 sm:py-3 text-[9px] sm:text-[10px] font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase transition-all
              clip-path-slant z-10 flex-1 sm:flex-none text-center
              ${activeTab === tab 
                  ? 'bg-accent text-black shadow-[0_0_15px_rgba(0,255,65,0.4)]' 
                  : 'bg-gray-900/50 text-gray-500 hover:text-white hover:bg-gray-800'}
          `}
      >
          {label}
          {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white"></div>}
      </button>
  );

  // --- MAIN APP ---
  return (
    <div className="h-screen w-screen bg-black text-gray-300 font-mono flex flex-col animate-fade-in relative overflow-hidden selection:bg-accent selection:text-black">
      <PanicMonitor cpuTemp={telemetry.cpuTemp} isDeadManSwitchActive={isKillSwitchActive} />
      
      {/* GLOBAL GHOST BRIDGE (AI ASSISTANT SIDEBAR) */}
      <GhostBridge 
         currentState={state} 
         onUpdate={handleAIUpdate} 
         isProcessing={isProcessingAI} 
      />

      <AddTrackModal 
         isOpen={isAddTrackModalOpen} 
         onClose={() => setIsAddTrackModalOpen(false)} 
         onSelect={confirmAddTrack}
      />

      <ExportInterface 
         isOpen={isExportOpen}
         onClose={() => setIsExportOpen(false)}
         state={state}
      />

      {/* TOP HUD BAR */}
      <header className={`h-14 px-4 sm:px-6 flex justify-between items-center bg-black/90 border-b border-gray-800/50 backdrop-blur-md z-50 shrink-0 ${focusMode ? '-translate-y-full absolute w-full' : ''} transition-transform duration-300`}>
        <div className="flex items-center gap-3 sm:gap-6">
           {/* LOGO AREA */}
           <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-black border border-gray-700 flex items-center justify-center relative overflow-hidden group-hover:border-accent transition-colors shadow-neo-sm">
                   <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <span className="font-black text-sm sm:text-lg text-white relative z-10">P</span>
              </div>
              <div className="flex flex-col">
                  <h1 className="text-[10px] sm:text-sm font-bold tracking-[0.1em] sm:tracking-[0.2em] text-white leading-none">PHANTOM</h1>
                  <span className="text-[6px] sm:text-[8px] text-accent tracking-widest mt-0.5 opacity-80">INFINITY COLLABORATIONS</span>
              </div>
           </div>

           {/* STATUS INDICATORS */}
           <div className="hidden md:flex gap-6 border-l border-gray-800 pl-6">
              <div className="flex flex-col">
                  <span className="text-[8px] text-gray-600 font-bold uppercase tracking-wide">Kernel</span>
                  <span className="text-[10px] text-gray-300">PiNet_Os Kernel</span>
              </div>
              <div className="flex flex-col">
                  <span className="text-[8px] text-gray-600 font-bold uppercase tracking-wide">DSP Clock</span>
                  <span className="text-[10px] text-accent font-mono">{state.bpm.toFixed(1)} <span className="text-gray-600">BPM</span></span>
              </div>
              {isClusterOnline && (
                   <div className="flex flex-col">
                      <span className="text-[8px] text-gray-600 font-bold uppercase tracking-wide">Mesh Status</span>
                      <span className="text-[10px] text-accent animate-pulse">SYNC_LOCKED</span>
                  </div>
              )}
           </div>
        </div>
        
        <div className="flex gap-2 sm:gap-3 items-center">
            <button 
                onClick={() => setIsExportOpen(true)}
                disabled={isKillSwitchActive}
                className="h-7 sm:h-8 px-2 sm:px-4 font-bold text-[8px] sm:text-[10px] tracking-wide bg-gray-900 border border-gray-700 text-gray-400 hover:text-accent hover:border-accent hover:bg-black transition-all rounded-sm"
            >
                DATA_EXFIL
            </button>

            <button 
              onClick={handleExportSession}
              disabled={isAnchoring || !!provenance || isKillSwitchActive}
              className={`
                h-7 sm:h-8 px-2 sm:px-4 font-bold text-[8px] sm:text-[10px] tracking-wide border transition-all flex items-center gap-1 sm:gap-2 rounded-sm
                ${provenance ? 'border-accent text-accent bg-accent/10' : isAnchoring ? 'border-gray-700 text-gray-700' : 'bg-black border-gray-600 text-gray-300 hover:border-white'}
              `}
              title="Anchor Session to Minima Omnia"
            >
              {isAnchoring ? <span className="animate-spin text-[10px]">⟳</span> : provenance ? '⚓ OMNIA_OK' : 'OMNIA_ANCHOR'}
            </button>

            <button 
              onClick={handleMintAxia}
              disabled={isMinting || !!axiaToken || isKillSwitchActive}
              className={`
                h-7 sm:h-8 px-2 sm:px-4 font-bold text-[8px] sm:text-[10px] tracking-wide border transition-all flex items-center gap-1 sm:gap-2 rounded-sm
                ${axiaToken ? 'border-purple-500 text-purple-500 bg-purple-500/10' : isMinting ? 'border-gray-700 text-gray-700' : 'bg-black border-gray-600 text-gray-300 hover:border-white'}
              `}
              title="Mint Provenance Token on Minima Axia"
            >
              {isMinting ? <span className="animate-spin text-[10px]">⟳</span> : axiaToken ? '💎 AXIA_MINTED' : 'AXIA_MINT'}
            </button>
            
            <button 
                onClick={() => setFocusMode(true)}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-800 text-gray-500 hover:text-white hover:bg-gray-800 transition-all rounded-sm"
                title="Focus Mode"
            >
                [ ]
            </button>
        </div>
      </header>

      {/* NAVIGATION RAIL */}
      {!focusMode && (
          <nav className="h-10 w-full flex border-b border-gray-800 bg-black shrink-0 relative z-40 shadow-neo">
              <div className="flex-1 flex gap-0.5 sm:gap-1 px-1 sm:px-4 items-end overflow-x-auto no-scrollbar">
                  <TabButton label="SEQUENCER" tab={Tab.CORE} />
                  <TabButton label="PERFORM" tab={Tab.PERFORM} />
                  <TabButton label="PATCHBAY" tab={Tab.PATCHBAY} />
                  <TabButton label="NETWORK" tab={Tab.NETWORK} />
              </div>
              <div className="px-4 flex items-center">
                   {isKillSwitchActive && (
                        <span className="text-[10px] text-red-500 font-black tracking-widest animate-pulse border border-red-900 bg-red-900/10 px-2 py-1">
                            KILL_SWITCH_ENGAGED
                        </span>
                   )}
              </div>
          </nav>
      )}

      {/* FOCUS MODE EXIT BUTTON (Floating) */}
      {focusMode && (
          <button 
            onClick={() => setFocusMode(false)}
            className="fixed top-4 right-4 z-50 bg-black/90 border border-red-500 text-red-500 px-4 py-2 text-xs font-bold hover:bg-red-500 hover:text-black transition-all backdrop-blur"
          >
              EXIT FOCUS
          </button>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow relative overflow-y-auto overflow-x-hidden bg-[#050505] custom-scrollbar p-1 pb-8">
        
        {/* --- TAB: SEQUENCER (CORE) --- */}
        {activeTab === Tab.CORE && (
            <div className="h-full flex flex-col max-w-[1600px] mx-auto p-4 gap-4 animate-fade-in">
                {/* TOP CONTROL DECK */}
                <div className="glass-panel p-4 flex flex-wrap justify-between items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                        <div className="text-[100px] leading-none font-bold text-gray-800 font-mono tracking-tighter">-01</div>
                    </div>

                    <div className="flex items-center gap-8 z-10">
                        <Knob label="BPM" value={state.bpm} min={60} max={200} onChange={(v) => setState(s => ({...s, bpm: v}))} size="md" color="text-accent" />
                        <Knob label="SWING" value={state.swing * 100} min={0} max={100} onChange={(v) => setState(s => ({...s, swing: v / 100}))} size="md" color="text-yellow-500" />
                        
                        <div className="h-12 w-px bg-gray-800 mx-2"></div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={handlePlay} 
                                className={`w-16 h-12 flex items-center justify-center border-b-2 transition-all ${state.playing ? 'bg-accent text-black border-accent shadow-glow' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:bg-gray-800'}`}
                            >
                                <span className="text-xl">▶</span>
                            </button>
                            <button 
                                onClick={handlePause} 
                                className="w-16 h-12 flex items-center justify-center bg-gray-900 border-b-2 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                            >
                                <span className="text-xl font-bold">||</span>
                            </button>
                            <button 
                                onClick={handleStop} 
                                className="w-16 h-12 flex items-center justify-center bg-gray-900 border-b-2 border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-500 hover:bg-gray-800 transition-all"
                            >
                                <span className="text-xl">■</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* INFO MODULE */}
                    <div className="w-full md:w-96 z-10 flex flex-col items-end text-right">
                         <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">SESSION_ID</div>
                         <div className="text-xs font-mono text-accent">{state.activePatternId}</div>
                         <div className="text-[9px] text-gray-600 mt-1">GHOST_BRIDGE: {isProcessingAI ? 'ACTIVE' : 'IDLE'}</div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 flex-grow min-h-0">
                     {/* PATTERN LAUNCHER */}
                    <div className="w-full lg:w-48 shrink-0 glass-panel p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">CLIPS</span>
                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-glow"></div>
                        </div>
                        <div className="flex flex-col gap-2 overflow-y-auto flex-grow custom-scrollbar">
                            {Object.entries(state.patterns).map(([key, pattern]: [string, Pattern]) => {
                                const isActive = state.activePatternId === key;
                                const isQueued = state.nextPatternId === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => queuePattern(key)}
                                        className={`
                                            h-12 w-full border-l-2 flex items-center justify-between px-3 relative overflow-hidden transition-all group
                                            ${isActive ? 'border-accent bg-accent/5' : 'border-gray-700 bg-gray-900/20 hover:bg-gray-800'}
                                            ${isQueued ? 'animate-pulse bg-white/5' : ''}
                                        `}
                                    >
                                        <span className={`text-[10px] font-bold tracking-widest ${isActive ? 'text-accent' : 'text-gray-400 group-hover:text-gray-200'}`}>{pattern.name}</span>
                                        {isActive && (
                                            <div className="text-[9px] font-mono text-accent">{Math.floor(currentStep / 4) + 1}.{(currentStep % 4) + 1}</div>
                                        )}
                                        {/* Progress Bar Background */}
                                        {isActive && (
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-accent/50 transition-all duration-75 ease-linear" style={{ width: `${((currentStep + 1) / 16) * 100}%` }}></div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* MAIN SEQUENCER & INSPECTOR */}
                    <div className="flex-grow flex flex-col gap-4 min-w-0">
                         {/* INSPECTOR (Contextual) */}
                        {selectedTrackIndex !== null && state.tracks[selectedTrackIndex] && (
                            <TrackInspector 
                                track={state.tracks[selectedTrackIndex]} 
                                onChange={(t) => handleUpdateTrack(selectedTrackIndex, t)}
                                onDelete={(id) => { 
                                    setState(prev => {
                                        const pid = prev.activePatternId;
                                        const p = prev.patterns[pid];
                                        const newTracks = p.tracks.filter(t => t.id !== id);
                                        return { ...prev, tracks: newTracks, patterns: { ...prev.patterns, [pid]: { ...p, tracks: newTracks } } };
                                    }); 
                                    setSelectedTrackIndex(null); 
                                }}
                            />
                        )}

                        <div className="glass-panel p-6 flex-grow relative overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-xs font-bold text-accent tracking-[0.2em] uppercase">SEQUENCE_GRID</h2>
                                    <span className="text-[10px] text-gray-600 font-mono">// {state.patterns[state.activePatternId]?.name}</span>
                                </div>
                                <button onClick={() => setIsAddTrackModalOpen(true)} className="text-[10px] font-bold text-white bg-gray-800 hover:bg-accent hover:text-black border border-gray-600 hover:border-accent px-3 py-1 transition-all">
                                    + ADD_MODULE
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto custom-scrollbar">
                                <SequencerGrid 
                                    tracks={state.tracks} 
                                    currentStep={currentStep} 
                                    onToggleStep={handleToggleStep} 
                                    onUpdateStep={handleUpdateStep}
                                    onSelectTrack={setSelectedTrackIndex} 
                                    selectedTrackIndex={selectedTrackIndex} 
                                    onClearTrack={handleClearTrack}
                                    onRandomizeTrack={handleRandomizeTrack}
                                    onRandomizeAll={handleRandomizeAll}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB: PERFORMANCE --- */}
        {activeTab === Tab.PERFORM && (
            <div className="h-full flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 gap-6 sm:gap-8 animate-fade-in max-w-6xl mx-auto overflow-y-auto custom-scrollbar">
                <div className="w-full flex flex-col lg:flex-row gap-6 sm:gap-8 justify-center items-center">
                    <div className="w-full max-w-sm lg:max-w-md">
                        <PhantomSignal onDeadManToggle={setIsKillSwitchActive} />
                    </div>
                    <div className="flex justify-center items-center">
                        <TunerUI loraStrength={tunerData.rssi} stemLevels={tunerData.stems} />
                    </div>
                </div>
                <div className="w-full pb-8">
                    <PerformancePad />
                </div>
            </div>
        )}

        {/* --- TAB: PATCHBAY (I/O) --- */}
        {activeTab === Tab.PATCHBAY && (
            <div className="h-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 animate-fade-in overflow-y-auto custom-scrollbar">
                {/* MIXER CONSOLE - TOP */}
                <div className="w-full flex-shrink-0">
                    <MixerConsole tracks={state.tracks} onUpdateTrack={handleUpdateTrack} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 flex-grow min-h-0 pb-8">
                    <div className="lg:col-span-2 h-full">
                        <PrismControls onSessionImport={handleSessionImport} />
                    </div>
                    <div className="lg:col-span-1 h-full">
                        <HiveSync />
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB: NETWORK --- */}
        {activeTab === Tab.NETWORK && (
            <div className="h-full max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                <div className="space-y-8">
                    <ClusterMonitor />
                    <TelemetryDeck data={telemetry} />
                    <ProvenanceDeck record={provenance} token={axiaToken} />
                </div>
                <div className="flex flex-col gap-8">
                    <div className="glass-panel p-6 bg-black flex-grow font-mono border-gray-800">
                        <div className="flex justify-between border-b border-gray-800 pb-2 mb-2">
                             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">SYSTEM_LOG</h3>
                             <span className="text-[9px] text-accent animate-pulse">LIVE</span>
                        </div>
                        <div className="text-[10px] text-gray-400 h-64 overflow-y-auto custom-scrollbar space-y-1">
                            <p><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-green-500">MINIMA_LEDGER</span>: CONNECTED</p>
                            <p><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-purple-400">GHOST_BRIDGE</span>: GEMINI-1.5-FLASH READY</p>
                            <p><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-blue-400">AUDIO_ENGINE</span>: 48kHz 32-BIT FLOAT</p>
                            <p><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-yellow-500">HIVE_MESH</span>: LISTENING ON 915MHz</p>
                            <p><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-white">KERNEL</span>: PiNet_Os Kernel v1.2 OK</p>
                            <p><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> <span className="text-red-400">NPU</span>: HAILO-8L ONLINE</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </main>

      {/* FOOTER STATUS BAR */}
      <footer className="fixed bottom-0 w-full h-6 bg-black border-t border-gray-800 flex items-center justify-between px-4 text-[9px] text-gray-600 font-mono z-50">
          <div>INFINITY COLLABORATIONS SDH © 2024</div>
          <div className="flex gap-4">
              <span>MEM: {Math.round(telemetry.memoryUsage)}%</span>
              <span>CPU: {Math.round(telemetry.cpuTemp)}°C</span>
              <span className={isClusterOnline ? "text-accent" : "text-red-900"}>MESH: {isClusterOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>
      </footer>
    </div>
  );
};

export default App;
