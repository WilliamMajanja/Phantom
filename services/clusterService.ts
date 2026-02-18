
import { TelemetryData } from '../types';

export interface NodeStatus {
  id: string;
  ip: string;
  online: boolean;
  role: 'AUDIO_CORE' | 'AI_INFERENCE' | 'VISUALIZER' | 'SATELLITE';
  hardware: string;
  telemetry: TelemetryData;
}

class ClusterService {
  private nodes: NodeStatus[] = [
    { 
        id: 'NEXUS', ip: 'localhost', online: true, role: 'AUDIO_CORE', hardware: 'NVMe_HAT',
        telemetry: { cpuTemp: 45, npuLoad: 0, pcieLaneUsage: 0, memoryUsage: 0 } 
    }
  ];

  private sockets: Map<string, WebSocket> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const stored = localStorage.getItem('PHANTOM_CLUSTER_NODES');
    if (stored) {
        try {
            const savedNodes = JSON.parse(stored);
            // Merge saved nodes, ensuring NEXUS stays constant
            this.nodes = [this.nodes[0], ...savedNodes.filter((n: NodeStatus) => n.id !== 'NEXUS')];
        } catch (e) {
            console.error("Failed to load cluster config");
        }
    }
  }

  private saveConfig() {
      // Don't save localhost NEXUS, only remotes
      const remotes = this.nodes.filter(n => n.id !== 'NEXUS');
      localStorage.setItem('PHANTOM_CLUSTER_NODES', JSON.stringify(remotes));
  }

  public connect() {
    this.nodes.forEach(node => {
        if (node.id === 'NEXUS') return; // Skip self
        this.connectNode(node);
    });
  }

  private connectNode(node: NodeStatus) {
    if (this.sockets.has(node.id)) return; // Already connecting/connected

    try {
      // Attempt connection to the Phantom Telemetry Port (default 8765 for Python, or app logic)
      const ws = new WebSocket(`ws://${node.ip}:8765`);
      this.sockets.set(node.id, ws);
      
      ws.onopen = () => {
        node.online = true;
        console.log(`🔗 LINK ESTABLISHED: ${node.id}`);
      };

      ws.onclose = () => {
        node.online = false;
        this.sockets.delete(node.id);
        // Auto-retry logic handled by the monitor interval or manual refresh for now
      };

      ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'TELEMETRY') {
                node.telemetry = data.payload;
            }
        } catch(e) {}
      };
    } catch (e) {
      console.warn(`Connection failed to ${node.id}`, e);
    }
  }

  public addNode(newNode: NodeStatus) {
      if (this.nodes.find(n => n.id === newNode.id)) return;
      this.nodes.push(newNode);
      this.saveConfig();
      this.connectNode(newNode);
  }

  public removeNode(nodeId: string) {
      this.nodes = this.nodes.filter(n => n.id !== nodeId);
      const ws = this.sockets.get(nodeId);
      if (ws) {
          ws.close();
          this.sockets.delete(nodeId);
      }
      this.saveConfig();
  }

  public broadcastStep(step: number, activeTracks: boolean[]) {
    this.sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'STEP',
                step: step,
                activity: activeTracks
            }));
        }
    });
  }

  public getStatus() {
    return this.nodes;
  }
}

export const clusterService = new ClusterService();
