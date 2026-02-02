import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import type { GameState } from '../types/gameState';
import { generateGrid } from './hexUtils';
import { MARKET_STARTING_QUANTITIES } from './marketPrices';

describe('hasPassed Badge Reset', () => {
    const createTestState = (): GameState => ({
        players: [
            {
                id: 'p1',
                name: 'Player 1',
                color: '#f00',
                resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
                money: 100,
                loans: 0,
                flags: 18,
                ready: true,
                flag: 'test.svg',
                hasPassed: false
            },
            {
                id: 'p2',
                name: 'Player 2',
                color: '#0f0',
                resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
                money: 100,
                loans: 0,
                flags: 18,
                ready: true,
                flag: 'test.svg',
                hasPassed: false
            },
            {
                id: 'p3',
                name: 'Player 3',
                color: '#00f',
                resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
                money: 100,
                loans: 0,
                flags: 18,
                ready: true,
                flag: 'test.svg',
                hasPassed: false
            }
        ],
        board: generateGrid(4),
        markets: {
            Food: { stock: MARKET_STARTING_QUANTITIES.Food, priceIndex: MARKET_STARTING_QUANTITIES.Food },
            Energy: { stock: MARKET_STARTING_QUANTITIES.Energy, priceIndex: MARKET_STARTING_QUANTITIES.Energy },
            Labor: { stock: MARKET_STARTING_QUANTITIES.Labor, priceIndex: MARKET_STARTING_QUANTITIES.Labor },
            Ore: { stock: MARKET_STARTING_QUANTITIES.Ore, priceIndex: MARKET_STARTING_QUANTITIES.Ore },
            Capital: { stock: MARKET_STARTING_QUANTITIES.Capital, priceIndex: MARKET_STARTING_QUANTITIES.Capital }
        },
        phase: 'Trade',
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        round: 1,
        consecutivePasses: 0,
        tilesRemaining: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        },
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: 18,
        initialTiles: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        }
    });


    it('should reset hasPassed flag when a new player\'s turn begins after pass', () => {
        const state = createTestState();

        // Player 1 passes
        let result = gameReducer(state, 'pass');
        expect(result.success).toBe(true);
        expect(result.newState?.players[0].hasPassed).toBe(true); // P1 passed
        expect(result.newState?.currentTurnPlayerIndex).toBe(1); // Now P2's turn
        expect(result.newState?.players[1].hasPassed).toBe(false); // P2 should NOT have passed flag

        // Player 2 passes
        result = gameReducer(result.newState!, 'pass');
        expect(result.success).toBe(true);
        expect(result.newState?.players[1].hasPassed).toBe(true); // P2 passed
        expect(result.newState?.currentTurnPlayerIndex).toBe(2); // Now P3's turn
        expect(result.newState?.players[2].hasPassed).toBe(false); // P3 should NOT have passed flag

        // Player 3 passes (all players passed, phase changes to Develop)
        result = gameReducer(result.newState!, 'pass');
        expect(result.success).toBe(true);
        expect(result.newState?.phase).toBe('Develop'); // Phase changed
        // When phase changes, all hasPassed flags are cleared
        expect(result.newState?.players[0].hasPassed).toBe(false);
        expect(result.newState?.players[1].hasPassed).toBe(false);
        expect(result.newState?.players[2].hasPassed).toBe(false);
    });


    it('should reset hasPassed flag when a new player\'s turn begins after buy', () => {
        const state = createTestState();

        // Player 1 passes
        let result = gameReducer(state, 'pass');
        expect(result.success).toBe(true);
        expect(result.newState?.players[0].hasPassed).toBe(true); // P1 passed
        expect(result.newState?.currentTurnPlayerIndex).toBe(1); // Now P2's turn

        // Player 2 buys (should reset their own hasPassed and the next player's)
        result = gameReducer(result.newState!, 'buy', 'Food');
        expect(result.success).toBe(true);
        expect(result.newState?.players[1].hasPassed).toBe(false); // P2 didn't pass
        expect(result.newState?.currentTurnPlayerIndex).toBe(2); // Now P3's turn
        expect(result.newState?.players[2].hasPassed).toBe(false); // P3 should NOT have passed flag
    });

    it('should reset hasPassed flag when turn wraps around after action', () => {
        const state = createTestState();
        state.currentTurnPlayerIndex = 2; // Start with P3

        // P3 passes
        let result = gameReducer(state, 'pass');
        expect(result.success).toBe(true);
        expect(result.newState?.players[2].hasPassed).toBe(true); // P3 passed
        expect(result.newState?.currentTurnPlayerIndex).toBe(0); // Wrapped to P1
        expect(result.newState?.players[0].hasPassed).toBe(false); // P1 should NOT have passed flag

        // P1 buys
        result = gameReducer(result.newState!, 'buy', 'Food');
        expect(result.success).toBe(true);
        expect(result.newState?.players[0].hasPassed).toBe(false); // P1 didn't pass
        expect(result.newState?.currentTurnPlayerIndex).toBe(1); // Now P2's turn
        expect(result.newState?.players[1].hasPassed).toBe(false); // P2 should NOT have passed flag
    });
});
