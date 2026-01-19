import type { CommodityType, GameState } from '../types/gameState';
import { MARKET_STEPS } from './marketDefinitions';

// Step definitions for the end game sequence
// 0: Summary (Initial State)
// 1: Interest (Promissory Note Interest)
// 2: Liquidate Food
// 3: Liquidate Energy
// 4: Liquidate Labor
// 5: Liquidate Ore
// 6: Liquidate Capital
// 7: Pay off Loans
// 8: Victory (Game Ended)

export const END_GAME_STEPS = {
    SUMMARY: 0,
    INTEREST: 1,
    LIQUIDATE_FOOD: 2,
    LIQUIDATE_ENERGY: 3,
    LIQUIDATE_LABOR: 4,
    LIQUIDATE_ORE: 5,
    LIQUIDATE_CAPITAL: 6,
    PAY_LOANS: 7,
    VICTORY: 8
};



/**
 * Step 1: Apply Promissory Note Interest
 * In the final phase, interest is applied one last time before liquidation.
 * This is similar to the start of a Trade phase, but visualized explicitly.
 */
export function applyEndGameInterest(state: GameState): GameState {
    const newPlayers = state.players.map(player => {
        const initialLoans = player.loans;
        const interestDue = initialLoans; // $1 per loan

        if (interestDue === 0) return player;

        let currentMoney = player.money;
        let currentLoans = player.loans;

        // Take loans if needed to pay interest
        while (currentMoney < interestDue && currentLoans < 20) {
            const loanAmount = Math.max(0, 20 - currentLoans);
            if (loanAmount <= 0) break;
            currentMoney += loanAmount;
            currentLoans += 1;
        }

        currentMoney -= interestDue;

        // Floor at 0 (debt forgiveness logic from reducer)
        if (currentMoney < 0) currentMoney = 0;

        return {
            ...player,
            money: currentMoney,
            loans: currentLoans
        };
    });

    return {
        ...state,
        players: newPlayers,
        logs: [...(state.logs || []), {
            id: `endgame-interest-${Date.now()}`,
            type: 'system',
            message: 'All players paid promissory note interest.',
            timestamp: Date.now()
        }]
    };
}

/**
 * Steps 2-6: Liquidate a specific commodity
 * 1. Calculate total held by all players.
 * 2. Increase market stock by floor(total/2) (capped at max).
 * 3. Calculate final sell price at new stock level.
 * 4. All players sell all of that commodity at that price.
 */
export function liquidateCommodity(state: GameState, commodity: CommodityType): GameState {
    // 1. Calculate total
    let totalAmount = 0;
    state.players.forEach(p => {
        totalAmount += (p.resources[commodity] || 0);
    });

    if (totalAmount === 0) {
        return {
            ...state,
            logs: [...(state.logs || []), {
                id: `endgame-liquidate-${commodity}-${Date.now()}`,
                type: 'system',
                message: `Liquidating ${commodity}: No items held by players.`,
                timestamp: Date.now()
            }]
        };
    }

    // 2. Adjust Market
    const increment = Math.floor(totalAmount / 2);
    const steps = MARKET_STEPS[commodity];
    const initialStock = state.markets[commodity].stock;
    const finalStock = Math.min(steps.length, initialStock + increment);

    // 3. Determine Price
    const priceIndex = Math.min(finalStock, steps.length - 1);
    const sellPrice = steps[priceIndex].sell;

    // 4. Liquidate Players
    const newPlayers = state.players.map(player => {
        const amount = player.resources[commodity] || 0;
        if (amount === 0) return player;

        return {
            ...player,
            money: player.money + (amount * sellPrice),
            resources: {
                ...player.resources,
                [commodity]: 0
            }
        };
    });

    const newMarkets = {
        ...state.markets,
        [commodity]: {
            ...state.markets[commodity],
            stock: finalStock,
            priceIndex: priceIndex // Update price index to match visible logic if needed, though mostly visual
        }
    };

    return {
        ...state,
        players: newPlayers,
        markets: newMarkets,
        logs: [...(state.logs || []), {
            id: `endgame-liquidate-${commodity}-${Date.now()}`,
            type: 'system',
            message: `Liquidated ${totalAmount} ${commodity}. Market stock +${increment}. Sold at $${sellPrice}.`,
            timestamp: Date.now()
        }]
    };
}

/**
 * Step 7: Pay off Loans
 * Players pay back as many loans as they can with their final cash.
 * Each loan costs $25 to repay (standard value? check rules. V2 might be different?)
 * Standard rule: Repay loan = $25. Taking loan = $20. (verify this, usually specific in reducer)
 * 
 * wait, `repayLoan` action usually costs $25.
 */
export function repayFinalLoans(state: GameState): GameState {
    const LOAN_REPAYMENT_COST = 25; // Standard cost

    const newPlayers = state.players.map(player => {
        let money = player.money;
        let loans = player.loans;

        // Pay off as many as possible
        while (loans > 0 && money >= LOAN_REPAYMENT_COST) {
            money -= LOAN_REPAYMENT_COST;
            loans -= 1;
        }

        return {
            ...player,
            money,
            loans
        };
    });

    return {
        ...state,
        players: newPlayers,
        logs: [...(state.logs || []), {
            id: `endgame-repay-${Date.now()}`,
            type: 'system',
            message: 'Players repaid promissory notes with remaining cash.',
            timestamp: Date.now()
        }]
    };
}

/**
 * Main switch runner for the sequence
 */
export function processNextEndGameStep(state: GameState): GameState {
    const currentStep = state.endGameSequence?.currentStep ?? 0;
    const nextStep = currentStep + 1;

    let newState = { ...state };

    // Process based on what the NEXT step *is* (or what we are transitioning TO)
    // Actually, usually we perform the action associated with the step we are TRANSITIONING INTO?
    // Or we perform the action and THEN increment the step?
    // Let's say: We are at Step X. Action "NEXT" -> Calculate Step X+1 logic, set Step to X+1.

    // Note: Step 0 is "Summary" (No change, start state).
    // Transition 0 -> 1 (Interest): Apply Interest.
    // Transition 1 -> 2 (Liq Food): Liquidate Food.
    // ...
    // Transition 7 -> 8 (Victory): End Game.

    switch (nextStep) {
        case END_GAME_STEPS.INTEREST:
            newState = applyEndGameInterest(newState);
            break;
        case END_GAME_STEPS.LIQUIDATE_FOOD:
            newState = liquidateCommodity(newState, 'Food');
            break;
        case END_GAME_STEPS.LIQUIDATE_ENERGY:
            newState = liquidateCommodity(newState, 'Energy');
            break;
        case END_GAME_STEPS.LIQUIDATE_LABOR:
            newState = liquidateCommodity(newState, 'Labor');
            break;
        case END_GAME_STEPS.LIQUIDATE_ORE:
            newState = liquidateCommodity(newState, 'Ore');
            break;
        case END_GAME_STEPS.LIQUIDATE_CAPITAL:
            newState = liquidateCommodity(newState, 'Capital');
            break;
        case END_GAME_STEPS.PAY_LOANS:
            newState = repayFinalLoans(newState);
            break;
        case END_GAME_STEPS.VICTORY:
            // Just mark game ended
            newState.gameEnded = true;
            break;
    }

    return {
        ...newState,
        endGameSequence: {
            isActive: true,
            currentStep: nextStep
        }
    };
}
