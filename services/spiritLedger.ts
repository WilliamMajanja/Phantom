
import { ProvenanceRecord, SequencerState } from '../types';

// SPIRIT LEDGER
// Hashes the soul of the machine (Session State) to the Minima RMPE-2 ledger

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
            reject(new Error("MINIMA_MDS_UNAVAILABLE: PHANTOM must run inside Minima MDS to anchor RMPE-2 records."));
            return;
        }

        if (!/^[a-f0-9]{64}$/i.test(sessionHash)) {
            reject(new Error("INVALID_SESSION_HASH"));
            return;
        }

        // RMPE-2 DATA ANCHORING
        const command = `send amount:0 address:0xDEAD state:{"2":"RMPE-2","200":"${sessionHash}"}`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("✅ RMPE-2 Data Anchored.");
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
 * RMPE-2 PROVENANCE REGISTRATION
 * Registers a unique RMPE-2 provenance token on the Minima blockchain.
 */
export function registerRmpe2Provenance(name: string, sessionHash: string): Promise<any> {
    return new Promise((resolve, reject) => {
        if (typeof window.MDS === 'undefined') {
            reject(new Error("MINIMA_MDS_UNAVAILABLE: PHANTOM must run inside Minima MDS to register RMPE-2 provenance."));
            return;
        }

        if (!/^[a-f0-9]{64}$/i.test(sessionHash)) {
            reject(new Error("INVALID_SPIRIT_HASH"));
            return;
        }

        // RMPE-2 TOKEN CREATE
        const safeName = name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 48) || 'UNNAMED';
        const command = `tokencreate name:"RMPE2_${safeName}" amount:1 description:"RMPE-2 Phantom Provenance: ${sessionHash}"`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("💎 RMPE-2 Provenance Registered.");
                resolve(response.response);
            } else {
                reject(response.error);
            }
        });
    });
}
