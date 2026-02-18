
import React, { useEffect, useState } from 'react';
import { clusterService, NodeStatus } from '../services/clusterService';

const ClusterMonitor: React.FC = () => {
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newRole, setNewRole] = useState('SATELLITE');

  useEffect(() => {
    const interval = setInterval(() => {
      setNodes([...clusterService.getStatus()]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddNode = () => {
      if (!newIp) return;
      clusterService.addNode({
          id: `NODE_${newIp.split('.').pop()}`,
          ip: newIp,
          role: newRole as any,
          online: false,
          hardware: 'RPI_GENERIC',
          telemetry: { cpuTemp: 0, npuLoad: 0, pcieLaneUsage: 0, memoryUsage: 0 }
      });
      setNewIp('');
  };

  const handleRemove = (id: string) => {
      if (id === 'NEXUS') return;
      clusterService.removeNode(id);
  };

  const getNodeColor = (role: string) => {
      switch(role) {
          case 'AUDIO_CORE': return 'text-accent';
          case 'AI_INFERENCE': return 'text-purple-400';
          case 'VISUALIZER': return 'text-yellow-400';
          case 'SATELLITE': return 'text-blue-400';
          default: return 'text-gray-500';
      }
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
         <span className="text-[10px] text-textLight font-bold tracking-widest uppercase">Cluster Swarm</span>
         <button onClick={() => setConfigOpen(!configOpen)} className="text-[9px] font-mono text-gray-500 hover:text-white">
             {configOpen ? 'CLOSE' : 'ADD_NODE'}
         </button>
      </div>

      {configOpen && (
          <div className="bg-black/50 p-3 rounded mb-2 border border-gray-700 animate-fade-in">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input 
                    placeholder="IP ADDRESS" 
                    className="bg-black border border-gray-800 text-xs p-2 text-white col-span-1" 
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                />
                <select 
                    className="bg-black border border-gray-800 text-xs p-2 text-white col-span-1"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                >
                    <option value="SATELLITE">SATELLITE</option>
                    <option value="AI_INFERENCE">AI_CORE</option>
                    <option value="VISUALIZER">VISUALIZER</option>
                </select>
              </div>
              <button onClick={handleAddNode} className="w-full bg-gray-800 hover:bg-accent hover:text-black text-gray-300 text-[10px] font-bold py-2 transition-colors">
                  + INITIALIZE LINK
              </button>
          </div>
      )}

      <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar">
        {nodes.map(node => (
          <div key={node.id} className={`flex items-center justify-between p-2 rounded border group ${node.online ? 'border-gray-800 bg-gray-900/30' : 'border-red-900/20 bg-red-900/10'}`}>
            <div className="flex flex-col">
               <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${node.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                   <span className={`text-xs font-bold ${getNodeColor(node.role)}`}>{node.id}</span>
               </div>
               <span className="text-[9px] text-gray-500 font-mono">{node.ip} // {node.hardware}</span>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <div className="text-[9px] text-gray-400 font-mono">CPU: {node.telemetry.cpuTemp.toFixed(1)}°C</div>
                    <div className="text-[9px] text-gray-500 font-mono">MEM: {Math.round(node.telemetry.memoryUsage)}%</div>
                </div>
                {node.id !== 'NEXUS' && (
                    <button 
                        onClick={() => handleRemove(node.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 text-xs font-bold px-2"
                    >
                        ✕
                    </button>
                )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Network Topology Graphic */}
      <div className="flex justify-between px-4 mt-1 opacity-20">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-accent to-transparent"></div>
      </div>
    </div>
  );
};

export default ClusterMonitor;
