


export interface MoveHistoryItem {
    from: string;
    to: string;
    cost: number;
    orientation?: number;
    force?: boolean;
    skipBaseCost?: boolean;
}

export interface PendingMove {
    from: string;
    to: string;
    orientation: number;
}

/**
 * Calculates the new move history state after confirming a pending move.
 * Handles logic for merging with previous moves (if rotating in place at destination).
 */
export function calculateNewMoveHistory(
    currentHistory: MoveHistoryItem[],
    pendingMove: PendingMove,
    movesCompleted: number,
    force: boolean
): { history: MoveHistoryItem[], movesCompleted: number } {

    // Check for merge condition:
    // 1. There is a previous move
    // 2. The previous move ended at the pending move's start location (lastMove.to == pendingMove.from)
    // 3. The pending move is a rotation in place (pendingMove.from == pendingMove.to)
    const lastMove = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : null;
    const isUpdateToLastMove = lastMove && lastMove.to === pendingMove.from && pendingMove.from === pendingMove.to;

    if (isUpdateToLastMove && lastMove) {
        // Merge: Update the last move with new orientation and force flag
        const updatedLastMove = {
            ...lastMove,
            orientation: pendingMove.orientation,
            // If new rotation requires force, we might need to update cost?
            // For now, assume we just take the new force flag if true?
            // Or should we re-evaluate cost based on force?
            // Simple logic: update force flag. User checked/unchecked box in UI.
            force: force
        };

        // Recalculate cost for this updated move
        // Base cost logic: Was it the first move?
        // Reuse skipBaseCost from original lastMove to maintain base cost logic
        const baseCost = updatedLastMove.skipBaseCost ? 0 : 1;
        const tileCost = force ? 1 : 0;
        updatedLastMove.cost = baseCost + tileCost;

        const newHistory = [...currentHistory];
        newHistory[newHistory.length - 1] = updatedLastMove;

        return {
            history: newHistory,
            movesCompleted: movesCompleted // Count doesn't change
        };
    }

    // Standard New Move
    const isFirstMove = movesCompleted === 0;
    const baseCost = isFirstMove ? 1 : 0;
    const tileCost = force ? 1 : 0;

    const newMove: MoveHistoryItem = {
        from: pendingMove.from,
        to: pendingMove.to,
        cost: baseCost + tileCost,
        orientation: pendingMove.orientation,
        force: force,
        skipBaseCost: !isFirstMove
    };

    return {
        history: [...currentHistory, newMove],
        movesCompleted: movesCompleted + 1
    };
}
