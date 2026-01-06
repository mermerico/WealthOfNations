import { MARKET_PRICE_MAP } from './marketPrices';
import type { CommodityType } from '../types/gameState';

export interface MarketStep {
    sell: number;
    buy: number;
}

// "Stock" corresponds to how many cubes are in the market.
// Index 0: Top-most well.
// Index N: Bottom-most well.
// If Stock = K, then wells 0 to K-1 are full. Wells K to N are empty.
// Buying: Take from well K-1. Pay Buy Price of well K-1.
// Selling: Put into well K. Receive Sell Price of well K.

export const MARKET_STEPS: Record<CommodityType, MarketStep[]> = MARKET_PRICE_MAP;
