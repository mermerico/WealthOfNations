
import { describe, it, expect } from 'vitest';
import { calculateNewMoveHistory, MoveHistoryItem, PendingMove } from './moveActionUtils';

describe('calculateNewMoveHistory', () => {
    /*
     * Spec Scenario 1: Simple Move
     * Empty history -> New Move (Cost 1)
     */
    it('adds a standard first move correctly', () => {
        const history: MoveHistoryItem[] = [];
        const pending: PendingMove = { from: '0,0', to: '1,0', orientation: 0 };
        const result = calculateNewMoveHistory(history, pending, 0, false);

        expect(result.movesCompleted).toBe(1);
        expect(result.history).toHaveLength(1);
        expect(result.history[0]).toEqual({
            from: '0,0',
            to: '1,0',
            orientation: 0,
            cost: 1, // Base 1 + Force 0
            force: false,
            skipBaseCost: false
        });
    });

    /*
     * Spec Scenario 1b: Second Move
     * Existing history -> New Move (Cost 0 - chaining)
     */
    it('adds a second move with reduced cost', () => {
        const history: MoveHistoryItem[] = [{ from: '0,0', to: '1,0', cost: 1, orientation: 0, force: false, skipBaseCost: false }];
        const pending: PendingMove = { from: '1,0', to: '2,0', orientation: 0 };
        const result = calculateNewMoveHistory(history, pending, 1, false);

        expect(result.movesCompleted).toBe(2);
        expect(result.history).toHaveLength(2);
        expect(result.history[1]).toEqual({
            from: '1,0',
            to: '2,0',
            orientation: 0,
            cost: 0, // Base 0 (skipped) + Force 0
            force: false,
            skipBaseCost: true
        });
    });

    /*
     * Spec Scenario 2: Rotate in Place (First Action)
     * Empty history -> Rotate (Cost 1)
     */
    it('treats rotate in place as a move', () => {
        const history: MoveHistoryItem[] = [];
        const pending: PendingMove = { from: '0,0', to: '0,0', orientation: 1 };
        const result = calculateNewMoveHistory(history, pending, 0, false);

        expect(result.movesCompleted).toBe(1);
        expect(result.history[0]).toEqual({
            from: '0,0',
            to: '0,0',
            orientation: 1,
            cost: 1,
            force: false,
            skipBaseCost: false
        });
    });

    /*
     * Spec Scenario 3: Move then Rotate (Merge)
     * Move A->B, then Rotate B (in place). Should merge into single move A->B (new rot).
     */
    it('merges rotation into previous move if targets match', () => {
        const history: MoveHistoryItem[] = [{
            from: '0,0', to: '1,0', cost: 1, orientation: 0, force: false, skipBaseCost: false
        }];
        // Pending: Rotate at '1,0' (destination of last move)
        const pending: PendingMove = { from: '1,0', to: '1,0', orientation: 2 };

        const result = calculateNewMoveHistory(history, pending, 1, false);

        // Should update existing move, not add new one
        expect(result.movesCompleted).toBe(1);
        expect(result.history).toHaveLength(1);
        expect(result.history[0]).toEqual({
            from: '0,0', // Defines original start
            to: '1,0',   // Defines original end
            orientation: 2, // New orientation
            cost: 1,
            force: false,
            skipBaseCost: false
        });
    });

    /*
     * Spec Scenario 3b: Move then Rotate then Rotate again (Merge chain)
     */
    it('merges subsequent rotations into the same move', () => {
        const history: MoveHistoryItem[] = [{
            from: '0,0', to: '1,0', cost: 1, orientation: 2, force: false, skipBaseCost: false
        }];
        const pending: PendingMove = { from: '1,0', to: '1,0', orientation: 3 };

        const result = calculateNewMoveHistory(history, pending, 1, true); // Added force

        expect(result.movesCompleted).toBe(1);
        expect(result.history[0]).toEqual({
            from: '0,0',
            to: '1,0',
            orientation: 3,
            cost: 2, // Base 1 + Force 1 (updated)
            force: true, // Updated force flag
            skipBaseCost: false
        });
    });

    /*
     * Spec Scenario: No Merge (Different Source)
     * Move A->B. Then Move C->D. No merge.
     */
    it('does not merge if moves are unrelated', () => {
        const history: MoveHistoryItem[] = [{
            from: '0,0', to: '1,0', cost: 1, orientation: 0, force: false, skipBaseCost: false
        }];
        const pending: PendingMove = { from: '5,5', to: '5,5', orientation: 1 }; // Rotate C

        const result = calculateNewMoveHistory(history, pending, 1, false);

        expect(result.movesCompleted).toBe(2);
        expect(result.history).toHaveLength(2);
    });

    /*
     * Spec Scenario: No Merge (Move A->B, then Move B->C)
     * Standard chain.
     */
    it('does not merge chaining moves (A->B then B->C)', () => {
        const history: MoveHistoryItem[] = [{
            from: '0,0', to: '1,0', cost: 1, orientation: 0, force: false, skipBaseCost: false
        }];
        const pending: PendingMove = { from: '1,0', to: '2,0', orientation: 0 };

        const result = calculateNewMoveHistory(history, pending, 1, false);

        expect(result.movesCompleted).toBe(2);
        expect(result.history).toHaveLength(2);
        expect(result.history[1].from).toBe('1,0');
        expect(result.history[1].to).toBe('2,0');
    });
});
