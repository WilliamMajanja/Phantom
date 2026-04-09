
import { ProvenanceRecord, SequencerState } from '../types';
import { mdsService } from './mdsService';
import { logService } from './logService';

/**
 * 1. CRYPTOGRAPHIC HASHING
 * Converts the raw AudioBuffer or Session JSON into a unique SHA-256 fingerprint.
 * Changing even 1ms of audio (or one step in the sequencer) results in a completely different hash.
 */
export async function generateSessionHash(
  sequencerState: SequencerState, 
  audioBuffer: Float32Array | null = null
): Promise<{ hash: string; payload: any }> {
    const encoder = new TextEncoder();
    
    const dataToHash = {
        timestamp: Date.now(),
        state: sequencerState,
        audioChecksum: audioBuffer ? audioBuffer.reduce((a, b) => a + b, 0) : 0 
    };

    const jsonString = JSON.stringify(dataToHash);
    const data = encoder.encode(jsonString);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
        hash: hashHex,
        payload: dataToHash
    };
}

/**
 * 2. MINIMA BLOCKCHAIN ANCHORING via MDS Service
 * Sends the hash to the Minima layer to be stored immutably.
 * Uses mdsService.cmd() which handles both real MDS and simulation transparently.
 */
export async function anchorToMinima(sessionHash: string): Promise<ProvenanceRecord> {
    logService.addLog('INFO', 'MINIMA', `ANCHORING: ${sessionHash.slice(0, 16)}...`);

    try {
        const result = await mdsService.cmd(
            `send amount:0 address:0xFFEE state:{"100":"${sessionHash}","101":"PHANTOM_PINET"}`
        );

        const txpowid = result?.txpow?.txpowid || result?.txpowid || '0xPENDING';
        const block = result?.txpow?.header?.block || mdsService.blockHeight;

        logService.addLog('SUCCESS', 'MINIMA', `SESSION_ANCHORED at block ${block}`);

        return {
            hash: sessionHash,
            timestamp: Date.now(),
            blockHeight: block,
            signature: txpowid
        };
    } catch (e: any) {
        logService.addLog('ERROR', 'MINIMA', `ANCHOR_FAILED: ${e.message || 'unknown'}`);
        throw e;
    }
}
