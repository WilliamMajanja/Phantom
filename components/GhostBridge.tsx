
import React, { useState, useRef, useEffect } from 'react';
import { interpretSignal } from '../services/ghostBridge';
import { SequencerState } from '../types';

interface GhostBridgeProps {
  currentState: SequencerState;
  onUpdate: (updates: Partial<SequencerState>) => void;
  isProcessing: boolean; // Retained for compatibility, though we manage local loading too
}

interface Message {
    id: string;
    role: 'USER' | 'SYSTEM' | 'AI';
    text: string;
    timestamp: number;
}

const GhostBridge: React.FC<GhostBridgeProps> = ({ currentState, onUpdate, isProcessing: externalProcessing }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [localProcessing, setLocalProcessing] = useState(false);
  const [history, setHistory] = useState<Message[]>([
      { id: 'init', role: 'SYSTEM', text: 'GHOST_BRIDGE_V2 ONLINE. LINK ESTABLISHED.', timestamp: Date.now() }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [history, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || localProcessing || externalProcessing) return;

    // 1. Add User Message
    const userMsg: Message = {
        id: Date.now().toString(),
        role: 'USER',
        text: prompt,
        timestamp: Date.now()
    };
    setHistory(prev => [...prev, userMsg]);
    setPrompt('');
    setLocalProcessing(true);

    // 2. Call API
    try {
        const response = await interpretSignal(userMsg.text, currentState);
        
        // 3. Process Response
        if (response.success) {
            // Only update sequencer if we have actual state changes
            if (response.updates) {
                onUpdate(response.updates);
            }
            
            setHistory(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'AI',
                text: response.message,
                timestamp: Date.now()
            }]);
        } else {
             setHistory(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'SYSTEM',
                text: `ERROR: ${response.message}`,
                timestamp: Date.now()
            }]);
        }
    } catch (err) {
        setHistory(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'SYSTEM',
            text: 'CRITICAL FAILURE IN NEURAL LINK.',
            timestamp: Date.now()
        }]);
    } finally {
        setLocalProcessing(false);
    }
  };

  const isBusy = localProcessing || externalProcessing;

  return (
    <>
        {/* LAUNCH TRIGGER */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`
                fixed bottom-8 right-8 z-[100] h-12 px-4 bg-black border border-accent/50 text-accent
                font-bold tracking-widest text-[10px] shadow-[0_0_20px_rgba(0,255,65,0.2)]
                hover:bg-accent hover:text-black transition-all clip-path-slant flex items-center gap-3
                ${isOpen ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
            `}
        >
            <span className="animate-pulse">●</span> GHOST_LINK
        </button>

        {/* SIDEBAR PANEL */}
        <div 
            className={`
                fixed top-0 right-0 h-full w-full md:w-[400px] bg-black/95 backdrop-blur-xl border-l border-gray-800 
                z-[200] transition-transform duration-300 ease-out shadow-2xl flex flex-col
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* HEADER */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isBusy ? 'bg-yellow-500 animate-pulse' : 'bg-accent'}`}></div>
                    <span className="text-xs font-bold text-gray-200 tracking-[0.2em]">GHOST_BRIDGE</span>
                </div>
                <button 
                    onClick={() => setIsOpen(false)} 
                    className="text-gray-500 hover:text-white transition-colors text-lg"
                >
                    ✕
                </button>
            </div>

            {/* CHAT LOG */}
            <div 
                ref={scrollRef}
                className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar font-mono text-xs"
            >
                {history.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'USER' ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1 opacity-50 text-[9px]">
                            <span>{msg.role === 'AI' ? 'GHOST' : msg.role}</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div 
                            className={`
                                max-w-[85%] p-3 border leading-relaxed
                                ${msg.role === 'USER' 
                                    ? 'bg-gray-900 border-gray-700 text-gray-300' 
                                    : msg.role === 'AI'
                                        ? 'bg-accent/5 border-accent/30 text-accent'
                                        : 'bg-red-900/10 border-red-900/30 text-red-400'}
                            `}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {isBusy && (
                    <div className="flex flex-col items-start animate-pulse">
                         <div className="text-[9px] opacity-50 mb-1">GHOST</div>
                         <div className="bg-accent/5 border border-accent/30 text-accent p-2 text-[10px]">
                            ANALYZING_SEQUENCER_STATE...
                         </div>
                    </div>
                )}
            </div>

            {/* INPUT AREA */}
            <div className="p-4 border-t border-gray-800 bg-black">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="ENTER COMMAND..."
                        disabled={isBusy}
                        className="w-full bg-gray-900 border border-gray-700 text-gray-200 p-4 pr-12 text-xs font-mono focus:border-accent focus:outline-none transition-colors placeholder-gray-600"
                        autoFocus
                    />
                    <button 
                        type="submit"
                        disabled={!prompt || isBusy}
                        className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center text-gray-500 hover:text-accent disabled:opacity-30 transition-colors"
                    >
                        ⏎
                    </button>
                </form>
                <div className="mt-2 flex justify-between text-[8px] text-gray-600 font-mono uppercase">
                    <span>Model: GEMINI-1.5-FLASH</span>
                    <span>Context: LIVE</span>
                </div>
            </div>
        </div>

        {/* Backdrop for Mobile */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-[150] md:hidden backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            ></div>
        )}
    </>
  );
};

export default GhostBridge;
