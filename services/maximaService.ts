
import { MaximaPeer } from '../types';
import { mdsService } from './mdsService';
import { logService } from './logService';
import { escapeSql } from './utils';

/**
 * Maxima Service — Peer-to-Peer Messaging via Minima's Maxima Layer
 * 
 * Replaces simulated WebSocket cluster communication with real
 * decentralized P2P messaging through the Minima blockchain network.
 * 
 * Messages are sent directly between nodes without a central server.
 * Each message includes an application-specific header for routing.
 */

const PHANTOM_APP_ID = 'PHANTOM_PINET_V2';

export interface MaximaMessage {
    app: string;
    type: 'STEP_SYNC' | 'PATTERN_SHARE' | 'PEER_ANNOUNCE' | 'HIVE_COMMAND' | 'CHAT';
    sender: string;
    payload: any;
    timestamp: number;
}

type MaximaMessageCallback = (msg: MaximaMessage) => void;

class MaximaService {
    private peers: MaximaPeer[] = [];
    private messageListeners: Set<MaximaMessageCallback> = new Set();
    private peerListeners: Set<(peers: MaximaPeer[]) => void> = new Set();
    private _unsubscribeMDS: (() => void) | null = null;
    private _refreshInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Initialize Maxima listeners. Must be called after mdsService.init().
     */
    public init(): void {
        // Listen for incoming Maxima messages from MDS
        this._unsubscribeMDS = mdsService.on('MAXIMA', (event) => {
            this.handleIncomingMessage(event.data);
        });

        // Periodically refresh peer list
        this._refreshInterval = setInterval(() => {
            this.refreshPeers();
        }, 30000);

        // Initial peer fetch
        this.refreshPeers();

        logService.addLog('INFO', 'MAXIMA', 'P2P_MESH_INITIALIZED');
    }

    /**
     * Send a message to a specific peer via Maxima.
     */
    public async sendToPeer(publicKey: string, type: MaximaMessage['type'], payload: any): Promise<boolean> {
        const message: MaximaMessage = {
            app: PHANTOM_APP_ID,
            type,
            sender: mdsService.publicKey,
            payload,
            timestamp: Date.now()
        };

        const msgHex = this.stringToHex(JSON.stringify(message));

        try {
            await mdsService.cmd(
                `maxsend to:${publicKey} application:${PHANTOM_APP_ID} data:${msgHex}`
            );
            return true;
        } catch (e: any) {
            logService.addLog('WARN', 'MAXIMA', `SEND_FAILED to ${publicKey.slice(0, 12)}...`);
            return false;
        }
    }

    /**
     * Broadcast a message to all known peers.
     */
    public async broadcast(type: MaximaMessage['type'], payload: any): Promise<number> {
        let sent = 0;
        for (const peer of this.peers) {
            const ok = await this.sendToPeer(peer.publickey, type, payload);
            if (ok) sent++;
        }
        return sent;
    }

    /**
     * Broadcast current step to all peers for live sync.
     */
    public async broadcastStep(step: number, activeTracks: boolean[]): Promise<void> {
        if (this.peers.length === 0) return;
        await this.broadcast('STEP_SYNC', { step, activeTracks });
    }

    /**
     * Share a pattern with all peers.
     */
    public async sharePattern(patternName: string, patternHash: string, patternData: any): Promise<void> {
        await this.broadcast('PATTERN_SHARE', {
            name: patternName,
            hash: patternHash,
            data: patternData
        });
        logService.addLog('SUCCESS', 'MAXIMA', `PATTERN_SHARED: ${patternName}`);
    }

    /**
     * Announce presence to all peers.
     */
    public async announcePresence(): Promise<void> {
        await this.broadcast('PEER_ANNOUNCE', {
            name: `PHANTOM_${mdsService.publicKey.slice(0, 8)}`,
            blockHeight: mdsService.blockHeight
        });
    }

    /**
     * Refresh the peer list from Minima's Maxima contacts.
     */
    public async refreshPeers(): Promise<void> {
        try {
            const contacts = await mdsService.cmd('maxcontacts');

            if (Array.isArray(contacts)) {
                this.peers = contacts.map((c: any) => ({
                    publickey: c.publickey || c.to || '',
                    currentaddress: c.currentaddress || c.host || '',
                    name: c.extradata?.name || `NODE_${(c.publickey || '').slice(0, 8)}`,
                    extradata: c.extradata,
                    lastSeen: Date.now()
                }));
            }

            // Also update the local DB
            for (const peer of this.peers) {
                try {
                    const escapedName = escapeSql(peer.name || '');
                    const escapedKey = escapeSql(peer.publickey);
                    await mdsService.sql(
                        `INSERT OR REPLACE INTO phantom_peers (public_key, name, last_seen) VALUES ('${escapedKey}', '${escapedName}', ${Date.now()})`
                    );
                } catch (e) {
                    // Non-critical
                }
            }

            this.notifyPeerListeners();
        } catch (e) {
            // Non-critical — peers remain as-is
        }
    }

    /**
     * Handle an incoming Maxima message from MDS event.
     */
    private handleIncomingMessage(data: any): void {
        if (!data) return;

        try {
            let msgData: string;

            // Maxima messages arrive as hex data in MDS events
            if (data.data) {
                msgData = this.hexToString(data.data);
            } else if (typeof data === 'string') {
                msgData = this.hexToString(data);
            } else {
                return;
            }

            const message: MaximaMessage = JSON.parse(msgData);

            // Only handle messages for our application
            if (message.app !== PHANTOM_APP_ID) return;

            // Update peer last-seen
            const existingPeer = this.peers.find(p => p.publickey === message.sender);
            if (existingPeer) {
                existingPeer.lastSeen = Date.now();
            } else if (message.sender) {
                this.peers.push({
                    publickey: message.sender,
                    currentaddress: '',
                    name: `NODE_${message.sender.slice(0, 8)}`,
                    lastSeen: Date.now()
                });
                this.notifyPeerListeners();
            }

            // Dispatch to listeners
            this.messageListeners.forEach(cb => {
                try { cb(message); } catch (e) { /* ignore listener errors */ }
            });
        } catch (e) {
            // Malformed message — ignore
        }
    }

    // --- Event System ---

    public onMessage(callback: MaximaMessageCallback): () => void {
        this.messageListeners.add(callback);
        return () => { this.messageListeners.delete(callback); };
    }

    public onPeersChanged(callback: (peers: MaximaPeer[]) => void): () => void {
        this.peerListeners.add(callback);
        callback(this.peers);
        return () => { this.peerListeners.delete(callback); };
    }

    private notifyPeerListeners(): void {
        this.peerListeners.forEach(cb => {
            try { cb([...this.peers]); } catch (e) { /* ignore */ }
        });
    }

    // --- Getters ---

    public getPeers(): MaximaPeer[] {
        return [...this.peers];
    }

    public getPeerCount(): number {
        return this.peers.length;
    }

    // --- Utilities ---

    private stringToHex(str: string): string {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private hexToString(hex: string): string {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const bytes = new Uint8Array(cleanHex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
        }
        return new TextDecoder().decode(bytes);
    }

    public destroy(): void {
        if (this._unsubscribeMDS) {
            this._unsubscribeMDS();
            this._unsubscribeMDS = null;
        }
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }
        this.messageListeners.clear();
        this.peerListeners.clear();
    }
}

export const maximaService = new MaximaService();
