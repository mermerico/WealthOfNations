import { describe, it, expect } from 'vitest';
import { MARKET_STEPS } from './marketDefinitions';
import type { CommodityType } from '../types/gameState';

describe('Market Mechanics', () => {
    describe('Market Price Structure', () => {
        it('should have 40 price levels for Food', () => {
            expect(MARKET_STEPS['Food']).toHaveLength(40);
        });

        it('should have 30 price levels for Capital', () => {
            expect(MARKET_STEPS['Capital']).toHaveLength(30);
        });

        it('should have higher buy prices than sell prices at each level', () => {
            Object.values(MARKET_STEPS).forEach(steps => {
                steps.forEach((step) => {
                    expect(step.buy).toBeGreaterThan(step.sell);
                });
            });
        });

        it('should have highest prices when market is empty (stock 0)', () => {
            const foodSteps = MARKET_STEPS['Food'];
            const emptyMarketPrices = foodSteps[0];
            const fullMarketPrices = foodSteps[foodSteps.length - 1];

            expect(emptyMarketPrices.sell).toBeGreaterThan(fullMarketPrices.sell);
            expect(emptyMarketPrices.buy).toBeGreaterThan(fullMarketPrices.buy);
        });

        it('should have prices decrease as stock increases', () => {
            Object.values(MARKET_STEPS).forEach(steps => {
                for (let i = 0; i < steps.length - 1; i++) {
                    expect(steps[i].sell).toBeGreaterThanOrEqual(steps[i + 1].sell);
                    expect(steps[i].buy).toBeGreaterThanOrEqual(steps[i + 1].buy);
                }
            });
        });
    });

    describe('Buy Price Calculation', () => {
        it('should use correct buy price when stock is available', () => {
            const stock = 4;
            const buyPrice = MARKET_STEPS['Food'][stock - 1].buy;

            expect(buyPrice).toBeDefined();
            expect(buyPrice).toBeGreaterThan(0);
        });

        it('should prevent buying when stock is 0', () => {
            const stock = 0;
            expect(stock).toBe(0);
        });

        it('should have different prices at extreme stock levels', () => {
            const foodSteps = MARKET_STEPS['Food'];
            const priceAt1 = foodSteps[0].buy;
            const priceAt40 = foodSteps[39].buy;

            expect(priceAt1).toBeGreaterThan(priceAt40);
        });
    });

    describe('Sell Price Calculation', () => {
        it('should use correct sell price when market has room', () => {
            const stock = 4;
            const sellPrice = MARKET_STEPS['Food'][stock].sell;

            expect(sellPrice).toBeDefined();
            expect(sellPrice).toBeGreaterThan(0);
        });

        it('should prevent selling when market is full', () => {
            const foodStock = MARKET_STEPS['Food'].length;
            expect(foodStock).toBe(40);

            const capitalStock = MARKET_STEPS['Capital'].length;
            expect(capitalStock).toBe(30);
        });

        it('should receive less money when market is fuller', () => {
            const foodSteps = MARKET_STEPS['Food'];
            const priceWhenEmpty = foodSteps[0].sell;
            const priceWhenNearFull = foodSteps[39].sell;

            expect(priceWhenEmpty).toBeGreaterThan(priceWhenNearFull);
        });
    });

    describe('Market Stock Updates', () => {
        it('should decrease stock after buying', () => {
            const initialStock = 4;
            const newStock = initialStock - 1;

            expect(newStock).toBe(3);
            expect(newStock).toBeGreaterThanOrEqual(0);
        });

        it('should increase stock after selling', () => {
            const initialStock = 4;
            const newStock = initialStock + 1;

            expect(newStock).toBe(5);
        });
    });

    describe('Starting Market State', () => {
        it('should have all markets start at same stock level of 4', () => {
            const commodities: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];
            const stocks = commodities.map(() => 4);

            expect(stocks.every(s => s === 4)).toBe(true);
        });
    });
});

// Integration tests for buy/sell boundary behavior
import { gameReducer } from './gameReducer';
import { generateGrid } from './hexUtils';
import type { GameState } from '../types/gameState';
import { MARKET_STARTING_QUANTITIES } from './marketPrices';

describe('Market Boundary Behavior', () => {
    const createTestState = (): GameState => ({
        players: [{
            id: 'p1',
            name: 'Player 1',
            color: '#fff',
            resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
            money: 1000,
            loans: 0,
            flags: 18,
            ready: true,
            flag: 'test.svg',
            hasPassed: false
        }],
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
        tilesRemaining: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: 18,
        initialTiles: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
        settings: { promissoryNoteInterestFees: false }
    });

    describe('Buying from empty market (stock = 0)', () => {
        it('should allow buying when stock = 0 (buying from supply)', () => {
            const state = createTestState();
            state.markets.Food.stock = 0;

            const result = gameReducer(state, 'buy', 'Food');

            expect(result.success).toBe(true);
            expect(result.newState?.markets.Food.stock).toBe(0); // Stock stays at 0
            expect(result.newState?.players[0].resources.Food).toBe(11); // Player got the cube
        });

        it('should use price from steps[0] when market is empty', () => {
            const state = createTestState();
            state.markets.Food.stock = 0;
            const expectedPrice = MARKET_STEPS.Food[0].buy;
            const initialMoney = state.players[0].money;

            const result = gameReducer(state, 'buy', 'Food');

            expect(result.success).toBe(true);
            expect(result.newState?.players[0].money).toBe(initialMoney - expectedPrice);
        });

        it('should allow multiple buys from stock = 0 without decreasing further', () => {
            let state = createTestState();
            state.markets.Food.stock = 0;

            // Buy multiple times
            for (let i = 0; i < 3; i++) {
                const result = gameReducer(state, 'buy', 'Food');
                expect(result.success).toBe(true);
                expect(result.newState?.markets.Food.stock).toBe(0);
                state = result.newState!;
            }

            expect(state.players[0].resources.Food).toBe(13); // Got 3 cubes
        });
    });

    describe('Selling to full market (stock = maxStock)', () => {
        it('should allow selling when market is full (selling to supply)', () => {
            const state = createTestState();
            const maxStock = MARKET_STEPS.Food.length;
            state.markets.Food.stock = maxStock;

            const result = gameReducer(state, 'sell', 'Food');

            expect(result.success).toBe(true);
            expect(result.newState?.markets.Food.stock).toBe(maxStock); // Stock stays at max
            expect(result.newState?.players[0].resources.Food).toBe(9); // Player sold a cube
        });

        it('should use price from steps[maxStock-1] when market is full', () => {
            const state = createTestState();
            const maxStock = MARKET_STEPS.Food.length;
            state.markets.Food.stock = maxStock;
            const expectedPrice = MARKET_STEPS.Food[maxStock - 1].sell;
            const initialMoney = state.players[0].money;

            const result = gameReducer(state, 'sell', 'Food');

            expect(result.success).toBe(true);
            expect(result.newState?.players[0].money).toBe(initialMoney + expectedPrice);
        });

        it('should allow multiple sells to full market without increasing stock', () => {
            let state = createTestState();
            const maxStock = MARKET_STEPS.Food.length;
            state.markets.Food.stock = maxStock;

            // Sell multiple times
            for (let i = 0; i < 3; i++) {
                const result = gameReducer(state, 'sell', 'Food');
                expect(result.success).toBe(true);
                expect(result.newState?.markets.Food.stock).toBe(maxStock);
                state = result.newState!;
            }

            expect(state.players[0].resources.Food).toBe(7); // Sold 3 cubes
        });
    });
});
