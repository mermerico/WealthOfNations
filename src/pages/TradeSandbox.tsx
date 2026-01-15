import React, { useState, useMemo } from 'react';
import { TradeModal } from '../components/game/TradeModal';
import { ResourceIcon } from '../components/ui/ResourceIcon';
import type { GameState, Player, MarketState, CommodityType, HexCell, IndustryTile } from '../types/gameState';
import { PlayerRoster } from '../components/game/PlayerRoster';
import { MARKET_PRICE_MAP } from '../utils/marketPrices';
import { calculateGlobalProduction } from '../utils/production';

// Mock Players (6 Players)
const MOCK_PLAYERS: Player[] = [
    { id: 'p1', name: 'Anglica', color: '#ef4444', resources: { Food: 5, Energy: 2, Labor: 3, Ore: 0, Capital: 1 }, money: 50, loans: 1, flags: 5, hasProduced: false, ready: true, flag: 'anglica.svg' },
    { id: 'p2', name: 'Arazzaq', color: '#3b82f6', resources: { Food: 2, Energy: 5, Labor: 1, Ore: 2, Capital: 0 }, money: 30, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'arazzaq.svg' },
    { id: 'p3', name: 'Bharat', color: '#22c55e', resources: { Food: 1, Energy: 1, Labor: 5, Ore: 1, Capital: 0 }, money: 40, loans: 2, flags: 5, hasProduced: false, ready: true, flag: 'bharat.svg' },
    { id: 'p4', name: 'Bolshevica', color: '#eab308', resources: { Food: 3, Energy: 3, Labor: 3, Ore: 3, Capital: 3 }, money: 25, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'bolshevica.svg' },
    { id: 'p5', name: 'Federal Prov.', color: '#a855f7', resources: { Food: 0, Energy: 0, Labor: 0, Ore: 5, Capital: 5 }, money: 60, loans: 3, flags: 5, hasProduced: false, ready: true, flag: 'federal_provinces.svg' },
    { id: 'p6', name: 'Showa', color: '#f97316', resources: { Food: 2, Energy: 2, Labor: 2, Ore: 2, Capital: 2 }, money: 45, loans: 1, flags: 5, hasProduced: false, ready: true, flag: 'showa.svg' },
];

// Mock Board with some industries to generate operational costs
const MOCK_BOARD: Record<string, HexCell> = {
    '0,1': { q: 0, r: 1, occupant: { type: 'Industry', playerId: 'p1', tile: { type: 'Farm', orientation: 0, ownerId: 'p1', active: true, automated: false } as IndustryTile } },
    '0,2': { q: 0, r: 2, occupant: { type: 'Industry', playerId: 'p1', tile: { type: 'Generator', orientation: 0, ownerId: 'p1', active: true, automated: false } as IndustryTile } },
    '1,1': { q: 1, r: 1, occupant: { type: 'Industry', playerId: 'p2', tile: { type: 'Mine', orientation: 0, ownerId: 'p2', active: true, automated: false } as IndustryTile } },
};

// Mock Market
const MOCK_MARKETS: Record<CommodityType, MarketState> = {
    Food: { stock: 4, priceIndex: 4 },
    Energy: { stock: 3, priceIndex: 4 },
    Labor: { stock: 6, priceIndex: 4 },
    Ore: { stock: 2, priceIndex: 4 },
    Capital: { stock: 5, priceIndex: 4 }
};

const COMMODITIES: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

// Types for trade optimization
interface OptimalTrade {
    giving: { commodities: Partial<Record<CommodityType, number>>; money: number; loans: number };
    receiving: { commodities: Partial<Record<CommodityType, number>>; money: number; loans: number };
    benefit: number; // How much better this trade is vs using the market
}

