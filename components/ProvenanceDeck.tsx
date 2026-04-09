
import React, { useState, useEffect } from 'react';
import { ProvenanceRecord, OnChainPattern } from '../types';
import { getStoredPatterns } from '../services/patternStore';
import { mdsService } from '../services/mdsService';

interface ProvenanceDeckProps {
    record: ProvenanceRecord | null;
    token: any | null;
}

const ProvenanceDeck: React.FC<ProvenanceDeckProps> = ({ record, token }) => {
    const [storedPatterns, setStoredPatterns] = useState<OnChainPattern[]>([]);
    const [isSimulated, setIsSimulated] = useState(true);

    useEffect(() => {
        setIsSimulated(mdsService.isSimulated);
        // Fetch stored patterns from MDS database
        getStoredPatterns().then(setStoredPatterns);

        // Refresh when new blocks arrive
        const unsub = mdsService.on('NEWBLOCK', () => {
            getStoredPatterns().then(setStoredPatterns);
        });
        return () => { unsub(); };
    }, [record, token]);

    return (
        <div className="glass-panel p-6 bg-black border border-gray-800 font-mono">
            <div className="flex justify-between border-b border-gray-800 pb-2 mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">BLOCKCHAIN_PROVENANCE</h3>
                <div className="flex items-center gap-2">
                    {isSimulated && (
                        <span className="text-[7px] bg-yellow-900/30 text-yellow-500 border border-yellow-800/50 px-1 py-0.5 rounded-sm">SIM</span>
                    )}
                    <span className="text-[9px] text-accent">MINIMA_PINET</span>
                </div>
            </div>

            <div className="space-y-6">
                {/* OMNIA SECTION */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${record ? 'bg-accent' : 'bg-gray-800'}`}></div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">OMNIA_ANCHOR</span>
                    </div>
                    {record ? (
                        <div className="bg-gray-900/50 p-3 border border-gray-800 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-[8px] text-gray-600 uppercase">State_Hash</span>
                                <span className="text-[9px] text-accent truncate max-w-[150px]">{record.hash}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[8px] text-gray-600 uppercase">Block_Height</span>
                                <span className="text-[9px] text-gray-300">{record.blockHeight.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[8px] text-gray-600 uppercase">TX_ID</span>
                                <span className="text-[9px] text-gray-400 truncate max-w-[150px]">{record.signature}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[9px] text-gray-600 italic">NO_DATA_ANCHORED</div>
                    )}
                </div>

                {/* AXIA SECTION */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${token ? 'bg-purple-500' : 'bg-gray-800'}`}></div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">AXIA_TOKEN</span>
                    </div>
                    {token ? (
                        <div className="bg-purple-900/5 p-3 border border-purple-900/20 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-[8px] text-purple-900/60 uppercase">Token_Name</span>
                                <span className="text-[9px] text-purple-400">{token.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[8px] text-purple-900/60 uppercase">Token_ID</span>
                                <span className="text-[9px] text-purple-500 truncate max-w-[150px]">{token.tokenid}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[8px] text-purple-900/60 uppercase">Status</span>
                                <span className="text-[9px] text-purple-300">CONFIRMED_ON_CHAIN</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[9px] text-gray-600 italic">NO_TOKEN_MINTED</div>
                    )}
                </div>

                {/* ON-CHAIN PATTERN HISTORY */}
                {storedPatterns.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">PATTERN_LEDGER</span>
                            <span className="text-[8px] text-gray-600">({storedPatterns.length})</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {storedPatterns.slice(0, 10).map((p, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-900/30 px-2 py-1.5 border border-gray-800/50">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-blue-300 font-bold">{p.name}</span>
                                        <span className="text-[7px] text-gray-600">{p.hash.slice(0, 16)}...</span>
                                    </div>
                                    <span className="text-[8px] text-gray-500">
                                        BLK {p.blockHeight.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800">
                <p className="text-[8px] text-gray-600 leading-relaxed">
                    PiNet DApp uses Minima's Omnia protocol for immutable state anchoring and Axia for unique asset tokenization. 
                    Patterns are stored on-chain with SHA-256 integrity proofs. Peer sync via Maxima P2P mesh.
                </p>
            </div>
        </div>
    );
};

export default ProvenanceDeck;
