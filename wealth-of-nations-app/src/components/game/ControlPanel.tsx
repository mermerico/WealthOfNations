import React from 'react';
import type { GameState } from '../../types/gameState';

interface ControlPanelProps {
    gameState: GameState;
    onAction: (action: string, payload?: any) => void;
    canAct?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ gameState, onAction, canAct = true }) => {
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
                        <img
                            src={`/flags/${currentPlayer.flag}`}
                            alt={currentPlayer.name}
                            style={{ width: '20px', height: '10px', objectFit: 'cover' }}
                        />
                        <span style={{ fontWeight: 'bold', color: currentPlayer.color }}>{currentPlayer.name}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
                {/* New Game Button - always visible */}
                <button
                    disabled={!canAct}
                    onClick={() => onAction('startSetup')}
                    style={{
                        background: '#10b981',
                        borderColor: '#059669',
                        fontSize: '12px',
                        opacity: canAct ? 1 : 0.5,
                        cursor: canAct ? 'pointer' : 'not-allowed'
                    }}
                >
                    New Game
                </button>

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
            </div>
        </div>
    );
};