// Calculate the optimal fair trade between current player and target player
// based on their deltas (what they want - what they have)
function calculateOptimalTrade(
    currentPlayerNeeds: Record<CommodityType, number>,
    currentPlayerResources: Record<CommodityType, number>,
    targetPlayerNeeds: Record<CommodityType, number>,
    targetPlayerResources: Record<CommodityType, number>,
    markets: Record<CommodityType, MarketState>
): OptimalTrade {
    const giving: Partial<Record<CommodityType, number>> = {};
    const receiving: Partial<Record<CommodityType, number>> = {};
    let givingValue = 0;
    let receivingValue = 0;

    for (const c of COMMODITIES) {
        const myDelta = currentPlayerNeeds[c] - currentPlayerResources[c]; // Positive = I'm buying, negative = I'm selling
        const theirDelta = targetPlayerNeeds[c] - targetPlayerResources[c]; // Positive = they're buying, negative = they're selling

        const priceIndex = Math.max(0, markets[c].stock - 1);
        const barterPrice = MARKET_PRICE_MAP[c][priceIndex].barter;

        // If I'm selling (myDelta < 0) and they're buying (theirDelta > 0)
        if (myDelta < 0 && theirDelta > 0) {
            // I can give them min of what I'm selling and what they want
            const amountToGive = Math.min(Math.abs(myDelta), theirDelta);
            if (amountToGive > 0) {
                giving[c] = amountToGive;
                givingValue += amountToGive * barterPrice;
            }
        }

        // If I'm buying (myDelta > 0) and they're selling (theirDelta < 0)
        if (myDelta > 0 && theirDelta < 0) {
            // I receive min of what I want and what they're selling
            const amountToReceive = Math.min(myDelta, Math.abs(theirDelta));
            if (amountToReceive > 0) {
                receiving[c] = amountToReceive;
                receivingValue += amountToReceive * barterPrice;
            }
        }
    }

    // Calculate money balance based on barter values
    // If I'm giving more value than receiving, I should receive money
    // If I'm receiving more value than giving, I should give money
    const valueDiff = givingValue - receivingValue;
    const givingMoney = valueDiff < 0 ? Math.round(Math.abs(valueDiff)) : 0;
    const receivingMoney = valueDiff > 0 ? Math.round(valueDiff) : 0;

    // Calculate benefit vs using the market
    // For each commodity I'm receiving via trade, I save the (buy - barter) spread
    // For each commodity I'm giving via trade, I gain the (barter - sell) spread
    let benefit = 0;
    for (const [c, amount] of Object.entries(receiving)) {
        if (!amount) continue;
        const market = markets[c as CommodityType];
        const priceIndex = Math.max(0, market.stock - 1);
        const step = MARKET_PRICE_MAP[c as CommodityType][priceIndex];
        // If I bought from market I'd pay 'buy', but via barter I pay 'barter' value
        benefit += amount * (step.buy - step.barter);
    }
    for (const [c, amount] of Object.entries(giving)) {
        if (!amount) continue;
        const market = markets[c as CommodityType];
        const priceIndex = Math.max(0, market.stock - 1);
        const step = MARKET_PRICE_MAP[c as CommodityType][priceIndex];
        // If I sold to market I'd get 'sell', but via barter I get 'barter' value
        benefit += amount * (step.barter - step.sell);
    }

    return {
        giving: { commodities: giving, money: givingMoney, loans: 0 },
        receiving: { commodities: receiving, money: receivingMoney, loans: 0 },
        benefit
    };
}

