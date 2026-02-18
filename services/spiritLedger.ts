
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
            console.warn("[Spirit Ledger] Minima Node Offline. Running in Specter Mode.");
            setTimeout(() => {
                const mockTxId = "0xSPIRIT_" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                resolve({
                    hash: sessionHash,
                    timestamp: Date.now(),
                    blockHeight: 666000,
                    signature: mockTxId
                });
            }, 1000);
            return;
        }

        const command = `send amount:0 address:0xDEAD state:{"666":"${sessionHash}"}`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("✅ Spirit Anchored.");
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
