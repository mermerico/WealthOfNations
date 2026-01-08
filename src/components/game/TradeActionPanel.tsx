import React, { useState, useMemo } from 'react';
import type { GameState, Player, CommodityType, MarketState } from '../../types/gameState';
import { ResourceIcon } from '../ui/ResourceIcon';
import { MARKET_PRICE_MAP } from '../../utils/marketPrices';

interface TradeActionPanelProps {
    gameState: GameState;
    player: Player;
    mode: 'local' | 'remote';
    onAction: (action: string, payload?: any) => void;
    onOpenTradeWithPlayer: (targetId: string, giving: TradeOffer, receiving: TradeOffer) => void;
    onSelectedPlayerChange?: (playerId: string) => void;
}

interface TradeOffer {
    commodities: Partial<Record<CommodityType, number>>;
    money: number;
    loans: number;
}

interface OptimalTrade {
    giving: TradeOffer;
    receiving: TradeOffer;
    benefit: number;
}

const COMMODITIES: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

// Calculate the optimal fair trade between current player and target player
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
        const myDelta = currentPlayerNeeds[c] - currentPlayerResources[c];
        const theirDelta = targetPlayerNeeds[c] - targetPlayerResources[c];

        const priceIndex = Math.max(0, markets[c].stock - 1);
        const barterPrice = MARKET_PRICE_MAP[c][priceIndex].barter;

        if (myDelta < 0 && theirDelta > 0) {
            const amountToGive = Math.min(Math.abs(myDelta), theirDelta);
            if (amountToGive > 0) {
                giving[c] = amountToGive;
                givingValue += amountToGive * barterPrice;
            }
        }

        if (myDelta > 0 && theirDelta < 0) {
            const amountToReceive = Math.min(myDelta, Math.abs(theirDelta));
            if (amountToReceive > 0) {
                receiving[c] = amountToReceive;
                receivingValue += amountToReceive * barterPrice;
            }
        }
    }

    const valueDiff = givingValue - receivingValue;
    const givingMoney = valueDiff < 0 ? Math.round(Math.abs(valueDiff)) : 0;
    const receivingMoney = valueDiff > 0 ? Math.round(valueDiff) : 0;

    let benefit = 0;
    for (const [c, amount] of Object.entries(receiving)) {
        if (!amount) continue;
        const market = markets[c as CommodityType];
        const priceIndex = Math.max(0, market.stock - 1);
        const step = MARKET_PRICE_MAP[c as CommodityType][priceIndex];
        benefit += amount * (step.buy - step.barter);
    }
    for (const [c, amount] of Object.entries(giving)) {
        if (!amount) continue;
        const market = markets[c as CommodityType];
        const priceIndex = Math.max(0, market.stock - 1);
        const step = MARKET_PRICE_MAP[c as CommodityType][priceIndex];
        benefit += amount * (step.barter - step.sell);
    }

    return {
        giving: { commodities: giving, money: givingMoney, loans: 0 },
        receiving: { commodities: receiving, money: receivingMoney, loans: 0 },
        benefit
    };
}

