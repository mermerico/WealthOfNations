import type { CommodityType, GameState } from '../types/gameState';
import { MARKET_STEPS } from './marketDefinitions';

/**
 * Implements the Second Edition Automated Final Trade logic.
 * 
 * 1. Calculate total commodities of each type across all players.
 * 2. Increment market stock by floor(total/2) for each type.
 * 3. Final sell price is the price at this new stock level.
 * 4. All players sell ALL their commodities to the market at this fixed price.
 */
export function processAutomatedFinalTrade(state: GameState): GameState {
    const commodities: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

    // 1. Calculate totals across all players
    const totals: Record<CommodityType, number> = {
        Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0
    };

    state.players.forEach(player => {
        commodities.forEach(c => {
            totals[c] += (player.resources[c] || 0);
        });
    });

    // 2 & 3. Adjust markets and calculate final prices
    const newMarkets = { ...state.markets };
    const finalPrices: Record<CommodityType, number> = {
        Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0
    };

    commodities.forEach(c => {
        const increment = Math.floor(totals[c] / 2);
        const steps = MARKET_STEPS[c];
        const initialStock = state.markets[c].stock;

        // New stock level (capped at market max)
        const finalStock = Math.min(steps.length, initialStock + increment);

        // Final Price = price at this new stock level
        const priceIndex = Math.min(finalStock, steps.length - 1);
        finalPrices[c] = steps[priceIndex].sell;

        newMarkets[c] = {
            ...state.markets[c],
            stock: finalStock
        };
    });

    // 4. Liquidate all players
    const newPlayers = state.players.map(player => {
        let moneyGained = 0;
        const newResources = { ...player.resources };

        commodities.forEach(c => {
            const amount = player.resources[c] || 0;
            moneyGained += amount * finalPrices[c];
            newResources[c] = 0;
        });

        return {
            ...player,
            money: player.money + moneyGained,
            resources: newResources
        };
    });

    // Create logs for each commodity liquidation
    const newLogs = [...(state.logs || [])];
    commodities.forEach(c => {
        if (totals[c] > 0) {
            newLogs.push({
                id: `final-trade-${c}-${Date.now()}`,
                type: 'system',
                playerId: 'system',
                message: `Final Market: ${c} stock +${Math.floor(totals[c] / 2)}. Price: $${finalPrices[c]}. All players liquidated.`,
                timestamp: Date.now()
            });
        }
    });

    return {
        ...state,
        markets: newMarkets,
        players: newPlayers,
        logs: newLogs
    };
}
