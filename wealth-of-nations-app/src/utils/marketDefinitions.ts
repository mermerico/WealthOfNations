export interface MarketStep {
    stockLevel: number; // 0 is empty (highest price), higher is full (lowest price)
    sell: number;
    buy: number;
}

// Defining a standard 12-step market track or similar.
// Rules imply:
// - Lowest Buy Price is at the bottom (Full market).
// - Highest Sell Price is at the top (Empty market).
// Let's define steps from Index 0 (Top/Empty) to Index N (Bottom/Full).
// "Stock" corresponds to how many cubes are in the market.
// If Stock = 0, we are at Index 0 (Empty).
// If Stock = 1, the first well is filled. We are effectively at "Index 1" for next Sell?
// Wait. 
// - Buying: Buy from lowest occupied well.
// - Selling: Sell into highest empty well.

// Let's structure the Price Steps array such that:
// Index 0: Top-most well.
// Index N: Bottom-most well.
// If Stock = K, then wells 0 to K-1 are full. Wells K to N are empty.
// Buying: Take from well K-1. Pay Buy Price of well K-1.
// Selling: Put into well K. Receive Sell Price of well K.

export const MARKET_STEPS = [
    { sell: 40, buy: 44 }, // Well 1 (Top)
    { sell: 35, buy: 39 },
    { sell: 30, buy: 34 },
    { sell: 25, buy: 29 },
    { sell: 20, buy: 24 }, // Typical starting range?
    { sell: 15, buy: 19 },
    { sell: 12, buy: 16 },
    { sell: 10, buy: 13 },
    { sell: 8, buy: 11 },
    { sell: 6, buy: 9 },
    { sell: 4, buy: 7 },  // Well 11
    { sell: 2, buy: 5 },  // Well 12 (Bottom)
];