export const TradeSandbox: React.FC = () => {
    // State
    const [gameState, setGameState] = useState<GameState>({
        board: MOCK_BOARD,
        players: MOCK_PLAYERS,
        currentTurnPlayerIndex: 0, // Player 1
        firstPlayerIndex: 0,
        phase: 'Trade',
        round: 1,
        markets: MOCK_MARKETS,
        pendingTrade: null,
        tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        isLastRound: false,
        gameEnded: false,
        consecutivePasses: 0,
        initialFlagsPerPlayer: 5,
        initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        settings: { promissoryNoteInterestFees: true }, // Enable interest for demo
        logs: [] // Initialize with empty log array
    });

    // UI State
    const [showTradeModal, setShowTradeModal] = useState(false);

    // Trade Planning State
    const initialNeeds = useMemo(() => {
        const needs: Record<string, Record<CommodityType, number>> = {};
        MOCK_PLAYERS.forEach(p => {
            needs[p.id] = { ...p.resources };
        });
        return needs;
    }, []);

    const [playerNeeds, setPlayerNeeds] = useState<Record<string, Record<CommodityType, number>>>(initialNeeds);
    const [playersReady, setPlayersReady] = useState<Record<string, boolean>>({
        p1: false, p2: false, p3: false, p4: false, p5: false, p6: false
    });

    const currentPlayerId = 'p1';


    // Handlers
    const updateNeed = (playerId: string, commodity: CommodityType, value: number) => {
        const safeValue = Math.max(0, value);
        setPlayerNeeds(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [commodity]: safeValue
            }
        }));
    };

    const toggleReady = (playerId: string) => {
        setPlayersReady(prev => ({
            ...prev,
            [playerId]: !prev[playerId]
        }));
    };

    const handleAction = (action: string, payload?: any) => {
        console.log(`[Sandbox] Action Dispatched: ${action} `, payload);
        if (action === 'proposeTrade') {
            const { targetId } = payload;
            setGameState(prev => ({
                ...prev,
                pendingTrade: { proposerId: 'p1', targetId, giving: payload.giving, receiving: payload.receiving }
            }));
        }
    };

    const handleProposeTrade = (targetPlayerId: string, giving: any, receiving: any) => {
        handleAction('proposeTrade', { targetId: targetPlayerId, giving, receiving });
        setShowTradeModal(false);
    };

    const player = gameState.players[0];

    // Calculated Net Estimate (Trade Planning)
    const netEstimate = useMemo(() => {
        let total = 0;
        COMMODITIES.forEach(c => {
            const delta = playerNeeds[currentPlayerId][c] - player.resources[c];
            const price = MARKET_PRICE_MAP[c][gameState.markets[c].priceIndex].barter;
            total += delta * price;
        });
        return total;
    }, [playerNeeds, currentPlayerId, player.resources, gameState.markets]);

    // State for pre-filled trade modal
    const [prefilledTradeTarget, setPrefilledTradeTarget] = useState<{
        targetId: string;
        giving: OptimalTrade['giving'];
        receiving: OptimalTrade['receiving'];
    } | null>(null);

    // Calculate optimal trades with all other players
    const optimalTrades = useMemo(() => {
        const trades: Record<string, OptimalTrade> = {};
        const otherPlayers = gameState.players.filter(p => p.id !== currentPlayerId);

        for (const otherPlayer of otherPlayers) {
            // Only calculate if player is ready
            if (!playersReady[otherPlayer.id]) continue;

            trades[otherPlayer.id] = calculateOptimalTrade(
                playerNeeds[currentPlayerId],
                player.resources,
                playerNeeds[otherPlayer.id],
                otherPlayer.resources,
                gameState.markets
            );
        }

        return trades;
    }, [gameState.players, currentPlayerId, playerNeeds, player.resources, playersReady, gameState.markets]);

    // Find the best trade partner (highest benefit among ready players)
    const bestTradePartnerId = useMemo(() => {
        let bestId: string | null = null;
        let bestBenefit = 0;

        for (const [playerId, trade] of Object.entries(optimalTrades)) {
            // Only consider trades that have actual commodities to exchange (not just money)
            const hasGiving = Object.values(trade.giving.commodities).some(v => v && v > 0);
            const hasReceiving = Object.values(trade.receiving.commodities).some(v => v && v > 0);

            if ((hasGiving || hasReceiving) && trade.benefit > bestBenefit) {
                bestBenefit = trade.benefit;
                bestId = playerId;
            }
        }

        return bestId;
    }, [optimalTrades]);

    // Handler to open trade modal with pre-filled data
    const openTradeWithPlayer = (targetId: string) => {
        const trade = optimalTrades[targetId];
        if (trade) {
            setPrefilledTradeTarget({
                targetId,
                giving: trade.giving,
                receiving: trade.receiving
            });
        }
        setShowTradeModal(true);
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: 'white' }}>
            <h1 style={{ textAlign: 'center', margin: '10px 0', fontSize: '18px', color: '#888' }}>
                Trade Phase Sandbox (6 Players)
            </h1>

            <div style={{ display: 'flex', flex: 1, padding: '20px', gap: '40px', overflow: 'hidden', justifyContent: 'center' }}>

                {/* === MAIN COLUMN UI (230px) === */}
                <div style={{ width: '230px', display: 'flex', flexDirection: 'column', flexShrink: 0, gap: '15px' }}>

                    {/* 1. Promissory Notes (Compact Horizontal with Amounts) */}
                    <div style={{
                        background: '#1a1a1a', borderRadius: '8px', padding: '10px', border: '1px solid #444',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#aaa' }}>PROMISSORY NOTES</span>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white' }}>{player.loans} Active</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                style={{
                                    flex: 1, padding: '4px', fontSize: '10px',
                                    background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Take (+${20 - player.loans})
                            </button>
                            <button
                                style={{
                                    flex: 1, padding: '4px', fontSize: '10px',
                                    background: player.loans > 0 ? '#dc2626' : '#333',
                                    color: player.loans > 0 ? 'white' : '#666',
                                    border: 'none', borderRadius: '4px',
                                    cursor: player.loans > 0 ? 'pointer' : 'default',
                                    fontWeight: 'bold'
                                }}
                                disabled={player.loans === 0}
                            >
                                Pay (-$25)
                            </button>
                        </div>
                        {player.loans > 0 && (
                            <div style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center' }}>
                                -{player.loans * 3} VPs at end of game
                            </div>
                        )}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #333', width: '100%', margin: '0' }} />

                    {/* 3. Set Needs Control (Custom Inputs - Scaled Down) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '13px' }}>Desired Inventory</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            {COMMODITIES.map(c => {
                                const need = playerNeeds[currentPlayerId][c];
                                const delta = need - player.resources[c];
                                return (
                                    <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        {/* Custom Input Control */}
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#222', borderRadius: '3px', border: '1px solid #444' }}>
                                            <button
                                                onClick={() => updateNeed(currentPlayerId, c, need - 1)}
                                                style={{
                                                    width: '14px', height: '18px', background: 'transparent', border: 'none', color: '#888',
                                                    cursor: 'pointer', fontSize: '8px', padding: 0
                                                }}
                                            >
                                                ▼
                                            </button>
                                            <div style={{ width: '16px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: 'white' }}>
                                                {need}
                                            </div>
                                            <button
                                                onClick={() => updateNeed(currentPlayerId, c, need + 1)}
                                                style={{
                                                    width: '14px', height: '18px', background: 'transparent', border: 'none', color: '#888',
                                                    cursor: 'pointer', fontSize: '8px', padding: 0
                                                }}
                                            >
                                                ▲
                                            </button>
                                        </div>

                                        <div style={{ width: '22px', height: '22px' }}>
                                            <ResourceIcon type={c} size={22} />
                                        </div>

                                        {/* Delta display below icon */}
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            color: delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : '#555',
                                            minHeight: '12px'
                                        }}>
                                            {delta !== 0 ? Math.abs(delta) : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5px', marginTop: '5px' }}>
                            <span style={{ fontSize: '13px', color: '#888' }}>Net Est:</span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: netEstimate > 0 ? '#ef4444' : netEstimate < 0 ? '#22c55e' : 'white' }}>
                                {netEstimate > 0 ? `- $${Math.abs(netEstimate)} ` : ` + $${Math.abs(netEstimate)} `}
                            </span>
                        </div>

                        <button
                            onClick={() => toggleReady(currentPlayerId)}
                            style={{
                                marginTop: '8px',
                                padding: '6px 10px',
                                background: playersReady[currentPlayerId] ? '#22c55e' : '#222',
                                color: playersReady[currentPlayerId] ? 'black' : '#aaa',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11px',
                            }}
                        >
                            {playersReady[currentPlayerId] ? 'Ready' : 'Mark Ready'}
                        </button>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #333', width: '100%', margin: '0' }} />

                    {/* 4. Other Player Needs Display (Compact Row Layout) */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                        {/* Header Section */}
                        <div style={{ marginBottom: '5px' }}>
                            <h3 style={{ margin: '0 0 2px 0', fontSize: '14px', color: '#ccc' }}>Player Offers</h3>
                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Click a player to propose a trade</div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                (<span style={{ color: '#ef4444' }}>Buying</span> / <span style={{ color: '#22c55e' }}>Selling</span>)
                            </div>
                        </div>

                        {gameState.players.filter(p => p.id !== currentPlayerId).map(p => {
                            // Check ready status
                            const isReady = playersReady[p.id];
                            const isBestPartner = p.id === bestTradePartnerId;
                            const hasOptimalTrade = !!optimalTrades[p.id];

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => isReady && hasOptimalTrade && openTradeWithPlayer(p.id)}
                                    style={{
                                        background: isBestPartner ? '#1a2a1a' : '#222',
                                        borderRadius: '8px',
                                        padding: '10px',
                                        border: isBestPartner ? '2px solid #22c55e' : '1px solid #333',
                                        opacity: isReady ? 1 : 0.5,
                                        transition: 'all 0.3s',
                                        cursor: isReady && hasOptimalTrade ? 'pointer' : 'default',
                                    }}
                                >
                                    {/* Header: Name */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Flag Image */}
                                            <img
                                                src={`/flags/${p.flag}`}
                                                alt={p.name}
                                                style={{ width: '20px', height: 'auto', borderRadius: '2px', boxShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                                            />
                                            <span style={{ fontWeight: 'bold', color: p.color, fontSize: '14px' }}>
                                                {p.name} {!isReady && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>(Planning...)</span>}
                                            </span>
                                        </div>
                                        {isBestPartner && <span>✨</span>}
                                    </div>

                                    {/* Resources Row (Replacing the Table/Grid) */}
                                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#aaa', flexWrap: 'wrap' }}>
                                        {COMMODITIES.map(c => {
                                            const delta = playerNeeds[p.id][c] - p.resources[c];
                                            // Color logic: Red if buying (positive delta), Green if selling (negative delta)
                                            // Grey if 0? Or maybe hide 0s? Roster shows all. I'll show all but dim 0s.
                                            let color = '#555'; // Zero
                                            if (delta > 0) color = '#ef4444'; // Buying
                                            if (delta < 0) color = '#22c55e'; // Selling

                                            return (
                                                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: delta === 0 ? 0.3 : 1 }}>
                                                    <ResourceIcon type={c} size={14} />
                                                    <span style={{ color: color, fontWeight: delta !== 0 ? 'bold' : 'normal' }}>
                                                        {Math.abs(delta)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #333', width: '100%', margin: '0' }} />

                    {/* 5. Pass Button */}
                    <button
                        style={{ padding: '10px', background: '#333', color: '#aaa', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                        onClick={() => console.log('Passed')}
                    >
                        Pass Turn
                    </button>

                    {/* 6. Resource Requirements */}
                    <div style={{ background: '#222', padding: '10px', borderRadius: '5px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#fff', borderBottom: '1px solid #555', fontSize: '13px' }}>Resource Requirements</h4>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '5px' }}>
                            To run all your tiles (Inventory / Req.):
                        </div>



                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {/* Calculate Operating Costs Logic */}
                            {(() => {
                                const { players, board } = gameState;
                                const currentPlayer = players.find(p => p.id === currentPlayerId);
                                if (!currentPlayer) return null;


                                let foodNeeded = 0;
                                let energyNeeded = 0;
                                let oreNeeded = 0;

                                // Import needed helper if not available, or copy logic if simple.
                                // We need: identifyBloc, calculateBlocCosts.
                                // They are imported from '../utils/production' in Game.tsx? 
                                // In Sandbox imports: import { calculateGlobalProduction } from '../utils/production';
                                // We need identifyBloc and calculateBlocCosts too.
                                // Let's use calculateGlobalProduction results instead?
                                // calculateGlobalProduction returns { [playerId]: { costs: { Food, Energy... } } }

                                const globalProd = calculateGlobalProduction(board);
                                const myProd = globalProd[currentPlayerId];

                                if (myProd) {
                                    foodNeeded = myProd.costs.Food;
                                    energyNeeded = myProd.costs.Energy;
                                    oreNeeded = myProd.costs.Ore;
                                }

                                return (
                                    <>
                                        {foodNeeded > 0 && (
                                            <div style={{ color: currentPlayer.resources.Food >= foodNeeded ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <ResourceIcon type="Food" size={14} />
                                                <span>{currentPlayer.resources.Food} / {foodNeeded}</span>
                                            </div>
                                        )}
                                        {energyNeeded > 0 && (
                                            <div style={{ color: currentPlayer.resources.Energy >= energyNeeded ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <ResourceIcon type="Energy" size={14} />
                                                <span>{currentPlayer.resources.Energy} / {energyNeeded}</span>
                                            </div>
                                        )}
                                        {oreNeeded > 0 && (
                                            <div style={{ color: currentPlayer.resources.Ore >= oreNeeded ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <ResourceIcon type="Ore" size={14} />
                                                <span>{currentPlayer.resources.Ore} / {oreNeeded}</span>
                                            </div>
                                        )}
                                        {foodNeeded === 0 && energyNeeded === 0 && oreNeeded === 0 && (
                                            <span style={{ color: '#666', fontStyle: 'italic' }}>No resource costs</span>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                </div>


                {/* === DEBUG CONTROLS (Right) === */}
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #333', paddingLeft: '20px' }}>
                    <h2 style={{ fontSize: '12px', marginBottom: '10px', color: '#888', textTransform: 'uppercase' }}>Debug Controls</h2>
                    {gameState.players.filter(p => p.id !== currentPlayerId).map(p => (
                        <div key={p.id} style={{ marginBottom: '15px', background: '#1a1a1a', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: p.color, fontWeight: 'bold', fontSize: '12px' }}>{p.name}</span>
                                <input
                                    type="checkbox"
                                    checked={playersReady[p.id]}
                                    onChange={() => toggleReady(p.id)}
                                    title="Toggle Ready"
                                />
                            </div>
                            {COMMODITIES.map(c => {
                                const need = playerNeeds[p.id][c];
                                const delta = need - p.resources[c];
                                return (
                                    <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px', alignItems: 'center' }}>
                                        <span style={{ color: '#888' }}>{c[0]}</span>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <input
                                                type="number"
                                                value={need}
                                                onChange={(e) => updateNeed(p.id, c, parseInt(e.target.value) || 0)}
                                                style={{ width: '30px', background: '#333', border: 'none', color: 'white', textAlign: 'center', fontSize: '11px', padding: '2px' }}
                                            />
                                            <span style={{ width: '20px', textAlign: 'right', color: delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : '#444' }}>
                                                {delta > 0 ? `+ ${delta} ` : delta < 0 ? delta : '-'}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>

                {/* Col 3: Reference Roster */}
                <div style={{ width: '250px', padding: '10px', background: '#111', borderLeft: '1px solid #333', overflowY: 'auto' }}>
                    <PlayerRoster
                        players={gameState.players}
                        currentPlayerId={currentPlayerId}
                        firstPlayerIndex={0}
                    />
                </div>

            </div>
            {/* Trade Modal */}
            {showTradeModal && (
                <TradeModal
                    currentPlayer={player}
                    allPlayers={gameState.players}
                    markets={gameState.markets}
                    onPropose={handleProposeTrade}
                    onCancel={() => {
                        setShowTradeModal(false);
                        setPrefilledTradeTarget(null);
                    }}
                    initialSelectedPlayerId={prefilledTradeTarget?.targetId}
                    initialGiving={prefilledTradeTarget?.giving}
                    initialReceiving={prefilledTradeTarget?.receiving}
                />
            )}
        </div>
    );
};
