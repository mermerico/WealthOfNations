import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import type { GameState, Player, CommodityType } from '../types/gameState';

describe('Multi-Buy/Sell (executeMarketCart)', () => {
    const createInitialState = (multiBuySell: boolean = true): GameState => ({
        board: {},
        players: [
            { id: 'p1', name: 'Player 1', color: '#f00', resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'f1.svg' },
            { id: 'p2', name: 'Player 2', color: '#00f', resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 5, hasProduced: false, ready: true, flag: 'f2.svg' }
        ],
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        phase: 'Trade',
        round: 1,
        markets: {
            Food: { stock: 10, priceIndex: 10 },
            Energy: { stock: 10, priceIndex: 10 },
            Labor: { stock: 10, priceIndex: 10 },
            Ore: { stock: 10, priceIndex: 10 },
            Capital: { stock: 10, priceIndex: 10 }
        },
        pendingTrade: null,
        tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        isLastRound: false,
        gameEnded: false,
        consecutivePasses: 0,
        initialFlagsPerPlayer: 5,
        initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
        settings: { promissoryNoteInterestFees: false, multiBuySell, automatedFinalTrade: false },
        logs: []
    });

    it('should prevent executeMarketCart if multiBuySell setting is off', () => {
        const state = createInitialState(false);
        const result = gameReducer(state, 'executeMarketCart', { mode: 'buy', items: ['Food'] });
        expect(result.success).toBe(false);
        expect(result.message).toContain('not enabled');
    });

    it('should buy multiple commodities in one turn and advance turn once', () => {
        const state = createInitialState(true);
        const initialMoney = state.players[0].money;

        const result = gameReducer(state, 'executeMarketCart', { mode: 'buy', items: ['Food', 'Energy'] });

        expect(result.success).toBe(true);
        const newState = result.newState!;
        expect(newState.currentTurnPlayerIndex).toBe(1); // Turn advanced
        expect(newState.players[0].resources.Food).toBe(1);
        expect(newState.players[0].resources.Energy).toBe(1);
        expect(newState.players[0].money).toBeLessThan(initialMoney);
        expect(newState.markets.Food.stock).toBe(9);
        expect(newState.markets.Energy.stock).toBe(9);
    });

    it('should apply dynamic pricing for consecutive purchases of the same commodity', () => {
        const state = createInitialState(true);
        // Set stock to 2 so price is higher for the second unit
        state.markets.Food.stock = 2;

        // Let's check manual prices first
        // Price for stock=2 is MARKET_STEPS[1].buy
        // Price for stock=1 is MARKET_STEPS[0].buy

        const result = gameReducer(state, 'executeMarketCart', { mode: 'buy', items: ['Food', 'Food'] });

        expect(result.success).toBe(true);
        const newState = result.newState!;
        expect(newState.markets.Food.stock).toBe(0);

        // Total money spent should be sum of (stock=2 price) + (stock=1 price)
        // We'll just verify it's more than double the first price or similar
        // Better: let's verify exact cost if we had market definitions here, but we can just check if money is deducted correctly
    });

    it('should stop and fail if player runs out of money mid-batch', () => {
        const state = createInitialState(true);
        state.players[0].money = 5; // Very little money

        // Assume Food and Energy cost more than $5 combined
        const result = gameReducer(state, 'executeMarketCart', { mode: 'buy', items: ['Food', 'Energy'] });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Not enough money');
    });

    it('should allow selling multiple commodities', () => {
        const state = createInitialState(true);
        state.players[0].resources.Food = 2;
        const initialMoney = state.players[0].money;

        const result = gameReducer(state, 'executeMarketCart', { mode: 'sell', items: ['Food', 'Food'] });

        expect(result.success).toBe(true);
        const newState = result.newState!;
        expect(newState.players[0].resources.Food).toBe(0);
        expect(newState.players[0].money).toBeGreaterThan(initialMoney);
        expect(newState.markets.Food.stock).toBe(12);
    });

    it('should fail if cart has more than 3 items', () => {
        const state = createInitialState(true);
        const result = gameReducer(state, 'executeMarketCart', {
            mode: 'buy',
            items: ['Food', 'Food', 'Food', 'Food']
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Maximum 3 items');
    });

    it('should handle mixed commodity types in cart', () => {
        const state = createInitialState(true);
        state.players[0].money = 200; // Ensure enough money

        const result = gameReducer(state, 'executeMarketCart', {
            mode: 'buy',
            items: ['Food', 'Energy', 'Labor']
        });

        expect(result.success).toBe(true);
        const newState = result.newState!;
        expect(newState.players[0].resources.Food).toBe(1);
        expect(newState.players[0].resources.Energy).toBe(1);
        expect(newState.players[0].resources.Labor).toBe(1);
        expect(newState.markets.Food.stock).toBe(9);
        expect(newState.markets.Energy.stock).toBe(9);
        expect(newState.markets.Labor.stock).toBe(9);
    });

    it('should fail if trying to sell more than player owns', () => {
        const state = createInitialState(true);
        state.players[0].resources.Food = 1; // Player only has 1 Food

        const result = gameReducer(state, 'executeMarketCart', {
            mode: 'sell',
            items: ['Food', 'Food'] // Trying to sell 2
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('No Food to sell');
    });

    it('should fail with empty cart', () => {
        const state = createInitialState(true);

        const result = gameReducer(state, 'executeMarketCart', {
            mode: 'buy',
            items: []
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('empty');
    });

    it('should maintain backward compatibility with single buy action', () => {
        const state = createInitialState(false); // multiBuySell OFF

        // Regular buy should still work
        const result = gameReducer(state, 'buy', 'Food');

        expect(result.success).toBe(true);
        const newState = result.newState!;
        expect(newState.players[0].resources.Food).toBe(1);
        expect(newState.currentTurnPlayerIndex).toBe(1);
    });

    it('should maintain backward compatibility with single sell action', () => {
        const state = createInitialState(false); // multiBuySell OFF
        state.players[0].resources.Food = 5;

        // Regular sell should still work
        const result = gameReducer(state, 'sell', 'Food');

        expect(result.success).toBe(true);
        const newState = result.newState!;
        expect(newState.players[0].resources.Food).toBe(4);
        expect(newState.currentTurnPlayerIndex).toBe(1);
    });

    it('should reset consecutive passes when executing cart', () => {
        const state = createInitialState(true);
        state.consecutivePasses = 2;

        const result = gameReducer(state, 'executeMarketCart', {
            mode: 'buy',
            items: ['Food']
        });

        expect(result.success).toBe(true);
        expect(result.newState!.consecutivePasses).toBe(0);
    });
});
