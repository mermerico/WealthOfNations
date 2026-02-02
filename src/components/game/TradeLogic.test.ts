
import { describe, it, expect } from 'vitest';
import { calculateOptimalTrade } from './TradeActionPanel';
import { calculateOfferValue } from './TradeModal';
import { CommodityType, MarketState, Player } from '../../types/gameState';

describe('Trade Logic', () => {
    it('should generate a trade where value given equals value received', () => {
        // Setup a market where Food has a fractional barter price (8.5)
        // Index 8 for Food has barter 8.5 in marketPrices.ts
        const markets: Record<CommodityType, MarketState> = {
            Food: { stock: 9, priceIndex: 8 }, // Barter: 8.5
            Energy: { stock: 4, priceIndex: 4 },
            Labor: { stock: 4, priceIndex: 4 },
            Ore: { stock: 4, priceIndex: 4 },
            Capital: { stock: 4, priceIndex: 4 }
        };

        const player1Resources = { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 };
        const player1Needs = { Food: 1, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }; // Wants 1 Food

        const player2Resources = { Food: 1, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }; // Has 1 Food
        const player2Needs = { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 };

        const optimalTrade = calculateOptimalTrade(
            player1Needs,
            player1Resources,
            player2Needs,
            player2Resources,
            markets
        );

        // Player 1 should receive 1 Food (Value 8.5) and give Money (Value ~9)
        // or Player 1 should give Money to match 8.5

        const valGiving = calculateOfferValue(optimalTrade.giving, markets);
        const valReceiving = calculateOfferValue(optimalTrade.receiving, markets);



        expect(Math.abs(valGiving - valReceiving)).toBeLessThanOrEqual(0.6);
    });
});
