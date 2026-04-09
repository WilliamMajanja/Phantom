
import { MDSConnectionState, MDSEvent, MinimaBalance, DAppState } from '../types';
import { logService } from './logService';

/**
 * MDS (Minima Distributed System) Service
 * 
 * Core DApp lifecycle manager. Handles:
 * - MDS.init() bootstrapping when running inside Minima
 * - Connection state tracking
 * - Command execution with promise wrapper
 * - SQL database access for local DApp storage
 * - Event dispatch for NEWBLOCK, MINING, MAXIMA, etc.
 * - Simulation fallback for development outside Minima
 */

type MDSEventCallback = (event: MDSEvent) => void;

class MDSService {
    private state: MDSConnectionState = 'DISCONNECTED';
    private listeners: Set<(state: MDSConnectionState) => void> = new Set();
    private eventListeners: Map<string, Set<MDSEventCallback>> = new Map();
    private _blockHeight: number = 0;
    private _nodeAddress: string = '';
    private _publicKey: string = '';
    private _balance: MinimaBalance[] = [];
    private _isSimulated: boolean = true;
    private _simulationInterval: ReturnType<typeof setInterval> | null = null;

    get blockHeight() { return this._blockHeight; }
    get nodeAddress() { return this._nodeAddress; }
    get publicKey() { return this._publicKey; }
    get balance() { return this._balance; }
    get isSimulated() { return this._isSimulated; }
    get connectionState() { return this.state; }

    /**
     * Initialize the MDS connection.
     * If window.MDS exists (running inside Minima), use real MDS.init().
     * Otherwise, start a simulation layer for development.
     */
    public init(): void {
        this.setState('CONNECTING');
        logService.addLog('INFO', 'MDS', 'INITIALIZING_DAPP_BRIDGE...');

        if (typeof window !== 'undefined' && typeof window.MDS !== 'undefined') {
            this._isSimulated = false;
            this.initReal();
        } else {
            this._isSimulated = true;
            this.initSimulation();
        }
    }

    private initReal(): void {
        try {
            window.MDS.init((msg: any) => {
                const event = msg.event || msg.action;

                switch (event) {
                    case 'inited':
                        this.setState('CONNECTED');
                        logService.addLog('SUCCESS', 'MDS', 'PINET_DAPP_BRIDGE_ONLINE');
                        this.fetchNodeInfo();
                        this.fetchBalance();
                        this.initDatabase();
                        break;

                    case 'NEWBLOCK':
                        this._blockHeight = msg.data?.txpow?.header?.block || this._blockHeight + 1;
                        this.emit({ event: 'NEWBLOCK', data: msg.data });
                        break;

                    case 'NEWBALANCE':
                        this.fetchBalance();
                        this.emit({ event: 'NEWBALANCE', data: msg.data });
                        break;

                    case 'MAXIMA':
                        this.emit({ event: 'MAXIMA', data: msg.data });
                        break;

                    case 'MINING':
                        this.emit({ event: 'MINING', data: msg.data });
                        break;

                    case 'MDS_TIMER_10SECONDS':
                        this.emit({ event: 'TIMER', data: null });
                        break;

                    default:
                        this.emit({ event, data: msg.data });
                        break;
                }
            });
        } catch (e) {
            this.setState('ERROR');
            logService.addLog('ERROR', 'MDS', 'DAPP_BRIDGE_INIT_FAILED');
        }
    }

    private initSimulation(): void {
        // Generate a deterministic simulated identity
        const simId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        this._nodeAddress = `MxG18HGG6FJ038614Y8CW46US6Y20QKF7${simId.slice(0, 12).toUpperCase()}`;
        this._publicKey = `0x${simId}`;
        this._blockHeight = 2000000 + Math.floor(Math.random() * 100000);
        this._balance = [{
            token: 'Minima',
            tokenid: '0x00',
            confirmed: '1000.0',
            unconfirmed: '0',
            sendable: '1000.0',
            total: '1000.0'
        }];

        this.setState('CONNECTED');
        logService.addLog('WARN', 'MDS', 'SIMULATION_MODE — No Minima node detected');
        logService.addLog('SUCCESS', 'MDS', `PINET_DAPP_BRIDGE_ONLINE [SIM] Block: ${this._blockHeight}`);

        this.initDatabase();

        // Simulate block progression
        this._simulationInterval = setInterval(() => {
            this._blockHeight += 1;
            this.emit({ event: 'NEWBLOCK', data: { block: this._blockHeight } });
        }, 50000); // ~50s block time like Minima
    }

