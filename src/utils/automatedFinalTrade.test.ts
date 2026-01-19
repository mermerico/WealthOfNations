import { describe, it, expect } from 'vitest';
import { processAutomatedFinalTrade } from './automatedFinalTrade';
import type { GameState } from '../types/gameState';

describe('Automated Final Trade', () => {
    const createInitialState = (): GameState => ({
        board: {},
        players: [
            { id: 'p1', name: 'Player 1', color: '#f00', resources: { Food: 10, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'f1.svg' },
            { id: 'p2', name: 'Player 2', color: '#00f', resources: { Food: 5, Energy: 4, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'f2.svg' }
        ],
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        phase: 'Trade',
        round: 1,
        markets: {
            Food: { stock: 0, priceIndex: 0 }, // Very high price
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
        logs: []
    });

    it('should calculate correct totals and adjust market stock', () => {
        const state = createInitialState();
        // Total Food = 10 + 5 = 15. Increment = floor(15/2) = 7.
        // Food stock: 0 -> 7

        // Total Energy = 4. Increment = 2.
        // Energy stock: 10 -> 12

        const newState = processAutomatedFinalTrade(state);

        expect(newState.markets.Food.stock).toBe(7);
        expect(newState.markets.Energy.stock).toBe(12);
    });

    it('should liquidate all player resources into money', () => {
        const state = createInitialState();
        const newState = processAutomatedFinalTrade(state);

        // Player 1 had 10 Food.
        // Market stock became 7.
        // Sell price for Food at stock 7 (check marketDefinitions or just verify it's > 0)

        expect(newState.players[0].resources.Food).toBe(0);
        expect(newState.players[0].money).toBeGreaterThan(100);

        expect(newState.players[1].resources.Food).toBe(0);
        expect(newState.players[1].resources.Energy).toBe(0);
        expect(newState.players[1].money).toBeGreaterThan(100);
    });

    it('should add logs for liquidation', () => {
        const state = createInitialState();
        const newState = processAutomatedFinalTrade(state);

        expect(newState.logs.length).toBeGreaterThan(0);
        expect(newState.logs.some(l => l.message.includes('Final Market: Food'))).toBe(true);
    });

    it('should handle players with no resources (no-op liquidation)', () => {
        const state = createInitialState();
        state.players[0].resources = { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 };
        state.players[1].resources = { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 };

        const newState = processAutomatedFinalTrade(state);

        expect(newState.players[0].money).toBe(100);
        expect(newState.players[1].money).toBe(100);
        expect(newState.markets.Food.stock).toBe(state.markets.Food.stock);
    });

    it('should cap market stock at maximum when increment exceeds limit', () => {
        const state = createInitialState();
        state.players[0].resources.Food = 100;
        state.markets.Food.stock = 35;

        const newState = processAutomatedFinalTrade(state);

        expect(newState.markets.Food.stock).toBeLessThanOrEqual(40);
    });

    it('should calculate money correctly for multiple commodities', () => {
        const state = createInitialState();
        state.players[0].resources = { Food: 5, Energy: 3, Labor: 2, Ore: 1, Capital: 0 };
        state.players[0].money = 50;

        const newState = processAutomatedFinalTrade(state);

        expect(newState.players[0].resources.Food).toBe(0);
        expect(newState.players[0].resources.Energy).toBe(0);
        expect(newState.players[0].resources.Labor).toBe(0);
        expect(newState.players[0].resources.Ore).toBe(0);
        expect(newState.players[0].money).toBeGreaterThan(50);
    });

    it('should not add logs for commodities with 0 total resources', () => {
        const state = createInitialState();
        state.players[0].resources = { Food: 5, Energy: 0, Labor: 0, Ore: 0, Capital: 0 };
        state.players[1].resources = { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 };

        const newState = processAutomatedFinalTrade(state);

        const foodLogs = newState.logs.filter(l => l.message.includes('Final Market: Food'));
        const energyLogs = newState.logs.filter(l => l.message.includes('Final Market: Energy'));

        expect(foodLogs.length).toBeGreaterThan(0);
        expect(energyLogs.length).toBe(0);
    });
});
