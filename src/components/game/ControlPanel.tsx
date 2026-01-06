import React from 'react';
import type { GameState } from '../../types/gameState';

interface ControlPanelProps {
    gameState: GameState;
    onAction: (action: string, payload?: any) => void;
    canAct?: boolean;
    lobbyCode?: string;
    onLeave?: () => void;
    onSave?: () => void;
    isHost?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ gameState, canAct = true, lobbyCode, onLeave, onSave, isHost }) => {
    // During setup, show the current drafter; otherwise show the current turn player
    const displayPlayerIndex = gameState.phase === 'Setup' && gameState.setupPhase?.currentDrafterIndex !== undefined
        ? gameState.setupPhase.currentDrafterIndex
        : gameState.currentTurnPlayerIndex;
    const currentPlayer = gameState.players[displayPlayerIndex];
    if (!currentPlayer) return null;

    return (
        <div style={{
            background: '#222',
            padding: '10px',
            borderBottom: '1px solid #444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'white'
        }}>
            {/* Status Info */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>PHASE</span>
                    <span style={{ fontWeight: 'bold', color: '#facc15' }}>{gameState.phase.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>ROUND</span>
                    <span style={{ fontWeight: 'bold' }}>{gameState.round}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>PLAYER</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {gameState.phase === 'Produce' ? (
                            <span style={{ fontWeight: 'bold', color: '#ccc', fontStyle: 'italic' }}>Simultaneous Plan</span>
                        ) : (
                            <>
                                <img
                                    src={`/flags/${currentPlayer.flag}`}
                                    alt={currentPlayer.name}
                                    style={{ width: '20px', height: '10px', objectFit: 'cover' }}
                                />
                                <span style={{ fontWeight: 'bold', color: currentPlayer.color }}>{currentPlayer.name}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Lobby Code - Centered */}
            {lobbyCode && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1
                }}>
                    <div style={{
                        padding: '6px 16px',
                        borderRadius: '8px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                    }}>
                        <span style={{ fontSize: '9px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Lobby</span>
                        <span style={{ fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.3em', color: '#c4b5fd' }}>{lobbyCode}</span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {gameState.phase === 'Setup' && (
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                        Setup in Progress...
                    </span>
                )}

                {!canAct && (
                    <span style={{ color: '#f87171', fontWeight: 'bold' }}>
                        Waiting for your turn
                    </span>
                )}

                {onLeave && (
                    <button
                        onClick={onLeave}
                        style={{
                            background: '#dc2626',
                            borderColor: '#991b1b',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        Leave Game
                    </button>
                )}

                {onSave && isHost && !gameState.gameEnded && (
                    <button
                        onClick={onSave}
                        style={{
                            background: '#6366f1',
                            borderColor: '#4f46e5',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        💾 Save Game
                    </button>
                )}
            </div>
        </div>
    );
};
