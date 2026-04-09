
import { TelemetryData } from '../types';
import { maximaService, MaximaMessage } from './maximaService';
import { logService } from './logService';

export interface NodeStatus {
  id: string;
  ip: string;
  online: boolean;
  role: 'AUDIO_CORE' | 'AI_INFERENCE' | 'VISUALIZER' | 'SATELLITE';
  hardware: string;
  telemetry: TelemetryData;
  publicKey?: string;
}

/**
 * Cluster Service — Now backed by Maxima P2P
 * 
 * Previously used raw WebSocket connections to remote nodes.
 * Now uses Minima's Maxima protocol for fully decentralized peer discovery
 * and state synchronization.
 * 
 * Falls back to local-only mode if no Maxima peers are available.
 */
class ClusterService {
  private nodes: NodeStatus[] = [
    { 
        id: 'NEXUS', ip: 'localhost', online: true, role: 'AUDIO_CORE', hardware: 'PINET_NODE',
        telemetry: { cpuTemp: 45, npuLoad: 0, pcieLaneUsage: 0, memoryUsage: 0 } 
    }
  ];

  private _unsubMaxima: (() => void) | null = null;
  private _unsubPeers: (() => void) | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const stored = localStorage.getItem('PHANTOM_CLUSTER_NODES');
    if (stored) {
        try {
            const savedNodes = JSON.parse(stored);
            this.nodes = [this.nodes[0], ...savedNodes.filter((n: NodeStatus) => n.id !== 'NEXUS')];
        } catch (e) {
            console.error("Failed to load cluster config");
        }
    }
  }

  private saveConfig() {
      const remotes = this.nodes.filter(n => n.id !== 'NEXUS');
      localStorage.setItem('PHANTOM_CLUSTER_NODES', JSON.stringify(remotes));
  }

  /**
   * Connect to the mesh. Now listens to Maxima peers.
   */
  public connect() {
    // Listen for Maxima messages for step sync and peer announcements
    this._unsubMaxima = maximaService.onMessage((msg: MaximaMessage) => {
        this.handleMaximaMessage(msg);
    });

    // Watch for peer list changes
    this._unsubPeers = maximaService.onPeersChanged((peers) => {
        // Auto-add Maxima peers as cluster nodes
        for (const peer of peers) {
            const existingNode = this.nodes.find(n => n.publicKey === peer.publickey);
            if (!existingNode) {
                this.nodes.push({
                    id: peer.name || `NODE_${peer.publickey.slice(0, 8)}`,
                    ip: peer.currentaddress || 'MAXIMA',
                    online: true,
                    role: 'SATELLITE',
                    hardware: 'PINET_NODE',
                    publicKey: peer.publickey,
                    telemetry: { cpuTemp: 0, npuLoad: 0, pcieLaneUsage: 0, memoryUsage: 0 }
                });
            }
        }

        // Mark nodes offline if they're no longer in Maxima peer list
        for (const node of this.nodes) {
            if (node.id === 'NEXUS') continue;
            if (node.publicKey) {
                node.online = peers.some(p => p.publickey === node.publicKey);
            }
        }
    });

    // Announce presence to the mesh
    maximaService.announcePresence().catch(() => {
        // Non-critical
    });

    logService.addLog('INFO', 'CLUSTER', 'MESH_CONNECTED_VIA_MAXIMA');
  }

  private handleMaximaMessage(msg: MaximaMessage) {
      if (msg.type === 'STEP_SYNC') {
          // Incoming step sync from a peer
          const senderNode = this.nodes.find(n => n.publicKey === msg.sender);
          if (senderNode) {
              senderNode.online = true;
          }
      }

      if (msg.type === 'PEER_ANNOUNCE') {
          const existing = this.nodes.find(n => n.publicKey === msg.sender);
          if (existing) {
              existing.online = true;
              if (msg.payload?.name) existing.id = msg.payload.name;
          } else {
              this.nodes.push({
                  id: msg.payload?.name || `NODE_${msg.sender.slice(0, 8)}`,
                  ip: 'MAXIMA',
                  online: true,
                  role: 'SATELLITE',
                  hardware: 'PINET_NODE',
                  publicKey: msg.sender,
                  telemetry: { cpuTemp: 0, npuLoad: 0, pcieLaneUsage: 0, memoryUsage: 0 }
              });
          }
      }
  }

  public addNode(newNode: NodeStatus) {
      if (this.nodes.find(n => n.id === newNode.id)) return;
      this.nodes.push(newNode);
      this.saveConfig();
  }

  public removeNode(nodeId: string) {
      this.nodes = this.nodes.filter(n => n.id !== nodeId);
      this.saveConfig();
  }

  /**
   * Broadcast current step to all peers via Maxima.
   */
  public broadcastStep(step: number, activeTracks: boolean[]) {
    maximaService.broadcastStep(step, activeTracks).catch(() => {
        // Non-critical — mesh may not have peers yet
    });
  }

  public getStatus() {
    return this.nodes;
  }

  public destroy() {
    if (this._unsubMaxima) this._unsubMaxima();
    if (this._unsubPeers) this._unsubPeers();
  }
}

export const clusterService = new ClusterService();
