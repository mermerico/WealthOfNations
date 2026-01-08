import React from 'react';
import type { GameState } from '../../types/gameState';

interface SetupActionsPanelProps {
    gameState: GameState;
    handleAction: (action: string, payload?: any) => void;
}

export const SetupActionsPanel: React.FC<SetupActionsPanelProps> = ({
    gameState,
    handleAction
}) => {
    const placementHistory = gameState.setupPhase?.pendingPlacement?.placementHistory;
    const tilesRemaining = gameState.setupPhase?.pendingPlacement?.tilesRemaining;
    const hasHistory = placementHistory && placementHistory.length > 0;
    const allTilesPlaced = tilesRemaining?.length === 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
                onClick={() => handleAction('undoSetupPlacement')}
                disabled={!hasHistory}
                style={{
                    padding: '10px',
                    background: hasHistory ? '#ef4444' : '#444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: hasHistory ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}
            >
                ↶ Undo Last Tile
            </button>
            <button
                onClick={() => handleAction('rotateSetupTile')}
                disabled={!hasHistory}
                style={{
                    padding: '10px',
                    background: hasHistory ? '#3b82f6' : '#444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: hasHistory ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}
            >
                ⟳ Rotate Last Tile
            </button>
            <button
                data-testid="setup-pass-button"
                onClick={() => handleAction('pass')}
                disabled={!allTilesPlaced}
                style={{
                    padding: '10px',
                    background: allTilesPlaced ? '#10b981' : '#444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: allTilesPlaced ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}
            >
                ✓ Pass (Continue)
            </button>
        </div>
    );
};
