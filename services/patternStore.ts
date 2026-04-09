
import { SequencerState, OnChainPattern } from '../types';
import { mdsService } from './mdsService';
import { logService } from './logService';

/**
 * Pattern Store — On-Chain Pattern Storage via Minima
 * 
 * Stores sequencer patterns on the Minima blockchain as custom tokens,
 * with pattern data persisted in the local MDS SQL database.
 * Each pattern is represented as:
 *   - A SHA-256 hash of the pattern state (integrity check)
 *   - A Minima custom token (on-chain NFT-like provenance)
 *   - A local DB row with full pattern data for retrieval
 */

export async function hashPattern(state: SequencerState): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({
        bpm: state.bpm,
        swing: state.swing,
        activePatternId: state.activePatternId,
        tracks: state.tracks.map(t => ({
            type: t.type,
            steps: t.steps,
            params: t.params,
            pan: t.pan
        })),
        phantomVersion: 'PINET_V2'
    }));

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store a pattern on-chain and in the local database.
 * Creates a Minima token with the pattern hash in its description.
 */
export async function storePatternOnChain(
    name: string,
    state: SequencerState
): Promise<OnChainPattern> {
    const hash = await hashPattern(state);
    const timestamp = Date.now();
    const creator = mdsService.publicKey || 'LOCAL';

    logService.addLog('INFO', 'PATTERN_STORE', `ANCHORING: ${name} [${hash.slice(0, 12)}...]`);

    let tokenId = '';
    let blockHeight = mdsService.blockHeight;

    try {
        // 1. Create on-chain token
        const escapedName = name.replace(/"/g, '\\"');
        const tokenResult = await mdsService.cmd(
            `tokencreate name:"PHANTOM_${escapedName}" amount:1 description:"PiNet_Pattern:${hash}" state:{"0":"${hash}","1":"${escapedName}","2":"${timestamp}"}`
        );
        tokenId = tokenResult?.tokenid || tokenResult?.response?.tokenid || `TKN_${hash.slice(0, 16)}`;
        blockHeight = tokenResult?.txpow?.header?.block || blockHeight;

        logService.addLog('SUCCESS', 'PATTERN_STORE', `TOKEN_MINTED: ${tokenId.slice(0, 16)}...`);
    } catch (e: any) {
        logService.addLog('WARN', 'PATTERN_STORE', `ON_CHAIN_MINT_FALLBACK: ${e.message || 'unknown'}`);
        tokenId = `LOCAL_${hash.slice(0, 16)}`;
    }

    // 2. Store full pattern data locally
    const patternData = JSON.stringify({
        bpm: state.bpm,
        swing: state.swing,
        timeSignature: state.timeSignature,
        tracks: state.tracks
    });

    const escapedData = patternData.replace(/'/g, "''");
    const escapedStoreName = name.replace(/'/g, "''");

    try {
        await mdsService.sql(
            `INSERT INTO phantom_patterns (token_id, name, hash, block_height, timestamp, creator, pattern_data) VALUES ('${tokenId}', '${escapedStoreName}', '${hash}', ${blockHeight}, ${timestamp}, '${creator}', '${escapedData}')`
        );
        logService.addLog('SUCCESS', 'PATTERN_STORE', 'PATTERN_PERSISTED_TO_DB');
    } catch (e: any) {
        logService.addLog('WARN', 'PATTERN_STORE', `DB_STORE_WARNING: ${e.message || 'unknown'}`);
    }

    return {
        tokenId,
        name,
        hash,
        blockHeight,
        timestamp,
        creator
    };
}

/**
 * Anchor a session hash to the blockchain without creating a token.
 * Lightweight zero-value transaction with state variable.
 */
export async function anchorHashOnChain(hash: string): Promise<{
    txId: string;
    blockHeight: number;
}> {
    logService.addLog('INFO', 'PATTERN_STORE', `OMNIA_ANCHORING: ${hash.slice(0, 16)}...`);

    try {
        const result = await mdsService.cmd(
            `send amount:0 address:0xFFEE state:{"100":"${hash}","101":"PHANTOM_PINET"}`
        );

        const txId = result?.txpow?.txpowid || `SIM_TX_${hash.slice(0, 12)}`;
        const blockHeight = result?.txpow?.header?.block || mdsService.blockHeight;

        logService.addLog('SUCCESS', 'PATTERN_STORE', `OMNIA_ANCHORED at block ${blockHeight}`);

        return { txId, blockHeight };
    } catch (e: any) {
        logService.addLog('ERROR', 'PATTERN_STORE', `ANCHOR_FAILED: ${e.message || 'unknown'}`);
        throw e;
    }
}

/**
 * Retrieve all stored patterns from the local database.
 */
export async function getStoredPatterns(): Promise<OnChainPattern[]> {
    try {
        const result = await mdsService.sql(
            'SELECT token_id, name, hash, block_height, timestamp, creator FROM phantom_patterns ORDER BY timestamp DESC'
        );

        if (result?.rows && Array.isArray(result.rows)) {
            return result.rows.map((row: any) => ({
                tokenId: row.TOKEN_ID || row.token_id || '',
                name: row.NAME || row.name || '',
                hash: row.HASH || row.hash || '',
                blockHeight: parseInt(row.BLOCK_HEIGHT || row.block_height || '0'),
                timestamp: parseInt(row.TIMESTAMP || row.timestamp || '0'),
                creator: row.CREATOR || row.creator || ''
            }));
        }
        return [];
    } catch (e) {
        logService.addLog('WARN', 'PATTERN_STORE', 'FAILED_TO_QUERY_PATTERNS');
        return [];
    }
}

/**
 * Get the count of stored patterns.
 */
export async function getPatternCount(): Promise<number> {
    try {
        const result = await mdsService.sql(
            'SELECT COUNT(*) as CNT FROM phantom_patterns'
        );
        if (result?.rows?.[0]) {
            return parseInt(result.rows[0].CNT || result.rows[0].COUNT || '0');
        }
        return 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Load a pattern's full data from the local database.
 */
export async function loadPatternData(hash: string): Promise<any | null> {
    try {
        const escapedHash = hash.replace(/'/g, "''");
        const result = await mdsService.sql(
            `SELECT pattern_data FROM phantom_patterns WHERE hash='${escapedHash}' LIMIT 1`
        );
        if (result?.rows?.[0]) {
            const raw = result.rows[0].PATTERN_DATA || result.rows[0].pattern_data;
            return JSON.parse(raw);
        }
        return null;
    } catch (e) {
        return null;
    }
}