export const TradeActionPanel: React.FC<TradeActionPanelProps> = ({ gameState, player, mode, onAction, onOpenTradeWithPlayer, onSelectedPlayerChange }) => {
    // For local hotseat, allow selecting which player's needs to set
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>(player.id);

    // The player whose needs we're currently editing
    const selectedPlayer = useMemo(() => {
        if (mode === 'local') {
            return gameState.players.find(p => p.id === selectedPlayerId) || player;
        }
        return player;
    }, [mode, gameState.players, selectedPlayerId, player]);

    // Desired Inventory state - keyed by player id for local hotseat
    // In remote mode, we still use local state but sync via setTradeIntent action
    const [allPlayerNeeds, setAllPlayerNeeds] = useState<Record<string, Record<CommodityType, number>>>(() => {
        const needs: Record<string, Record<CommodityType, number>> = {};
        gameState.players.forEach(p => {
            // Initialize from gameState.tradeIntents if available
            const intent = gameState.tradeIntents?.[p.id];
            needs[p.id] = intent?.desiredInventory || { ...p.resources };
        });
        return needs;
    });

    const playerNeeds = allPlayerNeeds[selectedPlayer.id] || { ...selectedPlayer.resources };

    const [isReady, setIsReady] = useState(() => {
        // Initialize from gameState.tradeIntents if in remote mode
        if (mode === 'remote' && gameState.tradeIntents?.[player.id]) {
            return gameState.tradeIntents[player.id].ready;
        }
        return false;
    });

    // Handle player selection change for local mode
    const handlePlayerSelect = (playerId: string) => {
        setSelectedPlayerId(playerId);
        if (onSelectedPlayerChange) {
            onSelectedPlayerChange(playerId);
        }
    };

    // Track other players' ready state
    const otherPlayersReady = useMemo(() => {
        const ready: Record<string, boolean> = {};
        gameState.players.forEach(p => {
            if (p.id !== player.id) {
                if (mode === 'remote') {
                    // In remote mode, use tradeIntents from server
                    ready[p.id] = gameState.tradeIntents?.[p.id]?.ready ?? false;
                } else {
                    // In local mode, all players are implicitly ready
                    ready[p.id] = true;
                }
            }
        });
        return ready;
    }, [gameState.players, player.id, mode, gameState.tradeIntents]);

    // Calculate net estimate using barter prices
    const netEstimate = useMemo(() => {
        let total = 0;
        COMMODITIES.forEach(c => {
            const delta = playerNeeds[c] - selectedPlayer.resources[c];
            const priceIndex = Math.max(0, gameState.markets[c].stock - 1);
            const price = MARKET_PRICE_MAP[c][priceIndex].barter;
            total += delta * price;
        });
        return total;
    }, [playerNeeds, selectedPlayer.resources, gameState.markets]);

    // Calculate optimal trades with all other players
    // This is from the current turn player's perspective (not the dropdown selection)
    const optimalTrades = useMemo(() => {
        const trades: Record<string, OptimalTrade> = {};

        // Get current turn player's needs
        const currentPlayerNeeds = mode === 'remote'
            ? (gameState.tradeIntents?.[player.id]?.desiredInventory || allPlayerNeeds[player.id] || { ...player.resources })
            : (allPlayerNeeds[player.id] || { ...player.resources });

        for (const otherPlayer of gameState.players) {
            if (otherPlayer.id === player.id) continue;
            if (!otherPlayersReady[otherPlayer.id]) continue;

            // Get other player's needs - in remote mode, from tradeIntents; in local mode, from local state
            const otherNeeds = mode === 'remote'
                ? (gameState.tradeIntents?.[otherPlayer.id]?.desiredInventory || { ...otherPlayer.resources })
                : (allPlayerNeeds[otherPlayer.id] || { ...otherPlayer.resources });

            trades[otherPlayer.id] = calculateOptimalTrade(
                currentPlayerNeeds,
                player.resources,
                otherNeeds,
                otherPlayer.resources,
                gameState.markets
            );
        }

        return trades;
    }, [gameState.players, player.id, player.resources, otherPlayersReady, gameState.markets, mode, allPlayerNeeds, gameState.tradeIntents]);

    // Find the best trade partner
    const bestTradePartnerId = useMemo(() => {
        let bestId: string | null = null;
        let bestBenefit = 0;

        for (const [playerId, trade] of Object.entries(optimalTrades)) {
            const hasGiving = Object.values(trade.giving.commodities).some(v => v && v > 0);
            const hasReceiving = Object.values(trade.receiving.commodities).some(v => v && v > 0);

            if ((hasGiving || hasReceiving) && trade.benefit > bestBenefit) {
                bestBenefit = trade.benefit;
                bestId = playerId;
            }
        }

        return bestId;
    }, [optimalTrades]);

    const updateNeed = (commodity: CommodityType, value: number) => {
        const newValue = Math.max(0, value);
        const newNeeds = {
            ...allPlayerNeeds,
            [selectedPlayer.id]: {
                ...allPlayerNeeds[selectedPlayer.id],
                [commodity]: newValue
            }
        };
        setAllPlayerNeeds(newNeeds);

        // In remote mode, also send to server
        if (mode === 'remote') {
            onAction('setTradeIntent', {
                playerId: player.id,
                desiredInventory: newNeeds[player.id],
                ready: isReady
            });
        }
    };

    const handlePlayerClick = (targetId: string) => {
        const trade = optimalTrades[targetId];
        if (trade) {
            onOpenTradeWithPlayer(targetId, trade.giving, trade.receiving);
        }
    };

    // If waiting for trade response
    if (gameState.pendingTrade && gameState.pendingTrade.proposerId === player.id) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{
                    padding: '20px',
                    background: '#333',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#aaa',
                    border: '1px solid #555',
                    marginTop: 'auto',
                    marginBottom: 'auto'
                }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                    <div>Waiting for {gameState.players.find(p => p.id === gameState.pendingTrade!.targetId)?.name || 'target'} to respond...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {/* Promissory Notes Section */}
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
                        onClick={() => onAction('takeLoan')}
                        disabled={20 - player.loans <= 0}
                        style={{
                            flex: 1, padding: '4px', fontSize: '10px',
                            background: 20 - player.loans > 0 ? '#059669' : '#333',
                            color: 20 - player.loans > 0 ? 'white' : '#666',
                            border: 'none', borderRadius: '4px', cursor: 20 - player.loans > 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                        }}
                    >
                        Take (+${20 - player.loans})
                    </button>
                    <button
                        onClick={() => onAction('repayLoan')}
                        disabled={player.loans === 0 || player.money < 25}
                        style={{
                            flex: 1, padding: '4px', fontSize: '10px',
                            background: player.loans > 0 && player.money >= 25 ? '#dc2626' : '#333',
                            color: player.loans > 0 && player.money >= 25 ? 'white' : '#666',
                            border: 'none', borderRadius: '4px',
                            cursor: player.loans > 0 && player.money >= 25 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                        }}
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

            {/* Player Selector (Local Mode Only) */}
            {mode === 'local' && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: '#1a1a1a', padding: '8px', borderRadius: '4px', border: '1px solid #444'
                }}>
                    <span style={{ fontSize: '11px', color: '#aaa' }}>Planning for:</span>
                    <select
                        value={selectedPlayerId}
                        onChange={(e) => handlePlayerSelect(e.target.value)}
                        style={{
                            flex: 1, padding: '4px 8px', fontSize: '12px',
                            background: '#222', color: 'white', border: '1px solid #444',
                            borderRadius: '4px', cursor: 'pointer'
                        }}
                    >
                        {gameState.players.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Desired Inventory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '13px' }}>Desired Inventory</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    {COMMODITIES.map(c => {
                        const need = playerNeeds[c];
                        const delta = need - selectedPlayer.resources[c];
                        return (
                            <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#222', borderRadius: '3px', border: '1px solid #444' }}>
                                    <button
                                        data-testid={`inventory-minus-${c}`}
                                        onClick={() => updateNeed(c, need - 1)}
                                        style={{
                                            width: '14px', height: '18px', background: 'transparent', border: 'none', color: '#888',
                                            cursor: 'pointer', fontSize: '8px', padding: 0
                                        }}
                                    >
                                        ▼
                                    </button>
                                    <div data-testid={`inventory-count-${c}`} style={{ width: '16px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: 'white' }}>
                                        {need}
                                    </div>
                                    <button
                                        data-testid={`inventory-plus-${c}`}
                                        onClick={() => updateNeed(c, need + 1)}
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

                {/* Mark Ready button - only show in remote mode */}
                {mode === 'remote' && (
                    <button
                        data-testid="trade-ready-button"
                        onClick={() => {
                            const newReady = !isReady;
                            // Optimistic update RESTORED
                            setIsReady(newReady);

                            onAction('setTradeIntent', {
                                playerId: player.id,
                                desiredInventory: allPlayerNeeds[player.id] || player.resources,
                                ready: newReady
                            });
                        }}
                        style={{
                            marginTop: '8px',
                            padding: '6px 10px',
                            background: isReady ? '#22c55e' : '#222',
                            color: isReady ? 'black' : '#aaa',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px',
                        }}
                    >
                        {isReady ? 'Ready' : 'Mark Ready'}
                    </button>
                )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #333', width: '100%', margin: '0' }} />

            {/* Player Offers */}
            <div data-testid="player-offers-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '5px' }}>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '14px', color: '#ccc' }}>Player Offers</h3>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Click a player to propose a trade</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        (<span style={{ color: '#ef4444' }}>Buying</span> / <span style={{ color: '#22c55e' }}>Selling</span>)
                    </div>
                </div>

                {gameState.players.filter(p => p.id !== player.id).map(p => {
                    const pIsReady = otherPlayersReady[p.id];
                    const isBestPartner = p.id === bestTradePartnerId;

                    return (
                        <div
                            key={p.id}
                            data-testid={`player-offer-button-${p.name}`}
                            onClick={() => handlePlayerClick(p.id)}
                            style={{
                                background: isBestPartner ? '#1a2a1a' : '#222',
                                borderRadius: '8px',
                                padding: '10px',
                                border: isBestPartner ? '2px solid #22c55e' : '1px solid #333',
                                opacity: pIsReady ? 1 : 0.7,
                                transition: 'all 0.3s',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img
                                        src={`/flags/${p.flag}`}
                                        alt={p.name}
                                        style={{ width: '20px', height: 'auto', borderRadius: '2px', boxShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                                    />
                                    <span style={{ fontWeight: 'bold', color: p.color, fontSize: '14px' }}>
                                        {p.name} {!pIsReady && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>(Planning...)</span>}
                                    </span>
                                </div>
                                {isBestPartner && <span>✨</span>}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#aaa', flexWrap: 'wrap' }}>
                                {COMMODITIES.map(c => {
                                    // In remote mode, use tradeIntents; in local mode, use local state
                                    const theirNeeds = mode === 'remote'
                                        ? (gameState.tradeIntents?.[p.id]?.desiredInventory?.[c] ?? p.resources[c])
                                        : (allPlayerNeeds[p.id]?.[c] ?? p.resources[c]);
                                    const delta = theirNeeds - p.resources[c];
                                    // Positive delta = they need to buy, Negative delta = they can sell
                                    return (
                                        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: delta === 0 ? 0.3 : 1 }}>
                                            <ResourceIcon type={c} size={14} />
                                            {delta !== 0 ? (
                                                <span style={{
                                                    color: delta > 0 ? '#ef4444' : '#22c55e',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {Math.abs(delta)}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#555' }}>0</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #333', width: '100%', margin: '0' }} />

            {/* Pass Button */}
            <button
                data-testid="trade-pass-button"
                onClick={() => onAction('pass')}
                style={{
                    padding: '12px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: 'auto'
                }}
            >
                ✓ Pass
            </button>
        </div >
    );
};
