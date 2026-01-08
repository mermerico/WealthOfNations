import React from 'react';
import type { Player } from '../../types/gameState';
import { ResourceIcon } from '../ui/ResourceIcon';
import './PlayerRoster.css';

interface PlayerRosterProps {
    players: Player[];
    currentPlayerId: string;
    firstPlayerIndex: number;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({ players, currentPlayerId, firstPlayerIndex }) => {
    // Debug logging
    console.log('[PlayerRoster] currentPlayerId:', currentPlayerId);
    console.log('[PlayerRoster] firstPlayerIndex:', firstPlayerIndex);
    console.log('[PlayerRoster] players:', players.map(p => ({ id: p.id, hasPassed: p.hasPassed })));

    // Always show players in order 1, 2, 3 (not rotated by turn order)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Players</h3>
            {players.map((player, index) => {
                const isCurrent = player.id === currentPlayerId;
                const isFirstPlayer = index === firstPlayerIndex;

                console.log(`[PlayerRoster] Player ${index} (${player.id}): isFirstPlayer=${isFirstPlayer}, firstPlayerIndex=${firstPlayerIndex}`);

                return (
                    <div
                        key={player.id}
                        data-testid={`player-roster-card-${player.name}`}
                        style={{
                            background: '#222',
                            border: `2px solid ${isCurrent ? '#22c55e' : 'transparent'}`,
                            borderRadius: '8px',
                            padding: '10px',
                            opacity: player.ready ? 1 : 0.5,
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                    src={`/flags/${player.flag}`}
                                    alt={player.name}
                                    style={{ width: '24px', height: '12px', objectFit: 'cover' }}
                                />
                                <span style={{ color: player.color, fontWeight: 'bold' }}>{player.name}</span>
                                {isFirstPlayer && (
                                    <span style={{ fontSize: '10px', background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                        1ST
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {isCurrent && (
                                    <span
                                        data-testid={`turn-badge-${player.name}`}
                                        style={{ fontSize: '10px', background: '#22c55e', color: '#000', padding: '2px 6px', borderRadius: '4px' }}
                                    >
                                        TURN
                                    </span>
                                )}
                                {player.hasPassed && (
                                    <span style={{ fontSize: '10px', background: '#6b7280', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                                        PASS
                                    </span>
                                )}
                                {player.hasProduced && (
                                    <span className="player-badge produced-badge">
                                        DONE
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Vital Stats */}
                        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#ccc', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ResourceIcon type="Money" size={12} />
                                <span>${player.money}</span>
                            </div>
                            <div>🚩 {player.flags}</div>
                            <div>📉 {player.loans}</div>
                        </div>

                        {/* Resources - Single Line */}
                        <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#aaa', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <ResourceIcon type="Food" size={12} />
                                <span>{player.resources.Food}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <ResourceIcon type="Energy" size={12} />
                                <span>{player.resources.Energy}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <ResourceIcon type="Labor" size={12} />
                                <span>{player.resources.Labor}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <ResourceIcon type="Ore" size={12} />
                                <span>{player.resources.Ore}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <ResourceIcon type="Capital" size={12} />
                                <span>{player.resources.Capital}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
