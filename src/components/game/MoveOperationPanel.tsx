import React from 'react';
import type { GameState, Player } from '../../types/gameState';

interface MoveOperationPanelProps {
    movesCompleted: number;
    moveSourceId: string | null;
    moveHistory: Array<{ from: string; to: string }>;
    moveForceMode: boolean;
    pendingMoveTarget: { from: string; to: string; orientation: number } | null;
    player: Player;
    gameState: GameState;

    setMoveForceMode: (v: boolean) => void;
    setPendingMoveTarget: (v: { from: string; to: string; orientation: number } | null) => void;
    setMoveSourceId: (v: string | null) => void;
    setMoveHistory: React.Dispatch<React.SetStateAction<Array<{ from: string; to: string }>>>;
    setMovesCompleted: React.Dispatch<React.SetStateAction<number>>;
    setIsMoving: (v: boolean) => void;
    handleAction: (action: string, payload?: any) => void;
}

export const MoveOperationPanel: React.FC<MoveOperationPanelProps> = ({
    movesCompleted,
    moveSourceId,
    moveHistory,
    moveForceMode,
    pendingMoveTarget,
    player,
    gameState,
    setMoveForceMode,
    setPendingMoveTarget,
    setMoveSourceId,
    setMoveHistory,
    setMovesCompleted,
    setIsMoving,
    handleAction
}) => {
    if (pendingMoveTarget) {
        // Pending Move Confirmation
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: '#222', padding: '10px', borderRadius: '4px', border: '2px solid #f59e0b' }}>
                        <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                            Confirm Move
                        </div>
                        <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center' }}>
                            Partial dots don't match
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            const movedTile = gameState.board[pendingMoveTarget.from]?.occupant?.tile;
                            if (!movedTile) return;

                            const currentOrientation = movedTile.orientation;
                            const newOrientation = (currentOrientation + 1) % 6;

                            // Update the tile orientation in the board
                            const cell = gameState.board[pendingMoveTarget.from];
                            if (cell.occupant?.type === 'Industry' && cell.occupant.tile) {
                                const updatedTile = { ...cell.occupant.tile, orientation: newOrientation };
                                const updatedCell = {
                                    ...cell,
                                    occupant: {
                                        ...cell.occupant,
                                        tile: updatedTile
                                    }
                                };
                                handleAction('sandboxPlaceTile', { id: pendingMoveTarget.from, cell: updatedCell });
                            }

                            setPendingMoveTarget({ ...pendingMoveTarget, orientation: newOrientation });
                        }}
                        style={{
                            padding: '10px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        ↻ Rotate
                    </button>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#222', borderRadius: '4px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={moveForceMode}
                            onChange={(e) => setMoveForceMode(e.target.checked)}
                        />
                        <span style={{ color: '#ccc', fontSize: '12px' }}>Force move (costs 1 Capital)</span>
                    </label>

                    <button
                        onClick={() => {
                            if (!moveForceMode) return;

                            // Deduct extra capital for forcing
                            if (player.resources.Capital < 1) return;

                            // Execute the move
                            handleAction('moveIndustry', { fromId: pendingMoveTarget.from, toId: pendingMoveTarget.to, extraTurns: true });

                            // Deduct capital for force
                            const updatedPlayer = {
                                ...player,
                                resources: {
                                    ...player.resources,
                                    Capital: player.resources.Capital - 1
                                }
                            };
                            handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? updatedPlayer : p) });

                            // Track the move
                            setMoveHistory(prev => [...prev, { from: pendingMoveTarget.from, to: pendingMoveTarget.to }]);
                            setMovesCompleted(prev => prev + 1);
                            setPendingMoveTarget(null);
                            setMoveSourceId(null);
                            setMoveForceMode(false);

                            // If 3 moves completed, end move mode and deduct capital
                            if (movesCompleted + 1 >= 3) {
                                const finalPlayer = {
                                    ...updatedPlayer,
                                    resources: {
                                        ...updatedPlayer.resources,
                                        Capital: updatedPlayer.resources.Capital - 1
                                    }
                                };
                                handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? finalPlayer : p) });

                                setIsMoving(false);
                                setMoveHistory([]);
                                setMovesCompleted(0);
                                handleAction('pass');
                            }
                        }}
                        disabled={!moveForceMode}
                        style={{
                            padding: '12px',
                            background: moveForceMode ? '#059669' : '#333',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: moveForceMode ? 'pointer' : 'not-allowed'
                        }}
                    >
                        ✓ Confirm Force Move
                    </button>

                    <button
                        onClick={() => {
                            setPendingMoveTarget(null);
                            setMoveSourceId(null);
                            setMoveForceMode(false);
                        }}
                        style={{
                            padding: '10px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        ✕ Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Normal Move UI
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <div style={{ background: '#222', padding: '10px', borderRadius: '4px', border: '2px solid cyan' }}>
                <div style={{ color: 'cyan', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                    Move Operation
                </div>
                <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>
                    {moveSourceId ? 'Select destination' : 'Select tile to move'}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: 'white' }}>
                    {movesCompleted} / 3
                </div>
                <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', marginTop: '4px' }}>
                    moves completed
                </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#222', borderRadius: '4px', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={moveForceMode}
                    onChange={(e) => setMoveForceMode(e.target.checked)}
                />
                <span style={{ color: '#ccc', fontSize: '12px' }}>Allow mismatched dots (+1 Capital each)</span>
            </label>

            <button
                onClick={() => {
                    if (moveHistory.length > 0) {
                        const lastMove = moveHistory[moveHistory.length - 1];
                        // Undo the last move
                        handleAction('moveIndustry', { fromId: lastMove.to, toId: lastMove.from, extraTurns: true });
                        setMoveHistory(prev => prev.slice(0, -1));
                        setMovesCompleted(prev => prev - 1);
                        setMoveSourceId(null);
                    } else if (moveSourceId) {
                        // Just deselect if no moves made
                        setMoveSourceId(null);
                    }
                }}
                disabled={moveHistory.length === 0 && !moveSourceId}
                style={{
                    padding: '10px',
                    background: (moveHistory.length > 0 || moveSourceId) ? '#dc2626' : '#333',
                    color: (moveHistory.length > 0 || moveSourceId) ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: (moveHistory.length > 0 || moveSourceId) ? 'pointer' : 'not-allowed'
                }}
            >
                ⟲ Undo {moveSourceId && !moveHistory.length ? 'Selection' : 'Last Move'}
            </button>

            {moveHistory.length === 0 && (
                <button
                    onClick={() => {
                        // Cancel move mode without deducting capital
                        setIsMoving(false);
                        setMoveSourceId(null);
                        setMoveHistory([]);
                        setMovesCompleted(0);
                        setMoveForceMode(false);
                    }}
                    style={{
                        padding: '10px',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    ✕ Cancel
                </button>
            )}

            <button
                onClick={() => {
                    // End move mode early and deduct capital
                    const updatedPlayer = {
                        ...player,
                        resources: {
                            ...player.resources,
                            Capital: player.resources.Capital - 1
                        }
                    };
                    handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? updatedPlayer : p) });

                    // Reset move state and advance turn
                    setIsMoving(false);
                    setMoveSourceId(null);
                    setMoveHistory([]);
                    setMovesCompleted(0);
                    setMoveForceMode(false);
                    handleAction('pass');
                }}
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
                ✓ Done Moving
            </button>
        </div>
    );
};
