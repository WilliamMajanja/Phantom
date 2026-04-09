
import React, { useState, useEffect } from 'react';
import { mdsService } from '../services/mdsService';
import { maximaService } from '../services/maximaService';
import { getPatternCount } from '../services/patternStore';
import { MDSConnectionState, MaximaPeer } from '../types';
import { truncateHex } from '../services/utils';

const DAppStatus: React.FC = () => {
    const [connectionState, setConnectionState] = useState<MDSConnectionState>('DISCONNECTED');
    const [blockHeight, setBlockHeight] = useState(0);
    const [peerCount, setPeerCount] = useState(0);
    const [patternCount, setPatternCount] = useState(0);
    const [isSimulated, setIsSimulated] = useState(true);
    const [nodeAddress, setNodeAddress] = useState('');
    const [peers, setPeers] = useState<MaximaPeer[]>([]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const unsubConn = mdsService.onConnectionChange((state) => {
            setConnectionState(state);
            setIsSimulated(mdsService.isSimulated);
            setNodeAddress(mdsService.nodeAddress);
        });

        const unsubBlock = mdsService.on('NEWBLOCK', () => {
            setBlockHeight(mdsService.blockHeight);
        });

        const unsubPeers = maximaService.onPeersChanged((p) => {
            setPeers(p);
            setPeerCount(p.length);
        });

        // Fetch initial data
        setBlockHeight(mdsService.blockHeight);
        setPeerCount(maximaService.getPeerCount());
        getPatternCount().then(setPatternCount);

        // Periodically refresh pattern count
        const interval = setInterval(() => {
            getPatternCount().then(setPatternCount);
        }, 15000);

        return () => {
            unsubConn();
            unsubBlock();
            unsubPeers();
            clearInterval(interval);
        };
    }, []);

    const getConnectionColor = () => {
        switch (connectionState) {
            case 'CONNECTED': return 'bg-accent';
            case 'CONNECTING': return 'bg-yellow-500 animate-pulse';
            case 'ERROR': return 'bg-red-500';
            default: return 'bg-gray-600';
        }
    };

    const getConnectionText = () => {
        switch (connectionState) {
            case 'CONNECTED': return isSimulated ? 'SIM_MODE' : 'ON_CHAIN';
            case 'CONNECTING': return 'SYNCING';
            case 'ERROR': return 'ERROR';
            default: return 'OFFLINE';
        }
    };

    return (
        <div className="glass-panel p-6 bg-black border border-gray-800 font-mono">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">PINET_DAPP</h3>
                    {isSimulated && (
                        <span className="text-[7px] bg-yellow-900/30 text-yellow-500 border border-yellow-800/50 px-1.5 py-0.5 rounded-sm font-bold">
                            SIMULATED
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getConnectionColor()} shadow-[0_0_6px_currentColor]`}></div>
                    <span className={`text-[9px] font-bold ${connectionState === 'CONNECTED' ? 'text-accent' : 'text-gray-500'}`}>
                        {getConnectionText()}
                    </span>
                </div>
            </div>

            {/* Core Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-900/50 p-3 border border-gray-800">
                    <div className="text-[8px] text-gray-600 uppercase font-bold mb-1">Block Height</div>
                    <div className="text-sm font-bold text-accent font-mono tabular-nums">
                        {blockHeight.toLocaleString()}
                    </div>
                </div>
                <div className="bg-gray-900/50 p-3 border border-gray-800">
                    <div className="text-[8px] text-gray-600 uppercase font-bold mb-1">Maxima Peers</div>
                    <div className="text-sm font-bold text-blue-400 font-mono">
                        {peerCount}
                    </div>
                </div>
                <div className="bg-gray-900/50 p-3 border border-gray-800">
                    <div className="text-[8px] text-gray-600 uppercase font-bold mb-1">On-Chain Patterns</div>
                    <div className="text-sm font-bold text-purple-400 font-mono">
                        {patternCount}
                    </div>
                </div>
                <div className="bg-gray-900/50 p-3 border border-gray-800">
                    <div className="text-[8px] text-gray-600 uppercase font-bold mb-1">Protocol</div>
                    <div className="text-[10px] font-bold text-gray-300 font-mono">
                        MINIMA_OMNIA
                    </div>
                </div>
            </div>

            {/* Node Identity */}
            <div className="bg-gray-900/30 p-3 border border-gray-800 mb-3">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[8px] text-gray-600 uppercase font-bold">Node Address</span>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-[8px] text-gray-500 hover:text-accent transition-colors"
                    >
                        {expanded ? 'COLLAPSE' : 'EXPAND'}
                    </button>
                </div>
                <div className={`text-[9px] text-accent font-mono break-all ${expanded ? '' : 'truncate'}`}>
                    {nodeAddress || 'AWAITING_SYNC...'}
                </div>
            </div>

            {/* Peer List */}
            {peers.length > 0 && (
                <div className="space-y-1.5 mb-3">
                    <span className="text-[8px] text-gray-600 uppercase font-bold">Connected Peers</span>
                    {peers.slice(0, 5).map((peer, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-900/30 px-2 py-1 border border-gray-800/50">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                                <span className="text-[9px] text-blue-300 font-mono">{peer.name}</span>
                            </div>
                                <span className="text-[7px] text-gray-600 font-mono">
                                    {truncateHex(peer.publickey)}
                                </span>
                        </div>
                    ))}
                    {peers.length > 5 && (
                        <div className="text-[8px] text-gray-600 text-center">
                            +{peers.length - 5} more peers
                        </div>
                    )}
                </div>
            )}

            {/* Protocol Info */}
            <div className="pt-3 border-t border-gray-800">
                <p className="text-[8px] text-gray-600 leading-relaxed">
                    PiNet DApp running on Minima Layer 1. Patterns are anchored via Omnia state variables.
                    Peer communication uses the Maxima protocol for fully decentralized mesh sync.
                    {isSimulated && ' Currently in simulation mode — connect to a Minima node for on-chain operations.'}
                </p>
            </div>
        </div>
    );
};

export default DAppStatus;
