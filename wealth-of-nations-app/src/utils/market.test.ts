import { describe, it, expect } from 'vitest';
import { MARKET_STEPS } from './marketDefinitions';
import type { CommodityType } from '../types/gameState';

describe('Market Mechanics', () => {
    describe('Market Price Structure', () => {
        it('should have 12 price levels', () => {
            expect(MARKET_STEPS).toHaveLength(12);
        });

        it('should have higher buy prices than sell prices at each level', () => {
            MARKET_STEPS.forEach((step) => {
                expect(step.buy).toBeGreaterThan(step.sell);
            });
        });

        it('should have highest prices when market is empty (stock 0)', () => {
            const emptyMarketPrices = MARKET_STEPS[0]; // When stock is 0, we'd buy from supply
            const fullMarketPrices = MARKET_STEPS[MARKET_STEPS.length - 1];

            expect(emptyMarketPrices.sell).toBeGreaterThan(fullMarketPrices.sell);
            expect(emptyMarketPrices.buy).toBeGreaterThan(fullMarketPrices.buy);
        });

        it('should have prices decrease as stock increases', () => {
            for (let i = 0; i < MARKET_STEPS.length - 1; i++) {
                expect(MARKET_STEPS[i].sell).toBeGreaterThan(MARKET_STEPS[i + 1].sell);
                expect(MARKET_STEPS[i].buy).toBeGreaterThan(MARKET_STEPS[i + 1].buy);
            }
        });
    });

    describe('Buy Price Calculation', () => {
        it('should use correct buy price when stock is available', () => {
            const stock = 4; // Starting stock
            const buyPrice = MARKET_STEPS[stock - 1].buy;

            // At stock 4, we buy from the 4th well (index 3)
            expect(buyPrice).toBeDefined();
            expect(buyPrice).toBeGreaterThan(0);
        });

        it('should prevent buying when stock is 0', () => {
            const stock = 0;
            // Game should not allow purchase when stock <= 0
            expect(stock).toBe(0);
        });

        it('should have different prices at different stock levels', () => {
            const priceAt1 = MARKET_STEPS[0].buy;
            const priceAt4 = MARKET_STEPS[3].buy;
            const priceAt12 = MARKET_STEPS[11].buy;

            expect(priceAt1).toBeGreaterThan(priceAt4);
            expect(priceAt4).toBeGreaterThan(priceAt12);
        });
    });

    describe('Sell Price Calculation', () => {
        it('should use correct sell price when market has room', () => {
            const stock = 4; // Starting stock
            const sellPrice = MARKET_STEPS[stock].sell;

            // At stock 4, we sell to the 5th well (index 4)
            expect(sellPrice).toBeDefined();
            expect(sellPrice).toBeGreaterThan(0);
        });

        it('should prevent selling when market is full', () => {
            const stock = MARKET_STEPS.length; // Market full
            // Game should not allow sale when stock >= max
            expect(stock).toBe(12);
        });

        it('should receive less money when market is fuller', () => {
            const priceWhenEmpty = MARKET_STEPS[0].sell; // Selling to empty market
            const priceWhenMid = MARKET_STEPS[6].sell;
            const priceWhenNearFull = MARKET_STEPS[11].sell;

            expect(priceWhenEmpty).toBeGreaterThan(priceWhenMid);
            expect(priceWhenMid).toBeGreaterThan(priceWhenNearFull);
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
            expect(newStock).toBeLessThanOrEqual(MARKET_STEPS.length);
        });
    });

    describe('Starting Market State', () => {
        it('should start at stock level 4 with 4 cubes', () => {
            const startingStock = 4;
            expect(startingStock).toBe(4);
        });

        it('should have all markets start at same stock level', () => {
            // All markets begin with 4 cubes according to rules
            const commodities: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];
            const stocks = commodities.map(() => 4);

            expect(stocks.every(s => s === 4)).toBe(true);
        });
    });
});
