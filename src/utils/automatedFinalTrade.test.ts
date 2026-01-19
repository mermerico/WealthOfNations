import { describe, it, expect } from 'vitest';
import { processNextEndGameStep, END_GAME_STEPS } from './automatedFinalTrade';
import type { GameState } from '../types/gameState';

describe('Automated Final Trade - Step By Step', () => {
    const createInitialState = (): GameState => ({
        board: {},
        players: [
            { id: 'p1', name: 'Player 1', color: '#f00', resources: { Food: 10, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 2, flags: 5, hasProduced: false, ready: true, flag: 'f1.svg' },
            { id: 'p2', name: 'Player 2', color: '#00f', resources: { Food: 5, Energy: 4, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'f2.svg' }
        ],
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        phase: 'Trade',
        round: 1,
        markets: {
            Food: { stock: 0, priceIndex: 0 },
            Energy: { stock: 10, priceIndex: 10 },
            Labor: { stock: 10, priceIndex: 10 },
            Ore: { stock: 10, priceIndex: 10 },
            Capital: { stock: 10, priceIndex: 10 }
        },
        pendingTrade: null,
        tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        isLastRound: true,
        gameEnded: false,
        consecutivePasses: 0,
        initialFlagsPerPlayer: 5,
        initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        settings: { promissoryNoteInterestFees: false, multiBuySell: false, automatedFinalTrade: true },
        logs: [],
        endGameSequence: {
            isActive: true,
            currentStep: END_GAME_STEPS.SUMMARY
        }
    });

    it('Step 0 -> 1: Should apply interest', () => {
        const state = createInitialState();
        // P1 has 2 loans. Interest = $2. Money 100 -> 98.
        const newState = processNextEndGameStep(state);

        expect(newState.endGameSequence?.currentStep).toBe(END_GAME_STEPS.INTEREST);
        expect(newState.players[0].money).toBe(98);
        expect(newState.players[1].money).toBe(100); // No loans
    });

    it('Step 1 -> 2: Should liquidate Food', () => {
        let state = createInitialState();
        state.endGameSequence!.currentStep = END_GAME_STEPS.INTEREST;

        // Setup markets
        // Total Food = 15. Increment = 7. Stock 0 -> 7.
        // Price at stock 7 (check market defs, assume > 0)

        const newState = processNextEndGameStep(state);

        expect(newState.endGameSequence?.currentStep).toBe(END_GAME_STEPS.LIQUIDATE_FOOD);
        expect(newState.markets.Food.stock).toBe(7);
        expect(newState.players[0].resources.Food).toBe(0); // Liquidated
        expect(newState.players[0].money).toBeGreaterThan(100);
    });

    it('Step 2 -> 3: Should liquidate Energy', () => {
        let state = createInitialState();
        state.endGameSequence!.currentStep = END_GAME_STEPS.LIQUIDATE_FOOD;

        // P2 has 4 Energy. Increment 2. Stock 10 -> 12.

        const newState = processNextEndGameStep(state);

        expect(newState.endGameSequence?.currentStep).toBe(END_GAME_STEPS.LIQUIDATE_ENERGY);
        expect(newState.markets.Energy.stock).toBe(12);
        expect(newState.players[1].resources.Energy).toBe(0);
        expect(newState.players[1].money).toBeGreaterThan(100);
    });

    it('Step 6 -> 7: Should repay loans', () => {
        let state = createInitialState();
        state.endGameSequence!.currentStep = END_GAME_STEPS.LIQUIDATE_CAPITAL; // Done liquidating

        // P1 has 2 loans. Money is plenty (>100).
        // Should pay off both ($25 each = $50).
        state.players[0].money = 200;
        state.players[0].loans = 2;

        const newState = processNextEndGameStep(state);

        expect(newState.endGameSequence?.currentStep).toBe(END_GAME_STEPS.PAY_LOANS);
        expect(newState.players[0].loans).toBe(0);
        expect(newState.players[0].money).toBe(150);
    });

    it('Step 7 -> 8: Should end game', () => {
        let state = createInitialState();
        state.endGameSequence!.currentStep = END_GAME_STEPS.PAY_LOANS;

        const newState = processNextEndGameStep(state);

        expect(newState.endGameSequence?.currentStep).toBe(END_GAME_STEPS.VICTORY);
        expect(newState.gameEnded).toBe(true);
    });
});
