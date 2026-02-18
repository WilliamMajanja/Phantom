
import React, { useState, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  step?: number;
}

const Knob: React.FC<KnobProps> = ({ 
  label, value, min, max, onChange, color = "text-accent", size = 'md', step = 1
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);
  
  // Dimensions
  const sizePx = size === 'sm' ? 40 : size === 'lg' ? 80 : 60;
  const radius = sizePx / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate visual state
  const percent = (value - min) / (max - min);
  const clampedPercent = Math.min(1, Math.max(0, percent));
  
  // 270 Degree Arc (Start -135, End +135)
  // Total arc length is 75% of circumference
  const arcLength = circumference * 0.75;
  const dashOffset = arcLength - (clampedPercent * arcLength);
  const rotationOffset = 135; // Start angle

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    document.body.style.cursor = 'ns-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = startY - e.clientY;
      const range = max - min;
      
      const change = (deltaY / 150) * range; // Sensitivity
      let newValue = startValue + change;
      newValue = Math.min(max, Math.max(min, newValue));
      
      // Quantize
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }

      // Fix precision
      const decimals = step < 1 ? step.toString().split('.')[1]?.length || 1 : 0;
      newValue = parseFloat(newValue.toFixed(decimals));
      
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY, startValue, min, max, onChange, step]);

  // Extract color hex/class for SVG stroke if possible, but Tailwind classes are safer to use via classNames
  // Here we map the tailwind text class to a rough hex for the stroke, or just use 'currentColor' style
  
  return (
    <div className="flex flex-col items-center gap-2 select-none group">
      <div 
        className="relative cursor-ns-resize"
        style={{ width: sizePx, height: sizePx }}
        onMouseDown={handleMouseDown}
      >
        <svg width={sizePx} height={sizePx} className="transform rotate-90">
            {/* Background Track */}
            <circle 
                cx={sizePx / 2} cy={sizePx / 2} r={radius} 
                fill="none" 
                stroke="#1a1a1a" 
                strokeWidth="4"
                strokeDasharray={`${arcLength} ${circumference}`}
                transform={`rotate(${rotationOffset} ${sizePx/2} ${sizePx/2})`}
                strokeLinecap="round"
            />
            {/* Value Arc */}
            <circle 
                cx={sizePx / 2} cy={sizePx / 2} r={radius} 
                fill="none" 
                className={`${color} stroke-current drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]`}
                strokeWidth="4"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(${rotationOffset} ${sizePx/2} ${sizePx/2})`}
                strokeLinecap="round"
            />
        </svg>

        {/* Center Cap */}
        <div className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#111] border border-gray-800 shadow-neo-inner
            flex items-center justify-center transition-colors
            ${isDragging ? 'border-gray-600' : ''}
        `}
        style={{ width: sizePx * 0.6, height: sizePx * 0.6 }}
        >
             {/* Indicator Line */}
             <div 
                className={`absolute w-0.5 h-1/2 bg-gray-500 origin-bottom bottom-1/2`}
                style={{ transform: `rotate(${-135 + (percent * 270)}deg)` }}
             >
                 <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} absolute -top-1 -left-0.5 shadow-[0_0_5px_currentColor]`}></div>
             </div>
        </div>
      </div>

      <div className="text-center">
          <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-0.5">{label}</div>
          <div className={`text-[10px] font-mono font-bold ${isDragging ? 'text-white' : 'text-gray-400'}`}>
            {value.toFixed(step < 1 ? 1 : 0)}
          </div>
      </div>
    </div>
  );
};

export default Knob;