    /**
     * Execute an MDS command. Returns a promise.
     * In simulation mode, returns mock responses.
     */
    public cmd(command: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._isSimulated) {
                resolve(this.simulateCommand(command));
                return;
            }

            if (this.state !== 'CONNECTED') {
                reject(new Error('MDS not connected'));
                return;
            }

            window.MDS.cmd(command, (resp: any) => {
                if (resp.status === true || resp.status === 'true') {
                    resolve(resp.response || resp);
                } else {
                    reject(new Error(resp.error || resp.message || 'MDS command failed'));
                }
            });
        });
    }

    /**
     * Execute a SQL query on the MDS database.
     */
    public sql(query: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._isSimulated) {
                resolve(this.simulateSQL(query));
                return;
            }

            if (this.state !== 'CONNECTED') {
                reject(new Error('MDS not connected'));
                return;
            }

            window.MDS.sql(query, (resp: any) => {
                if (resp.status === true || resp.status === 'true') {
                    resolve(resp);
                } else {
                    reject(new Error(resp.error || 'SQL query failed'));
                }
            });
        });
    }

    private async fetchNodeInfo(): Promise<void> {
        try {
            const status = await this.cmd('status');
            this._blockHeight = status.chain?.block || 0;

            const maxima = await this.cmd('maxima');
            this._publicKey = maxima.publickey || '';
            this._nodeAddress = maxima.contact || '';
        } catch (e) {
            logService.addLog('WARN', 'MDS', 'FAILED_TO_FETCH_NODE_INFO');
        }
    }

    private async fetchBalance(): Promise<void> {
        try {
            const bal = await this.cmd('balance');
            if (Array.isArray(bal)) {
                this._balance = bal;
            }
        } catch (e) {
            // Balance fetch is non-critical
        }
    }

    private async initDatabase(): Promise<void> {
        try {
            await this.sql(`CREATE TABLE IF NOT EXISTS phantom_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_id VARCHAR(256),
                name VARCHAR(128) NOT NULL,
                hash VARCHAR(64) NOT NULL,
                block_height INTEGER DEFAULT 0,
                timestamp BIGINT NOT NULL,
                creator VARCHAR(256),
                pattern_data TEXT NOT NULL
            )`);

            await this.sql(`CREATE TABLE IF NOT EXISTS phantom_peers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                public_key VARCHAR(512) NOT NULL UNIQUE,
                name VARCHAR(128),
                last_seen BIGINT NOT NULL,
                extra_data TEXT
            )`);

            logService.addLog('INFO', 'MDS', 'LOCAL_DB_INITIALIZED');
        } catch (e) {
            logService.addLog('WARN', 'MDS', 'DB_INIT_WARNING — tables may already exist');
        }
    }

    /**
     * Simulate MDS commands for development outside Minima.
     */
    private simulateCommand(command: string): any {
        const cmd = command.trim().toLowerCase();

        if (cmd.startsWith('status')) {
            return {
                chain: { block: this._blockHeight, time: Date.now(), length: this._blockHeight },
                version: '1.0.36',
                devices: 1
            };
        }

        if (cmd.startsWith('balance')) {
            return this._balance;
        }

        if (cmd.startsWith('maxima')) {
            return {
                publickey: this._publicKey,
                contact: this._nodeAddress,
                logs: true,
                poll: false
            };
        }

        if (cmd.startsWith('send')) {
            const mockTxId = '0xSIM_TX_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            return {
                txpow: {
                    txpowid: mockTxId,
                    header: { block: this._blockHeight }
                }
            };
        }

        if (cmd.startsWith('tokencreate')) {
            const tokenId = '0xSIM_TKN_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            return {
                tokenid: tokenId,
                status: true
            };
        }

        if (cmd.startsWith('tokens')) {
            return [];
        }

        if (cmd.startsWith('maxcontacts')) {
            return [];
        }

        if (cmd.startsWith('maxsend')) {
            return { delivered: true };
        }

        // Default mock
        return { status: true };
    }

    // In-memory simulated SQL store
    private simDBPatterns: any[] = [];
    private simDBPeers: any[] = [];
    private simIdCounter: number = 1;

    private simulateSQL(query: string): any {
        const q = query.trim();
        const upperQ = q.toUpperCase();

        // CREATE TABLE — always succeed
        if (upperQ.startsWith('CREATE TABLE')) {
            return { status: true, count: 0, rows: [] };
        }

        // INSERT INTO phantom_patterns
        if (upperQ.startsWith('INSERT INTO PHANTOM_PATTERNS')) {
            const valuesMatch = q.match(/VALUES\s*\((.+)\)/i);
            if (valuesMatch) {
                const id = this.simIdCounter++;
                this.simDBPatterns.push({ id });
                return { status: true, count: 1, rows: [] };
            }
        }

        // INSERT INTO phantom_peers
        if (upperQ.startsWith('INSERT INTO PHANTOM_PEERS') || upperQ.startsWith('INSERT OR REPLACE INTO PHANTOM_PEERS')) {
            this.simDBPeers.push({ id: this.simIdCounter++ });
            return { status: true, count: 1, rows: [] };
        }

        // SELECT from phantom_patterns
        if (upperQ.includes('FROM PHANTOM_PATTERNS')) {
            if (upperQ.includes('COUNT(')) {
                return { status: true, count: 1, rows: [{ COUNT: this.simDBPatterns.length }] };
            }
            return { status: true, count: this.simDBPatterns.length, rows: this.simDBPatterns };
        }

        // SELECT from phantom_peers
        if (upperQ.includes('FROM PHANTOM_PEERS')) {
            return { status: true, count: this.simDBPeers.length, rows: this.simDBPeers };
        }

        // DELETE
        if (upperQ.startsWith('DELETE FROM PHANTOM_PATTERNS')) {
            this.simDBPatterns = [];
            return { status: true, count: 0, rows: [] };
        }

        return { status: true, count: 0, rows: [] };
    }

    // --- Event System ---

    public on(event: string, callback: MDSEventCallback): () => void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(callback);
        return () => {
            this.eventListeners.get(event)?.delete(callback);
        };
    }

    private emit(event: MDSEvent): void {
        const listeners = this.eventListeners.get(event.event);
        if (listeners) {
            listeners.forEach(cb => {
                try { cb(event); } catch (e) { /* prevent listener errors from breaking chain */ }
            });
        }
        // Also notify wildcard listeners
        const wildcardListeners = this.eventListeners.get('*');
        if (wildcardListeners) {
            wildcardListeners.forEach(cb => {
                try { cb(event); } catch (e) { /* prevent listener errors from breaking chain */ }
            });
        }
    }

    // --- Connection State ---

    private setState(newState: MDSConnectionState): void {
        this.state = newState;
        this.listeners.forEach(cb => {
            try { cb(newState); } catch (e) { /* ignore */ }
        });
    }

    public onConnectionChange(callback: (state: MDSConnectionState) => void): () => void {
        this.listeners.add(callback);
        callback(this.state);
        return () => { this.listeners.delete(callback); };
    }

    /**
     * Get a snapshot of the full DApp state.
     */
    public getState(): DAppState {
        return {
            mdsConnected: this.state,
            blockHeight: this._blockHeight,
            nodeAddress: this._nodeAddress,
            publicKey: this._publicKey,
            onChainPatterns: [],
            maximaPeers: [],
            balance: this._balance
        };
    }

    public destroy(): void {
        if (this._simulationInterval) {
            clearInterval(this._simulationInterval);
            this._simulationInterval = null;
        }
        this.listeners.clear();
        this.eventListeners.clear();
    }
}

export const mdsService = new MDSService();
