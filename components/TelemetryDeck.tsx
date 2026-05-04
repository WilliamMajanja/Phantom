
import React from 'react';
import { TelemetryData } from '../types';

interface TelemetryDeckProps {
    data: TelemetryData;
}

const TelemetryDeck: React.FC<TelemetryDeckProps> = ({ data }) => {

  const getStatusColor = (val: number | null, limit: number) => 
    val !== null && val > limit ? 'text-accent animate-pulse' : 'text-text';
  const formatMetric = (val: number | null, suffix: string) => val === null ? 'UNAVAILABLE' : `${val.toFixed(1)}${suffix}`;

  return (
    <div className="glass-panel p-5 flex flex-col gap-3 font-sans text-xs">
      <div className="flex justify-between items-center border-b border-white/20 pb-2 mb-1">
        <span className="text-textLight font-bold uppercase tracking-widest text-[10px]">System Status</span>
        <div className="flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-indicator animate-pulse"></span>
          <span className="text-indicator font-bold text-[10px]">R-PI 5 LINKED</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-textLight block mb-1">CPU Temp</span>
          <span className={`text-lg font-bold font-mono ${getStatusColor(data.cpuTemp, 75)}`}>
            {formatMetric(data.cpuTemp, '°C')}
          </span>
        </div>
        <div>
          <span className="text-textLight block mb-1">NPU Load</span>
          <span className={`text-lg font-bold font-mono ${getStatusColor(data.npuLoad, 80)}`}>
            {formatMetric(data.npuLoad, '%')}
          </span>
        </div>
        <div>
          <span className="text-textLight block mb-1">Bus Speed</span>
          <span className="text-md font-mono text-text">
            {formatMetric(data.pcieLaneUsage, ' GB/s')}
          </span>
        </div>
        <div>
          <span className="text-textLight block mb-1">Mem</span>
          <span className="text-md font-mono text-text">
            {formatMetric(data.memoryUsage, 'G')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryDeck;
