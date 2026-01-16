import type { MarketStep } from './marketDefinitions';

/**
 * Calculates the current barter price for a commodity based on its stock level.
 * Formula: (Buy Price at stock - 1 + Sell Price at stock) / 2
 * 
 * @param steps The market price steps for the commodity
 * @param stock The current number of cubes in the market
 * @returns The calculated barter price, or null if it cannot be calculated
 */
export function calculateCurrentBarterPrice(
    steps: MarketStep[],
    stock: number
): number | null {
    if (!steps || steps.length === 0) return null;

    // Boundary check: ensure stock index is within range
    const priceIndex = Math.min(Math.max(0, stock), steps.length - 1);
    const step = steps[priceIndex];

    return step?.barter ?? null;
}
