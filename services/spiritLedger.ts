
import { ProvenanceRecord, RecursiveMerkleProof, SequencerState } from '../types';

// SPIRIT LEDGER
// Hashes the soul of the machine (Session State) to the Minima RNPE-2 ledger

const RMP_CHUNK_SIZE_CHARS = 1024;

async function sha256Hex(value: string) {
    if (!globalThis.crypto?.subtle) {
        throw new Error("WEB_CRYPTO_UNAVAILABLE: RMP/RNPE-2 hashing requires a secure browser context.");
    }

    try {
        const data = new TextEncoder().encode(value);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown digest failure";
        throw new Error(`RMP_HASH_FAILED: ${message}`);
    }
}

function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        const serialized = JSON.stringify(value);
        if (typeof serialized !== 'string') throw new Error("RMP_SERIALIZATION_FAILED");
        return serialized;
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

    return `{${Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
        .join(',')}}`;
}

async function buildMerkleLayer(nodes: string[]) {
    const next: string[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = nodes[i + 1] || left;
        next.push(await sha256Hex(`RMP:BRANCH:${left}:${right}`));
    }
    return next;
}

export async function createRecursiveMerkleProof(payload: unknown, stateHash: string): Promise<RecursiveMerkleProof> {
    const canonical = canonicalJson(payload);
    if (!canonical) throw new Error("RMP_EMPTY_PAYLOAD");
    const computedStateHash = await sha256Hex(canonical);
    if (computedStateHash !== stateHash) throw new Error("RMP_STATE_HASH_MISMATCH");

    const chunks = canonical.match(new RegExp(`.{1,${RMP_CHUNK_SIZE_CHARS}}`, 'gs')) || [];
    if (chunks.length === 0) throw new Error("RMP_EMPTY_PAYLOAD");
    let layer = await Promise.all(chunks.map((chunk, index) => sha256Hex(`RMP:LEAF:${index}:${chunk}`)));
    const frontier = [layer[layer.length - 1]];
    let depth = 0;

    while (layer.length > 1) {
        layer = await buildMerkleLayer(layer);
        frontier.push(layer[layer.length - 1]);
        depth += 1;
    }

    return {
        version: 'RMP-1',
        root: layer[0],
        stateHash,
        leafCount: chunks.length,
        depth,
        frontier
    };
}

export async function captureSpiritHash(
  sequencerState: SequencerState
): Promise<{ hash: string; payload: any; rmpProof: RecursiveMerkleProof }> {
    const dataToHash = {
        timestamp: Date.now(),
        state: sequencerState,
        phantomSignature: "PHANTOM_CORE_V1"
    };

    const hashHex = await sha256Hex(canonicalJson(dataToHash));
    const rmpProof = await createRecursiveMerkleProof(dataToHash, hashHex);
    
    return { hash: hashHex, payload: dataToHash, rmpProof };
}

export function anchorSpirit(sessionHash: string, rmpProof: RecursiveMerkleProof): Promise<ProvenanceRecord> {
    return new Promise((resolve, reject) => {
        if (typeof window.MDS === 'undefined') {
            reject(new Error("MINIMA_MDS_UNAVAILABLE: PHANTOM must run inside Minima MDS to anchor RNPE-2 records."));
            return;
        }

        if (!/^[a-f0-9]{64}$/i.test(sessionHash) || !/^[a-f0-9]{64}$/i.test(rmpProof.root)) {
            reject(new Error("INVALID_SESSION_HASH"));
            return;
        }

        // RNPE-2 DATA ANCHORING WITH RMP ROOT
        const command = `send amount:0 address:0xDEAD state:{"2":"RNPE-2","200":"${sessionHash}","201":"${rmpProof.root}","202":"${rmpProof.leafCount}"}`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("✅ RNPE-2 RMP Data Anchored.");
                const blockHeight = response.response?.txpow?.header?.block || 0;
                resolve({
                    hash: sessionHash,
                    timestamp: Date.now(),
                    blockHeight,
                    signature: response.response?.txpow?.txpowid || "0xPENDING",
                    rmpProof,
                    rnpe2: {
                        profile: 'RNPE-2',
                        consensusBlock: blockHeight,
                        proofRoot: rmpProof.root,
                        verified: true
                    }
                });
            } else {
                reject(response.error);
            }
        });
    });
}

/**
 * RNPE-2 PROVENANCE REGISTRATION
 * Registers a unique RNPE-2 provenance token on the Minima blockchain.
 */
export function registerRnpe2Provenance(name: string, sessionHash: string, rmpProof: RecursiveMerkleProof): Promise<any> {
    return new Promise((resolve, reject) => {
        if (typeof window.MDS === 'undefined') {
            reject(new Error("MINIMA_MDS_UNAVAILABLE: PHANTOM must run inside Minima MDS to register RNPE-2 provenance."));
            return;
        }

        if (!/^[a-f0-9]{64}$/i.test(sessionHash) || !/^[a-f0-9]{64}$/i.test(rmpProof.root)) {
            reject(new Error("INVALID_SPIRIT_HASH"));
            return;
        }

        // RNPE-2 TOKEN CREATE
        const safeName = name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 48) || 'UNNAMED';
        const command = `tokencreate name:"RNPE2_${safeName}" amount:1 description:"RNPE-2 Phantom Provenance: ${sessionHash} RMP:${rmpProof.root}"`;
        window.MDS.cmd(command, (response: any) => {
            if (response.status) {
                console.log("💎 RNPE-2 Provenance Registered.");
                resolve(response.response);
            } else {
                reject(response.error);
            }
        });
    });
}
