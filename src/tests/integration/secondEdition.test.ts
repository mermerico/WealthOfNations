import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../utils/gameReducer';
import type { GameState } from '../../types/gameState';

describe('Second Edition Integration Tests', () => {
    const createGameEndState = (automatedFinalTrade: boolean): GameState => ({
        board: {},
        players: [
            {
                id: 'p1', name: 'Player 1', color: '#f00',
                resources: { Food: 10, Energy: 5, Labor: 0, Ore: 0, Capital: 0 },
                money: 50, loans: 0, flags: 5, hasProduced: false,
                ready: true, flag: 'f1.svg', hasPassed: true
            },
            {
                id: 'p2', name: 'Player 2', color: '#00f',
                resources: { Food: 5, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
                money: 100, loans: 0, flags: 5, hasProduced: false,
                ready: true, flag: 'f2.svg', hasPassed: true
            }
        ],
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        phase: 'Trade',
        round: 5,
        markets: {
            Food: { stock: 10, priceIndex: 10 },
            Energy: { stock: 10, priceIndex: 10 },
            Labor: { stock: 10, priceIndex: 10 },
            Ore: { stock: 10, priceIndex: 10 },
            Capital: { stock: 10, priceIndex: 10 }
        },
        pendingTrade: null,
        tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        isLastRound: true,
        gameEnded: false,
        consecutivePasses: 1, // One pass already
        initialFlagsPerPlayer: 5,
        initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        settings: { promissoryNoteInterestFees: false, multiBuySell: false, automatedFinalTrade },
        logs: []
    });

    describe('Automated Final Trade Integration', () => {
        it('should trigger automated final trade when enabled and game ends', () => {
            const state = createGameEndState(true);

            // Last player passes, triggering game end
            const result = gameReducer(state, 'pass');

            expect(result.success).toBe(true);
            const newState = result.newState!;
            expect(newState.gameEnded).toBe(true);

            // All resources should be liquidated
            expect(newState.players[0].resources.Food).toBe(0);
            expect(newState.players[0].resources.Energy).toBe(0);
            expect(newState.players[1].resources.Food).toBe(0);

            // Players should have more money than before
            expect(newState.players[0].money).toBeGreaterThan(50);
            expect(newState.players[1].money).toBeGreaterThan(100);

            // Markets should have adjusted stock
            // Total Food = 10 + 5 = 15, increment = floor(15/2) = 7
            expect(newState.markets.Food.stock).toBe(17); // 10 + 7
            // Total Energy = 5, increment = floor(5/2) = 2
            expect(newState.markets.Energy.stock).toBe(12); // 10 + 2
        });

        it('should NOT liquidate resources when automated final trade is disabled', () => {
            const state = createGameEndState(false);

            // Last player passes, triggering game end
            const result = gameReducer(state, 'pass');

            expect(result.success).toBe(true);
            const newState = result.newState!;
            expect(newState.gameEnded).toBe(true);

            // Resources should NOT be liquidated
            expect(newState.players[0].resources.Food).toBe(10);
            expect(newState.players[0].resources.Energy).toBe(5);
            expect(newState.players[1].resources.Food).toBe(5);

            // Money should be unchanged
            expect(newState.players[0].money).toBe(50);
            expect(newState.players[1].money).toBe(100);

            // Markets should NOT change
            expect(newState.markets.Food.stock).toBe(10);
            expect(newState.markets.Energy.stock).toBe(10);
        });
    });

    describe('Multi-Buy/Sell in Game Flow', () => {
        it('should allow multi-buy during game when setting is enabled', () => {
            const state = createGameEndState(false); // Use end state structure but not last round
            state.isLastRound = false;
            state.settings.multiBuySell = true;
            state.consecutivePasses = 0;
            state.players[0].hasPassed = false;
            state.players[0].money = 200;

            // Execute a multi-buy
            const result = gameReducer(state, 'executeMarketCart', {
                mode: 'buy',
                items: ['Food', 'Energy', 'Labor']
            });

            expect(result.success).toBe(true);
            expect(result.newState!.players[0].resources.Food).toBe(11); // Had 10, bought 1
            expect(result.newState!.players[0].resources.Energy).toBe(6); // Had 5, bought 1
            expect(result.newState!.players[0].resources.Labor).toBe(1); // Had 0, bought 1
            expect(result.newState!.currentTurnPlayerIndex).toBe(1); // Turn advanced
        });

        it('should prevent multi-buy if setting is disabled', () => {
            const state = createGameEndState(false);
            state.isLastRound = false;
            state.settings.multiBuySell = false;

            const result = gameReducer(state, 'executeMarketCart', {
                mode: 'buy',
                items: ['Food']
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not enabled');
        });
    });

    describe('Combined Settings', () => {
        it('should work correctly with both settings enabled', () => {
            const state = createGameEndState(true);
            state.settings.multiBuySell = true;

            // This is a valid configuration, just verify it doesn't cause errors
            expect(state.settings.multiBuySell).toBe(true);
            expect(state.settings.automatedFinalTrade).toBe(true);

            // Game should still end properly
            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            expect(result.newState!.gameEnded).toBe(true);
        });
    });
});
