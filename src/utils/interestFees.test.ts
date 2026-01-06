import { describe, it, expect } from 'vitest';
import { createInitialGameState, applyGameAction } from '../shared/gameEngine';
import type { GameState } from '../types/gameState';

describe('Promissory Note Interest Fees', () => {
    /**
     * Helper to create a game state ready for Produce → Trade transition testing
     */
    function createProducePhaseState(options: {
        playerCount?: number;
        playerLoans?: number[];
        playerMoney?: number[];
        interestFeesEnabled?: boolean;
    }): GameState {
        const playerCount = options.playerCount ?? 3;
        const state = createInitialGameState({
            playerCount,
            settings: {
                promissoryNoteInterestFees: options.interestFeesEnabled ?? true
            }
        });

        // Set phase to Produce with all players ready to transition
        const players = state.players.map((p, i) => ({
            ...p,
            loans: options.playerLoans?.[i] ?? 0,
            money: options.playerMoney?.[i] ?? 0,
            hasPassed: false,
            hasProduced: true
        }));

        return {
            ...state,
            phase: 'Produce',
            players,
            consecutivePasses: playerCount - 1 // One more pass will trigger transition
        };
    }

    describe('Interest calculation', () => {
        it('should charge $1 per loan when transitioning to Trade phase', () => {
            const state = createProducePhaseState({
                playerLoans: [3, 5, 0],
                playerMoney: [10, 20, 5],
                interestFeesEnabled: true
            });

            // Trigger transition by having last player pass
            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);
            expect(result.newState?.phase).toBe('Trade');

            // Player 0: had 3 loans and $10, pays $3 interest → $7 left
            expect(result.newState?.players[0].money).toBe(7);
            expect(result.newState?.players[0].loans).toBe(3);

            // Player 1: had 5 loans and $20, pays $5 interest → $15 left
            expect(result.newState?.players[1].money).toBe(15);
            expect(result.newState?.players[1].loans).toBe(5);

            // Player 2: had 0 loans and $5, pays $0 interest → $5 unchanged
            expect(result.newState?.players[2].money).toBe(5);
            expect(result.newState?.players[2].loans).toBe(0);
        });

        it('should not charge interest when setting is disabled', () => {
            const state = createProducePhaseState({
                playerLoans: [5, 5, 5],
                playerMoney: [10, 10, 10],
                interestFeesEnabled: false
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);
            expect(result.newState?.phase).toBe('Trade');

            // All players should retain their $10 since interest is disabled
            expect(result.newState?.players[0].money).toBe(10);
            expect(result.newState?.players[1].money).toBe(10);
            expect(result.newState?.players[2].money).toBe(10);
        });
    });

    describe('Auto-borrow when cannot afford interest', () => {
        it('should auto-borrow when player has insufficient funds', () => {
            const state = createProducePhaseState({
                playerLoans: [5, 0, 0],
                playerMoney: [2, 0, 0], // Player 0 has 5 loans, needs $5, but only has $2
                interestFeesEnabled: true
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);

            // Player 0 needs $5 interest but only has $2
            // Takes 1 loan: gets $15 (20-5=15), now has $17 and 6 loans
            // Pays $5 interest (fixed at initial 5 loans) → $12 left
            expect(result.newState?.players[0].loans).toBe(6);
            expect(result.newState?.players[0].money).toBe(12);
        });

        it('should calculate interest based on initial loans, not after auto-borrow', () => {
            const state = createProducePhaseState({
                playerLoans: [10, 0, 0],
                playerMoney: [0, 0, 0], // Player 0 has 10 loans, needs $10, has $0
                interestFeesEnabled: true
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);

            // Player 0 needs $10 interest but has $0
            // Takes 1 loan: gets $10 (20-10=10), now has $10 and 11 loans
            // Pays $10 interest (fixed at initial 10 loans) → $0 left
            expect(result.newState?.players[0].loans).toBe(11);
            expect(result.newState?.players[0].money).toBe(0);
        });

        it('should cap auto-borrowing at 20 loans and forgive remaining debt', () => {
            const state = createProducePhaseState({
                playerLoans: [18, 0, 0],
                // Player 0 has 18 loans, needs $18. Currently has $0.
                // 1. Borrow: 19th loan -> get $2 (20-18). Money: $2. Loans: 19.
                // 2. Borrow: 20th loan -> get $1 (20-19). Money: $3. Loans: 20.
                // 3. Needs $18, has $3. Cannot borrow more (capped at 20).
                // 4. Pay $18. Money -> -15.
                // 5. Forgiveness -> Money becomes $0.
                playerMoney: [0, 0, 0],
                interestFeesEnabled: true
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);

            expect(result.newState?.players[0].loans).toBe(20);
            expect(result.newState?.players[0].money).toBe(0);
        });

        it('should handle heavily indebted player needing multiple loans within limits', () => {
            const state = createProducePhaseState({
                playerLoans: [15, 0, 0],
                playerMoney: [0, 0, 0], // Player 0 has 15 loans, needs $15, has $0
                interestFeesEnabled: true
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);

            // Player 0 needs $15 interest but has $0
            // Takes 1 loan: gets $5 (20-15=5), now has $5 and 16 loans
            // Still needs $15, has $5 - takes another loan: gets $4 (20-16=4), has $9 and 17 loans
            // Still needs $15, has $9 - takes another loan: gets $3 (20-17=3), has $12 and 18 loans
            // Still needs $15, has $12 - takes another loan: gets $2 (20-18=2), has $14 and 19 loans
            // Still needs $15, has $14 - takes another loan: gets $1 (20-19=1), has $15 and 20 loans
            // Now has $15. Pays $15 interest -> $0 left.
            // Exactly covered it!
            expect(result.newState?.players[0].loans).toBe(20);
            expect(result.newState?.players[0].money).toBe(0);
        });
    });

    describe('Edge cases', () => {
        it('should handle player starting at 20 loans', () => {
            const state = createProducePhaseState({
                playerLoans: [20, 0, 0],
                // Needs $20. Has $5.
                // Can't borrow more.
                // Pays $20 -> -15.
                // Forgiven -> $0.
                playerMoney: [5, 5, 5],
                interestFeesEnabled: true
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);

            expect(result.newState?.players[0].loans).toBe(20);
            expect(result.newState?.players[0].money).toBe(0);
        });
        it('should handle player with zero loans', () => {
            const state = createProducePhaseState({
                playerLoans: [0, 0, 0],
                playerMoney: [5, 5, 5],
                interestFeesEnabled: true
            });

            const result = applyGameAction(state, 'pass');
            expect(result.success).toBe(true);

            // No interest charged, money unchanged
            expect(result.newState?.players[0].money).toBe(5);
            expect(result.newState?.players[1].money).toBe(5);
            expect(result.newState?.players[2].money).toBe(5);
        });
    });
});
