
import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [memCheck, setMemCheck] = useState(0);
  const [bootPhase, setBootPhase] = useState(0);
  const [copyrightText, setCopyrightText] = useState("");
  
  const FINAL_COPYRIGHT = "INFINITY COLLABORATIONS SDH";

  // Boot Sequence Log
  const bootLog = [
    "BIOS: REFLEX_UEFI v2.1.0",
    "CPU: ARM CORTEX-A76 [4 CORES ACTIVE]",
    "MEM: LPDDR4X 4266MT/s CHECK...",
    "GPU: VIDEOCORE VII [OK]",
    "NPU: HAILO-8L NEURAL ENGINE [OK]",
    "MOUNT: /dev/nvme0n1 [READ_WRITE] -> /opt/phantom",
    "NET: HIVE_MESH LISTEN 915MHZ [SIGNAL: -85dB]",
    "AUDIO: PIPEWIRE SINK [48KHZ/32BIT/FLOAT]",
    "GHOST_BRIDGE: GEMINI NODE LINKED",
    "LEDGER: MINIMA PROVENANCE ACTIVE",
    "SYSTEM INTEGRITY: 100%"
  ];

  // Phase 1: Memory Check
  useEffect(() => {
    const memInterval = setInterval(() => {
      setMemCheck(prev => {
        if (prev >= 16384) {
          clearInterval(memInterval);
          setBootPhase(1);
          return 16384;
        }
        return prev + 256 + Math.floor(Math.random() * 512);
      });
    }, 10);
    return () => clearInterval(memInterval);
  }, []);

  // Phase 2: Log Lines
  useEffect(() => {
    if (bootPhase === 1) {
        let lineIndex = 0;
        const logInterval = setInterval(() => {
            if (lineIndex < bootLog.length) {
                setLines(prev => [...prev, bootLog[lineIndex]]);
                lineIndex++;
            } else {
                clearInterval(logInterval);
                setBootPhase(2);
            }
        }, 100); // Fast log scroll
        return () => clearInterval(logInterval);
    }
  }, [bootPhase]);

  // Phase 3: Decrypt Copyright
  useEffect(() => {
      if (bootPhase === 2) {
          let iterations = 0;
          const interval = setInterval(() => {
              const text = FINAL_COPYRIGHT.split("").map((letter, index) => {
                  if (index < iterations) return letter;
                  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
              }).join("");
              
              setCopyrightText(text);
              iterations += 1/2; // Slow reveal

              if (iterations >= FINAL_COPYRIGHT.length) {
                  clearInterval(interval);
                  setTimeout(onComplete, 1200); // Hold for a moment before launch
              }
          }, 30);
          return () => clearInterval(interval);
      }
  }, [bootPhase]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center cursor-none overflow-hidden font-mono text-xs md:text-sm text-green-500 selection:bg-green-900 selection:text-white">
      
      {/* Decorative HUD Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-900 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-900 to-transparent"></div>
      
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{backgroundImage: 'radial-gradient(#00ff41 1px, transparent 1px)', backgroundSize: '30px 30px'}}>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-3xl px-8 flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col items-center gap-6">
            <div className="relative group">
                 {/* Geometric Logo */}
                 <div className="w-20 h-20 border-2 border-green-500 flex items-center justify-center relative shadow-[0_0_30px_rgba(0,255,65,0.2)] bg-black/80 rotate-45">
                     <div className="w-12 h-12 border border-green-500/50 flex items-center justify-center">
                        <div className="w-4 h-4 bg-green-500 animate-pulse"></div>
                     </div>
                     <div className="absolute -top-1 -left-1 w-2 h-2 bg-white"></div>
                     <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white"></div>
                 </div>
            </div>

            <div className="text-center space-y-2 mt-4">
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white glitch-text filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    PHANTOM
                </h1>
                <div className="flex items-center justify-center gap-4 opacity-80">
                    <span className="text-[10px] text-green-400 tracking-[0.5em] uppercase border-b border-green-900 pb-1">Tactical Audio Workstation</span>
                </div>
            </div>
        </div>

        {/* Memory Bar */}
        <div className="w-full space-y-1 mt-4">
            <div className="flex justify-between text-[10px] text-gray-500 font-bold">
                <span>SYSTEM_RAM_CHECK</span>
                <span className="font-mono text-green-500">{memCheck} MB OK</span>
            </div>
            <div className="w-full h-1.5 bg-gray-900 rounded-none border border-gray-800">
                <div 
                    className="h-full bg-green-500 shadow-[0_0_15px_#00ff41] transition-all duration-75" 
                    style={{ width: `${(memCheck / 16384) * 100}%` }}
                ></div>
            </div>
        </div>

        {/* Terminal Output */}
        <div className="h-40 border-l-2 border-green-900/50 bg-black/40 pl-4 py-2 font-mono text-[10px] text-green-400/80 overflow-hidden flex flex-col justify-end">
             {lines.map((line, i) => (
                <div key={i} className="flex gap-3">
                    <span className="opacity-30 text-green-200">{(i+1).toString().padStart(2, '0')}</span>
                    <span className="tracking-wide">{`> ${line}`}</span>
                </div>
            ))}
             <div className="animate-pulse text-green-500 font-bold mt-1">_</div>
        </div>
      
        {/* Footer with Decrypting Copyright */}
        <div className="text-center mt-4">
            <p className="text-[9px] text-gray-600 tracking-widest uppercase mb-2">Developed By</p>
            <p className="text-sm font-bold text-white tracking-[0.2em] font-mono h-6 text-glow">
                {bootPhase >= 2 ? copyrightText : ""}
                <span className="animate-pulse inline-block w-2 h-4 bg-green-500 align-middle ml-1"></span>
            </p>
        </div>

      </div>

      {/* Version Stamp */}
      <div className="absolute bottom-6 right-6 text-[9px] text-gray-800 font-mono">
          BUILD: 9482.A // PiNet_Os Kernel
      </div>

    </div>
  );
};

export default SplashScreen;
