
import { ProvenanceRecord, SequencerState } from '../types';
import { mdsService } from './mdsService';
import { logService } from './logService';
import { escapeCmd } from './utils';

// SPIRIT LEDGER
// Hashes the soul of the machine (Session State) to the Minima Blockchain
// Now powered by the MDS DApp service for proper lifecycle management

export async function captureSpiritHash(
  sequencerState: SequencerState
): Promise<{ hash: string; payload: any }> {
    const encoder = new TextEncoder();
    const dataToHash = {
        timestamp: Date.now(),
        state: sequencerState,
        phantomSignature: "PHANTOM_PINET_V2"
    };

    const jsonString = JSON.stringify(dataToHash);
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { hash: hashHex, payload: dataToHash };
}

/**
 * OMNIA DATA ANCHORING via MDS Service
 * Sends the hash to the Minima layer to be stored immutably.
 * Uses mdsService.cmd() which handles both real MDS and simulation.
 */
export async function anchorSpirit(sessionHash: string): Promise<ProvenanceRecord> {
    logService.addLog('INFO', 'SPIRIT', `ANCHORING_HASH: ${sessionHash.slice(0, 16)}...`);

    try {
        const result = await mdsService.cmd(
            `send amount:0 address:0xDEAD state:{"666":"${sessionHash}","667":"PHANTOM_PINET"}`
        );

        const txpowid = result?.txpow?.txpowid || result?.txpowid || '0xPENDING';
        const block = result?.txpow?.header?.block || mdsService.blockHeight;

        logService.addLog('SUCCESS', 'SPIRIT', `OMNIA_ANCHORED at block ${block}`);

        return {
            hash: sessionHash,
            timestamp: Date.now(),
            blockHeight: block,
            signature: txpowid
        };
    } catch (e: any) {
        logService.addLog('ERROR', 'SPIRIT', `ANCHOR_FAILED: ${e.message || 'unknown'}`);
        throw e;
    }
}

/**
 * AXIA TOKENIZATION via MDS Service
 * Mints a unique NFT-style token on the Minima blockchain representing the audio pattern.
 * Uses mdsService.cmd() which handles both real MDS and simulation.
 */
export async function mintAxiaToken(name: string, sessionHash: string): Promise<any> {
    logService.addLog('INFO', 'AXIA', `MINTING_TOKEN: PHANTOM_${name}`);

    try {
        const escapedName = escapeCmd(name);
        const result = await mdsService.cmd(
            `tokencreate name:"PHANTOM_${escapedName}" amount:1 description:"PiNet Provenance: ${sessionHash}" state:{"0":"${sessionHash}","1":"${escapedName}"}`
        );

        const tokenid = result?.tokenid || result?.response?.tokenid || `TKN_${sessionHash.slice(0, 12)}`;

        logService.addLog('SUCCESS', 'AXIA', `TOKEN_MINTED: ${tokenid.slice(0, 16)}...`);

        return {
            status: true,
            tokenid,
            name: `PHANTOM_${name}`
        };
    } catch (e: any) {
        logService.addLog('ERROR', 'AXIA', `MINT_FAILED: ${e.message || 'unknown'}`);
        throw e;
    }
}
