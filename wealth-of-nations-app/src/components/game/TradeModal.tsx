import { useState } from 'react';
import type { CommodityType, Player } from '../../types/gameState';
import { ResourceIcon } from '../ui/ResourceIcon';

interface TradeModalProps {
    currentPlayer: Player;
    allPlayers: Player[];
    onPropose: (targetPlayerId: string, giving: TradeOffer, receiving: TradeOffer) => void;
    onCancel: () => void;
}

interface AcceptTradeModalProps {
    proposingPlayer: Player;
    receivingPlayer: Player;
    giving: TradeOffer;
    receiving: TradeOffer;
    onAccept: () => void;
    onReject: () => void;
}

export interface TradeOffer {
    commodities: Partial<Record<CommodityType, number>>;
    money: number;
    loans: number;
}

export function TradeModal({ currentPlayer, allPlayers, onPropose, onCancel }: TradeModalProps) {
    const [giving, setGiving] = useState<TradeOffer>({ commodities: {}, money: 0, loans: 0 });
    const [receiving, setReceiving] = useState<TradeOffer>({ commodities: {}, money: 0, loans: 0 });
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

    const commodities: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

    const updateGiving = (commodity: CommodityType, delta: number) => {
        setGiving(prev => ({
            ...prev,
            commodities: {
                ...prev.commodities,
                [commodity]: Math.max(0, Math.min((prev.commodities[commodity] || 0) + delta, currentPlayer.resources[commodity]))
            }
        }));
    };

    const updateReceiving = (commodity: CommodityType, delta: number) => {
        const targetPlayer = allPlayers.find(p => p.id === selectedPlayerId);
        if (!targetPlayer) return;

        setReceiving(prev => ({
            ...prev,
            commodities: {
                ...prev.commodities,
                [commodity]: Math.max(0, Math.min((prev.commodities[commodity] || 0) + delta, targetPlayer.resources[commodity]))
            }
        }));
    };

    const updateGivingMoney = (delta: number) => {
        setGiving(prev => ({
            ...prev,
            money: Math.max(0, Math.min(prev.money + delta, currentPlayer.money))
        }));
    };

    const updateReceivingMoney = (delta: number) => {
        const targetPlayer = allPlayers.find(p => p.id === selectedPlayerId);
        if (!targetPlayer) return;

        setReceiving(prev => ({
            ...prev,
            money: Math.max(0, Math.min(prev.money + delta, targetPlayer.money))
        }));
    };

    const updateGivingLoans = (delta: number) => {
        setGiving(prev => ({
            ...prev,
            loans: Math.max(0, Math.min(prev.loans + delta, currentPlayer.loans))
        }));
    };

    const updateReceivingLoans = (delta: number) => {
        const targetPlayer = allPlayers.find(p => p.id === selectedPlayerId);
        if (!targetPlayer) return;

        setReceiving(prev => ({
            ...prev,
            loans: Math.max(0, Math.min(prev.loans + delta, targetPlayer.loans))
        }));
    };

    const canPropose = selectedPlayerId && (
        Object.values(giving.commodities).some(v => v > 0) ||
        giving.money > 0 ||
        giving.loans > 0 ||
        Object.values(receiving.commodities).some(v => v > 0) ||
        receiving.money > 0 ||
        receiving.loans > 0
    );

    const otherPlayers = allPlayers.filter(p => p.id !== currentPlayer.id);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: '#1a1a1a',
                border: '2px solid #444',
                borderRadius: '8px',
                padding: '20px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
            }}>
                <h2 style={{ color: 'white', marginTop: 0 }}>Propose Trade</h2>

                {/* Player Selection */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Trade with:</label>
                    <select
                        value={selectedPlayerId}
                        onChange={(e) => setSelectedPlayerId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: '#222',
                            color: 'white',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}
                    >
                        <option value="">Select a player...</option>
                        {otherPlayers.map(player => (
                            <option key={player.id} value={player.id}>{player.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Giving Section */}
                    <div>
                        <h3 style={{ color: '#ef4444', marginTop: 0 }}>You Give</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {commodities.map(commodity => (
                                <div key={commodity} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: '#222',
                                    padding: '8px',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ResourceIcon type={commodity} size={16} />
                                        <span style={{ color: 'white', fontSize: '12px' }}>{commodity}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            onClick={() => updateGiving(commodity, -1)}
                                            disabled={!giving.commodities[commodity]}
                                            style={{ padding: '2px 8px', fontSize: '12px' }}
                                        >
                                            -
                                        </button>
                                        <span style={{ color: 'white', minWidth: '20px', textAlign: 'center' }}>
                                            {giving.commodities[commodity] || 0}
                                        </span>
                                        <button
                                            onClick={() => updateGiving(commodity, 1)}
                                            disabled={(giving.commodities[commodity] || 0) >= currentPlayer.resources[commodity]}
                                            style={{ padding: '2px 8px', fontSize: '12px' }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {/* Money */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#222',
                                padding: '8px',
                                borderRadius: '4px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>💰</span>
                                    <span style={{ color: 'white', fontSize: '12px' }}>Money</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={() => updateGivingMoney(-10)}
                                        disabled={giving.money < 10}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        -10
                                    </button>
                                    <span style={{ color: 'white', minWidth: '40px', textAlign: 'center' }}>
                                        ${giving.money}
                                    </span>
                                    <button
                                        onClick={() => updateGivingMoney(10)}
                                        disabled={giving.money + 10 > currentPlayer.money}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        +10
                                    </button>
                                </div>
                            </div>
                            {/* Promissory Notes */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#222',
                                padding: '8px',
                                borderRadius: '4px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>📜</span>
                                    <span style={{ color: 'white', fontSize: '12px' }}>Loans</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={() => updateGivingLoans(-1)}
                                        disabled={giving.loans < 1}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        -
                                    </button>
                                    <span style={{ color: 'white', minWidth: '20px', textAlign: 'center' }}>
                                        {giving.loans}
                                    </span>
                                    <button
                                        onClick={() => updateGivingLoans(1)}
                                        disabled={giving.loans >= currentPlayer.loans}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Receiving Section */}
                    <div>
                        <h3 style={{ color: '#10b981', marginTop: 0 }}>You Receive</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {commodities.map(commodity => {
                                const targetPlayer = allPlayers.find(p => p.id === selectedPlayerId);
                                const maxAvailable = targetPlayer?.resources[commodity] || 0;

                                return (
                                    <div key={commodity} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: '#222',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        opacity: selectedPlayerId ? 1 : 0.5
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ResourceIcon type={commodity} size={16} />
                                            <span style={{ color: 'white', fontSize: '12px' }}>{commodity}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => updateReceiving(commodity, -1)}
                                                disabled={!selectedPlayerId || !receiving.commodities[commodity]}
                                                style={{ padding: '2px 8px', fontSize: '12px' }}
                                            >
                                                -
                                            </button>
                                            <span style={{ color: 'white', minWidth: '20px', textAlign: 'center' }}>
                                                {receiving.commodities[commodity] || 0}
                                            </span>
                                            <button
                                                onClick={() => updateReceiving(commodity, 1)}
                                                disabled={!selectedPlayerId || (receiving.commodities[commodity] || 0) >= maxAvailable}
                                                style={{ padding: '2px 8px', fontSize: '12px' }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Money */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#222',
                                padding: '8px',
                                borderRadius: '4px',
                                opacity: selectedPlayerId ? 1 : 0.5
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>💰</span>
                                    <span style={{ color: 'white', fontSize: '12px' }}>Money</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={() => updateReceivingMoney(-10)}
                                        disabled={!selectedPlayerId || receiving.money < 10}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        -10
                                    </button>
                                    <span style={{ color: 'white', minWidth: '40px', textAlign: 'center' }}>
                                        ${receiving.money}
                                    </span>
                                    <button
                                        onClick={() => updateReceivingMoney(10)}
                                        disabled={!selectedPlayerId || receiving.money + 10 > (allPlayers.find(p => p.id === selectedPlayerId)?.money || 0)}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        +10
                                    </button>
                                </div>
                            </div>
                            {/* Promissory Notes */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#222',
                                padding: '8px',
                                borderRadius: '4px',
                                opacity: selectedPlayerId ? 1 : 0.5
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>📜</span>
                                    <span style={{ color: 'white', fontSize: '12px' }}>Loans</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={() => updateReceivingLoans(-1)}
                                        disabled={!selectedPlayerId || receiving.loans < 1}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        -
                                    </button>
                                    <span style={{ color: 'white', minWidth: '20px', textAlign: 'center' }}>
                                        {receiving.loans}
                                    </span>
                                    <button
                                        onClick={() => updateReceivingLoans(1)}
                                        disabled={!selectedPlayerId || receiving.loans >= (allPlayers.find(p => p.id === selectedPlayerId)?.loans || 0)}
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onPropose(selectedPlayerId, giving, receiving)}
                        disabled={!canPropose}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: canPropose ? '#10b981' : '#444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: canPropose ? 'pointer' : 'not-allowed',
                            opacity: canPropose ? 1 : 0.5
                        }}
                    >
                        Propose Trade
                    </button>
                </div>
            </div>
        </div>
    );
}

export function AcceptTradeModal({ proposingPlayer, giving, receiving, onAccept, onReject }: AcceptTradeModalProps) {
    const commodities: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: '#1a1a1a',
                border: '2px solid #444',
                borderRadius: '8px',
                padding: '20px',
                maxWidth: '500px',
                width: '90%'
            }}>
                <h2 style={{ color: 'white', marginTop: 0 }}>Trade Proposal</h2>
                <p style={{ color: '#aaa', fontSize: '14px' }}>
                    <strong style={{ color: proposingPlayer.color }}>{proposingPlayer.name}</strong> wants to trade with you:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    {/* They Give (You Receive) */}
                    <div>
                        <h3 style={{ color: '#10b981', fontSize: '14px', marginTop: 0 }}>You Receive</h3>
                        <div style={{ background: '#222', padding: '12px', borderRadius: '4px' }}>
                            {commodities.map(commodity => {
                                const amount = giving.commodities[commodity];
                                if (!amount) return null;
                                return (
                                    <div key={commodity} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <ResourceIcon type={commodity} size={16} />
                                        <span style={{ color: 'white', fontSize: '14px' }}>{amount} {commodity}</span>
                                    </div>
                                );
                            })}
                            {giving.money > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '16px' }}>💰</span>
                                    <span style={{ color: 'white', fontSize: '14px' }}>${giving.money}</span>
                                </div>
                            )}
                            {giving.loans > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '16px' }}>📜</span>
                                    <span style={{ color: 'white', fontSize: '14px' }}>{giving.loans} Loan{giving.loans > 1 ? 's' : ''}</span>
                                </div>
                            )}
                            {Object.values(giving.commodities).every(v => !v) && !giving.money && !giving.loans && (
                                <span style={{ color: '#666', fontStyle: 'italic' }}>Nothing</span>
                            )}
                        </div>
                    </div>

                    {/* You Give (They Receive) */}
                    <div>
                        <h3 style={{ color: '#ef4444', fontSize: '14px', marginTop: 0 }}>You Give</h3>
                        <div style={{ background: '#222', padding: '12px', borderRadius: '4px' }}>
                            {commodities.map(commodity => {
                                const amount = receiving.commodities[commodity];
                                if (!amount) return null;
                                return (
                                    <div key={commodity} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <ResourceIcon type={commodity} size={16} />
                                        <span style={{ color: 'white', fontSize: '14px' }}>{amount} {commodity}</span>
                                    </div>
                                );
                            })}
                            {receiving.money > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '16px' }}>💰</span>
                                    <span style={{ color: 'white', fontSize: '14px' }}>${receiving.money}</span>
                                </div>
                            )}
                            {receiving.loans > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '16px' }}>📜</span>
                                    <span style={{ color: 'white', fontSize: '14px' }}>{receiving.loans} Loan{receiving.loans > 1 ? 's' : ''}</span>
                                </div>
                            )}
                            {Object.values(receiving.commodities).every(v => !v) && !receiving.money && !receiving.loans && (
                                <span style={{ color: '#666', fontStyle: 'italic' }}>Nothing</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        onClick={onReject}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Reject
                    </button>
                    <button
                        onClick={onAccept}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
