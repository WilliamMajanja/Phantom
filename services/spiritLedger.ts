
import { ProvenanceRecord, SequencerState } from '../types';

// SPIRIT LEDGER
// Hashes the soul of the machine (Session State) to the Minima Blockchain

export async function captureSpiritHash(
  sequencerState: SequencerState
): Promise<{ hash: string; payload: any }> {
    const encoder = new TextEncoder();
    const dataToHash = {
        timestamp: Date.now(),
        state: sequencerState,
        phantomSignature: "PHANTOM_CORE_V1"
    };

    const jsonString = JSON.stringify(dataToHash);
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { hash: hashHex, payload: dataToHash };
}

export function anchorSpirit(sessionHash: string): Promise<ProvenanceRecord> {
    return new Promise((resolve, reject) => {
        if (typeof window.MDS === 'undefined') {
            reject(new Error("MINIMA_MDS_UNAVAILABLE: PHANTOM must run inside Minima MDS to anchor Omnia records."));
            return;
        }

        if (!/^[a-f0-9]{64}$/i.test(sessionHash)) {
            reject(new Error("INVALID_SESSION_HASH"));
            return;
        }

        // OMNIA DATA ANCHORING
        // We use state variables to anchor the hash to the chain
        const command = `send amount:0 address:0xDEAD state:{"666":"${sessionHash}"}`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("✅ Omnia Data Anchored.");
                resolve({
                    hash: sessionHash,
                    timestamp: Date.now(),
                    blockHeight: response.response?.txpow?.header?.block || 0,
                    signature: response.response?.txpow?.txpowid || "0xPENDING"
                });
            } else {
                reject(response.error);
            }
        });
    });
}

/**
 * AXIA TOKENIZATION
 * Mints a unique NFT-style token on the Minima blockchain representing the audio pattern.
 */
export function mintAxiaToken(name: string, sessionHash: string): Promise<any> {
    return new Promise((resolve, reject) => {
        if (typeof window.MDS === 'undefined') {
            reject(new Error("MINIMA_MDS_UNAVAILABLE: PHANTOM must run inside Minima MDS to mint Axia tokens."));
            return;
        }

        if (!/^[a-f0-9]{64}$/i.test(sessionHash)) {
            reject(new Error("INVALID_SPIRIT_HASH"));
            return;
        }

        // AXIA TOKEN CREATE
        // We create a token with the session hash in the description/state
        const safeName = name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 48) || 'UNNAMED';
        const command = `tokencreate name:"PHANTOM_${safeName}" amount:1 description:"Phantom Audio Provenance: ${sessionHash}"`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("💎 Axia Token Minted.");
                resolve(response.response);
            } else {
                reject(response.error);
            }
        });
    });
}
