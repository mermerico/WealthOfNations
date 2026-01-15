import React from 'react';
import type { GameState, Player } from '../../types/gameState';
import { validateTileDots } from '../../utils/placementLogic';
import { calculateNewMoveHistory } from '../../utils/moveActionUtils';

interface MoveOperationPanelProps {
    movesCompleted: number;
    moveSourceId: string | null;
    moveHistory: Array<{ from: string; to: string; cost: number; orientation?: number; force?: boolean; skipBaseCost?: boolean }>;
    moveForceMode: boolean;
    pendingMoveTarget?: { from: string; to: string; orientation: number } | null;
    player: Player;
    gameState: GameState;
    setMoveForceMode: (v: boolean) => void;
    setPendingMoveTarget?: (v: { from: string; to: string; orientation: number } | null) => void;
    setMoveSourceId: (v: string | null) => void;
    setMoveHistory: React.Dispatch<React.SetStateAction<Array<{ from: string; to: string; cost: number; orientation?: number; force?: boolean; skipBaseCost?: boolean }>>>;
    setMovesCompleted: React.Dispatch<React.SetStateAction<number>>;
    setIsMoving: (v: boolean) => void;
    handleAction: (action: string, payload?: any) => void;
    onPass?: () => void;
}

export const MoveOperationPanel: React.FC<MoveOperationPanelProps> = ({
    movesCompleted,
    moveSourceId,
    moveHistory,
    moveForceMode,
    pendingMoveTarget,
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
                        {(() => {
                            // Check if current pending orientation is valid
                            const tile = gameState.board[pendingMoveTarget.from]?.occupant?.tile;
                            const validation = tile ? validateTileDots(gameState.board, pendingMoveTarget.to, tile.type, pendingMoveTarget.orientation, pendingMoveTarget.from) : { isValid: true };

                            return !validation.isValid && (
                                <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center' }}>
                                    Partial dots don't match
                                </div>
                            );
                        })()}
                    </div>

                    <button
                        onClick={() => {
                            if (setPendingMoveTarget) {
                                // Simply rotate the orientation in the pending move target
                                // The ghost tile preview reads from pendingMoveTarget.orientation
                                const newOrientation = (pendingMoveTarget.orientation + 1) % 6;
                                setPendingMoveTarget({ ...pendingMoveTarget, orientation: newOrientation });
                            }
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
                            if (!pendingMoveTarget) return;

                            const result = calculateNewMoveHistory(
                                moveHistory,
                                pendingMoveTarget,
                                movesCompleted,
                                moveForceMode
                            );

                            setMoveHistory(result.history);
                            setMovesCompleted(result.movesCompleted);

                            setMoveSourceId(null);
                            setMoveForceMode(false);
                            if (setPendingMoveTarget) setPendingMoveTarget(null);
                        }}
                        // disabled={!moveForceMode} // Enable for all pending confirmations
                        style={{
                            padding: '12px',
                            background: '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        ✓ Confirm Move
                    </button>

                    <button
                        onClick={() => {
                            if (setPendingMoveTarget) setPendingMoveTarget(null);
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
    // Reset force checkbox when starting a new move selection
    React.useEffect(() => {
        if (!moveSourceId) {
            setMoveForceMode(false);
        }
    }, [moveSourceId, setMoveForceMode]);

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
                    disabled={!moveSourceId}
                    onChange={(e) => setMoveForceMode(e.target.checked)}
                />
                <span style={{ color: '#ccc', fontSize: '12px', opacity: !moveSourceId ? 0.5 : 1 }}>Allow mismatched dots (+1 Capital each)</span>
            </label>

            {/* Rotate button - only shown when a tile is selected */}
            {moveSourceId && (
                <button
                    onClick={() => {
                        if (pendingMoveTarget && setPendingMoveTarget) {
                            const target = pendingMoveTarget as { from: string; to: string; orientation: number };
                            setPendingMoveTarget({
                                from: target.from,
                                to: target.to,
                                orientation: (target.orientation + 1) % 6
                            });
                            return;
                        }

                        // Priority 2: Rotate Selected Source in Place (Enters Pending Mode)
                        const cell = gameState.board[moveSourceId];
                        if (cell?.occupant?.type === 'Industry' && cell.occupant.tile) {
                            const currentOrientation = cell.occupant.tile.orientation || 0;

                            // Initialize pending move at current location
                            if (setPendingMoveTarget) {
                                // Check if next rotation is valid
                                const nextOrientation = (currentOrientation + 1) % 6;
                                const validation = validateTileDots(gameState.board, moveSourceId, cell.occupant.tile.type, nextOrientation, moveSourceId);

                                // User Request: "If ... such a rotation would not be allowed ... still go to that Pending Move phase but without doing that first rotation"
                                const targetOrientation = validation.isValid ? nextOrientation : currentOrientation;

                                setPendingMoveTarget({
                                    from: moveSourceId,
                                    to: moveSourceId,
                                    orientation: targetOrientation
                                });
                            }
                        }
                    }}
                    style={{
                        padding: '10px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: (movesCompleted >= 3 && (!moveHistory.length || moveHistory[moveHistory.length - 1].to !== moveSourceId)) ? 'not-allowed' : 'pointer',
                        opacity: (movesCompleted >= 3 && (!moveHistory.length || moveHistory[moveHistory.length - 1].to !== moveSourceId)) ? 0.5 : 1
                    }}
                >
                    ↻ Rotate Selected Tile
                </button>
            )}

            <button
                onClick={() => {
                    if (moveHistory.length > 0) {
                        const lastMove = moveHistory[moveHistory.length - 1];

                        // Just revert local state
                        setMoveHistory(prev => prev.slice(0, -1));
                        setMovesCompleted(prev => prev - 1);
                        setMoveSourceId(null); // Or set to lastMove.from to keep selection?
                        // Let's set it to lastMove.from to be friendly
                        setMoveSourceId(lastMove.from);
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

            <button
                onClick={() => {
                    // Cancel move operation
                    // Cancel move operation
                    // Just reset states, no need to dispatch refund as we never dispatched 'move'
                    // Clean local state
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

            <button
                onClick={() => {
                    // Commit the move sequence
                    if (moveHistory.length > 0) {
                        handleAction('moveIndustrySequence', {
                            moves: moveHistory.map(m => ({
                                fromId: m.from,
                                toId: m.to,
                                orientation: m.orientation,
                                force: m.force,
                                skipBaseCost: m.skipBaseCost
                            }))
                        });
                    }

                    setIsMoving(false);
                    setMoveSourceId(null);
                    setMoveHistory([]);
                    setMovesCompleted(0);
                    setMoveForceMode(false);
                }}
                disabled={moveHistory.length === 0}
                style={{
                    padding: '12px',
                    background: moveHistory.length === 0 ? '#333' : '#059669',
                    color: moveHistory.length === 0 ? '#666' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: moveHistory.length === 0 ? 'not-allowed' : 'pointer',
                    marginTop: 'auto'
                }}
            >
                ✓ Done Moving
            </button>
        </div>
    );
};
