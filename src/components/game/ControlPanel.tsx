import React from 'react';
import type { GameState } from '../../types/gameState';

interface ControlPanelProps {
    gameState: GameState;
    onAction: (action: string, payload?: any) => void;
    canAct?: boolean;
    lobbyCode?: string;
    onLeave?: () => void;
    onSave?: () => void;
    onOpenPlayerAid?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ gameState, lobbyCode, onLeave, onSave, onOpenPlayerAid }) => {
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
                    <span data-testid="phase-display" style={{ fontWeight: 'bold', color: '#facc15' }}>{gameState.phase.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>ROUND</span>
                    <span data-testid="round-indicator" style={{ fontWeight: 'bold' }}>{gameState.round}</span>
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
                                <span data-testid="active-player-name" style={{ fontWeight: 'bold', color: currentPlayer.color }}>{currentPlayer.name}</span>
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {onOpenPlayerAid && (
                    <button
                        onClick={onOpenPlayerAid}
                        data-testid="player-aid-button"
                        style={{
                            background: '#374151',
                            borderColor: '#4b5563',
                            fontSize: '13px',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            color: '#fbbf24',
                            fontWeight: 'bold',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #4b5563'
                        }}
                        title="Player Aid"
                    >
                        Player Aid
                    </button>
                )}

                {onLeave && (
                    <button
                        onClick={onLeave}
                        style={{
                            background: '#dc2626',
                            borderColor: '#991b1b',
                            fontSize: '13px',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            color: 'white',
                            fontWeight: 'bold',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #991b1b'
                        }}
                    >
                        Quit Game
                    </button>
                )}

                {onSave && !gameState.gameEnded && (
                    <button
                        onClick={onSave}
                        style={{
                            background: '#6366f1',
                            borderColor: '#4f46e5',
                            fontSize: '13px',
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            color: 'white',
                            fontWeight: 'bold',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #4f46e5'
                        }}
                        title="Save Game"
                    >
                        💾 Save Game
                    </button>
                )}
            </div>
        </div>
    );
};
