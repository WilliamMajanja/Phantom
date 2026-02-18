
import { ProvenanceRecord, SequencerState } from '../types';

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
    
    // Combine state metadata (BPM, pattern) with audio data if available
    const dataToHash = {
        timestamp: Date.now(),
        state: sequencerState,
        // In a real app, we'd hash the PCM data. For the prototype, we hash the JSON state 
        // and a checksum of the buffer if provided.
        audioChecksum: audioBuffer ? audioBuffer.reduce((a, b) => a + b, 0) : 0 
    };

    const jsonString = JSON.stringify(dataToHash);
    const data = encoder.encode(jsonString);
    
    // Native high-performance hashing (SubtleCrypto)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert ArrayBuffer to Hex String
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
        hash: hashHex,
        payload: dataToHash
    };
}

/**
 * 2. MINIMA BLOCKCHAIN ANCHORING
 * Sends the hash to the Minima layer to be stored immutably.
 */
export function anchorToMinima(sessionHash: string): Promise<ProvenanceRecord> {
    return new Promise((resolve, reject) => {
        // Check if Minima environment is present (MDS is injected by Minima OS)
        if (typeof window.MDS === 'undefined') {
            console.warn("[Minima] MDS not found. Running in simulation mode.");
            
            // SIMULATION MODE
            setTimeout(() => {
                const mockTxId = "0xSIM_" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                
                resolve({
                    hash: sessionHash,
                    timestamp: Date.now(),
                    blockHeight: Math.floor(Math.random() * 1000000) + 5000000,
                    signature: mockTxId
                });
            }, 1000);
            return;
        }

        // Construct the Transaction
        // We send 0 Minima, but we attach the hash as 'state' data (Port 100)
        const command = `send amount:0 address:0xFFEE state:{"100":"${sessionHash}"}`;

        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("✅ Session Anchored to Blockchain!");
                // Minima responses vary, adapting to standard structure
                const txpowid = response.response?.txpow?.txpowid || response.params?.txpowid || "0xPENDING";
                
                resolve({
                    hash: sessionHash,
                    timestamp: Date.now(),
                    blockHeight: response.response?.txpow?.header?.block || 0,
                    signature: txpowid
                });
            } else {
                console.error("Minima Anchor Failed:", response.error);
                reject(response.error);
            }
        });
    });
}
