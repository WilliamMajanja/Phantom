import React, { useState } from 'react';

interface NeuralInterfaceProps {
  onSubmit: (prompt: string) => void;
  isProcessing: boolean;
}

const NeuralInterface: React.FC<NeuralInterfaceProps> = ({ onSubmit, isProcessing }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;
    onSubmit(prompt);
    setPrompt('');
  };

  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col h-full justify-between">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-text font-bold uppercase tracking-widest text-xs">Aura Trinity Link</h3>
        {isProcessing && <span className="text-[10px] text-accent font-bold animate-pulse">GENERATING...</span>}
      </div>
      
      <form onSubmit={handleSubmit} className="w-full relative mt-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isProcessing}
            placeholder="Describe the sound..."
            className="w-full bg-plate shadow-neo-inner text-text p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder-textLight font-sans text-sm transition-all"
          />
          <button 
            type="submit"
            disabled={isProcessing || !prompt}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center text-text hover:text-accent disabled:text-textLight transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
            </svg>
          </button>
      </form>
      
      <div className="mt-3 text-[10px] text-textLight font-mono flex justify-between">
        <span>GEMINI-1.5-FLASH</span>
        <span>FUNCTION CALLING: ACTIVE</span>
      </div>
    </div>
  );
};

export default NeuralInterface;