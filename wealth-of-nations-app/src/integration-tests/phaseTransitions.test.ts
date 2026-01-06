import { describe, it, expect } from 'vitest';
import { generateGrid } from '../utils/hexUtils';
import { gameReducer } from '../utils/gameReducer';
import type { GameState, Player } from '../types/gameState';
import { MARKET_STARTING_QUANTITIES } from '../utils/marketPrices';

/**
 * Integration tests for phase transitions through sequences of actions.
 * These tests use the ACTUAL game reducer (not a mock) to verify
 * that phase transitions work correctly.
 */

// Helper to create a basic game state at a specific phase
function createGameState(phase: 'Trade' | 'Develop' | 'Produce', playerCount: number = 2): GameState {
    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][i],
            resources: {
                Food: 10,
                Energy: 10,
                Labor: 10,
                Ore: 10,
                Capital: 10
            },
            money: 100,
            loans: 0,
            flags: 18,
            ready: true
        });
    }

    return {
        board: generateGrid(4),
        players,
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        phase,
        round: 1,
        markets: {
            Food: { stock: MARKET_STARTING_QUANTITIES.Food, priceIndex: MARKET_STARTING_QUANTITIES.Food },
            Energy: { stock: MARKET_STARTING_QUANTITIES.Energy, priceIndex: MARKET_STARTING_QUANTITIES.Energy },
            Labor: { stock: MARKET_STARTING_QUANTITIES.Labor, priceIndex: MARKET_STARTING_QUANTITIES.Labor },
            Ore: { stock: MARKET_STARTING_QUANTITIES.Ore, priceIndex: MARKET_STARTING_QUANTITIES.Ore },
            Capital: { stock: MARKET_STARTING_QUANTITIES.Capital, priceIndex: MARKET_STARTING_QUANTITIES.Capital }
        },
        consecutivePasses: 0,
        tilesRemaining: {
            Farm: 18,
            Generator: 18,
            Academy: 18,
            Mine: 18,
            Factory: 18,
            Bank: 18
        },
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: 18,
        initialTiles: {
            Farm: 18,
            Generator: 18,
            Academy: 18,
            Mine: 18,
            Factory: 18,
            Bank: 18
        }
    };
}

// Helper to execute an action using the real game reducer
function executeAction(state: GameState, action: string, payload?: any): GameState {
    const result = gameReducer(state, action, payload);
    if (!result.success) {
        throw new Error(`Action failed: ${result.message}`);
    }
    return result.newState!;
}

describe('Phase Transitions Integration Tests', () => {
    describe('Develop Phase → Produce Phase', () => {
        it('should advance from Develop to Produce when all players pass', () => {
            let state = createGameState('Develop', 2);

            // Player 1 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');
            expect(state.currentTurnPlayerIndex).toBe(1);
            expect(state.consecutivePasses).toBe(1);

            // Player 2 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');
            expect(state.consecutivePasses).toBe(0);
        });

        it('should advance after players place flags then all pass', () => {
            let state = createGameState('Develop', 2);

            // Player 1 places flag at (1, 0)
            state = executeAction(state, 'placeFlag', { id: '1,0' });
            expect(state.phase).toBe('Develop');
            expect(state.currentTurnPlayerIndex).toBe(1);
            expect(state.consecutivePasses).toBe(0); // Reset

            // Player 2 places flag at (2, 0)
            state = executeAction(state, 'placeFlag', { id: '2,0' });
            expect(state.phase).toBe('Develop');
            expect(state.currentTurnPlayerIndex).toBe(0); // Back to player 1
            expect(state.consecutivePasses).toBe(0); // Still reset

            // Player 1 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');
            expect(state.consecutivePasses).toBe(1);

            // Player 2 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');
            expect(state.consecutivePasses).toBe(0);
        });

        it('should reset pass count when a player takes an action', () => {
            let state = createGameState('Develop', 3);

            // Player 1 passes
            state = executeAction(state, 'pass');
            expect(state.consecutivePasses).toBe(1);

            // Player 2 passes
            state = executeAction(state, 'pass');
            expect(state.consecutivePasses).toBe(2);

            // Player 3 places flag (should reset count)
            state = executeAction(state, 'placeFlag', { id: '1,0' });
            expect(state.consecutivePasses).toBe(0);
            expect(state.phase).toBe('Develop');

            // Now all must pass again
            state = executeAction(state, 'pass'); // P1
            state = executeAction(state, 'pass'); // P2
            expect(state.phase).toBe('Develop');

            state = executeAction(state, 'pass'); // P3
            expect(state.phase).toBe('Produce');
        });
    });

    describe('Trade Phase → Develop Phase', () => {
        it('should advance from Trade to Develop when all players pass', () => {
            let state = createGameState('Trade', 2);

            expect(state.phase).toBe('Trade');

            // Player 1 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Trade');
            expect(state.consecutivePasses).toBe(1);

            // Player 2 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');
            expect(state.consecutivePasses).toBe(0);
            expect(state.currentTurnPlayerIndex).toBe(0); // Reset to first player
        });

        it('should reset pass count when players buy/sell', () => {
            let state = createGameState('Trade', 2);

            // Player 1 passes
            state = executeAction(state, 'pass');
            expect(state.consecutivePasses).toBe(1);

            // Player 2 buys (resets count)
            state = executeAction(state, 'buy', { commodity: 'Food' });
            expect(state.consecutivePasses).toBe(0);
            expect(state.phase).toBe('Trade');

            // Must pass again
            state = executeAction(state, 'pass'); // P1
            state = executeAction(state, 'pass'); // P2
            expect(state.phase).toBe('Develop');
        });

        it('should work with 3 players', () => {
            let state = createGameState('Trade', 3);

            state = executeAction(state, 'pass'); // P1
            expect(state.phase).toBe('Trade');

            state = executeAction(state, 'pass'); // P2
            expect(state.phase).toBe('Trade');

            state = executeAction(state, 'pass'); // P3
            expect(state.phase).toBe('Develop');
        });
    });

    describe('Produce Phase → Trade Phase (Next Round)', () => {
        it('should advance to next round when all players pass in Produce', () => {
            let state = createGameState('Produce', 2);

            expect(state.round).toBe(1);
            const initialFirstPlayer = state.firstPlayerIndex;

            // Player 1 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');

            // Player 2 passes
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Trade');
            expect(state.round).toBe(2);
            const expectedFirstPlayer = (initialFirstPlayer + 1) % 2; // Rotates to next player
            expect(state.currentTurnPlayerIndex).toBe(expectedFirstPlayer);
            expect(state.firstPlayerIndex).toBe(expectedFirstPlayer);
        });

        it('should rotate first player correctly over multiple rounds', () => {
            let state = createGameState('Produce', 3);

            expect(state.round).toBe(1);
            const initialFirstPlayer = state.firstPlayerIndex;

            // Complete round 1
            state = executeAction(state, 'pass'); // P1
            state = executeAction(state, 'pass'); // P2
            state = executeAction(state, 'pass'); // P3
            expect(state.round).toBe(2);
            const expectedFirstPlayer2 = (initialFirstPlayer + 1) % 3; // Next player after initial
            expect(state.currentTurnPlayerIndex).toBe(expectedFirstPlayer2);
            expect(state.firstPlayerIndex).toBe(expectedFirstPlayer2);

            // Complete round 2 (Trade → Develop → Produce → Trade)
            // Trade phase
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');

            // Develop phase
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');

            // Produce phase
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.round).toBe(3);
            const expectedFirstPlayer3 = (initialFirstPlayer + 2) % 3; // Two rotations from initial
            expect(state.currentTurnPlayerIndex).toBe(expectedFirstPlayer3);
            expect(state.firstPlayerIndex).toBe(expectedFirstPlayer3);
        });

        it('should rotate first player when confirming production for all players', () => {
            let state = createGameState('Produce', 3);

            // Let's say Player 2 (index 1) is the first player this round
            state = {
                ...state,
                firstPlayerIndex: 1,
                currentTurnPlayerIndex: 1 // Does not matter for production, but set for consistency
            };

            // Player 2 produces
            state = executeAction(state, 'confirmProduction', { activeTiles: [], playerId: 'p2' });
            expect(state.phase).toBe('Produce');
            expect(state.players.find(p => p.id === 'p2')?.hasProduced).toBe(true);

            // Player 3 produces
            state = executeAction(state, 'confirmProduction', { activeTiles: [], playerId: 'p3' });
            expect(state.phase).toBe('Produce');
            expect(state.players.find(p => p.id === 'p3')?.hasProduced).toBe(true);

            // Player 1 produces (last one)
            state = executeAction(state, 'confirmProduction', { activeTiles: [], playerId: 'p1' });

            // Now the phase should advance
            expect(state.phase).toBe('Trade');
            expect(state.round).toBe(2);
            expect(state.firstPlayerIndex).toBe(2); // Rotated from 1 to 2
            expect(state.currentTurnPlayerIndex).toBe(2); // New turn starts with new first player
            expect(state.consecutivePasses).toBe(0);
            expect(state.players.every(p => !p.hasProduced)).toBe(true); // Flags should be reset
        });
    });

    describe('Complete Phase Cycle', () => {
        it('should complete full cycle: Trade → Develop → Produce → Trade', () => {
            let state = createGameState('Trade', 2);

            expect(state.phase).toBe('Trade');
            expect(state.round).toBe(1);

            // Trade phase
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');

            // Develop phase
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');

            // Produce phase
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Trade');
            expect(state.round).toBe(2);
        });

        it('should handle mixed actions and passes', () => {
            let state = createGameState('Trade', 2);

            // Trade: buy, sell, pass, pass
            state = executeAction(state, 'buy', { commodity: 'Food' });
            state = executeAction(state, 'sell', { commodity: 'Energy' });
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');

            // Develop: place flag, place flag, pass all
            state = executeAction(state, 'placeFlag', { id: '1,0' });
            // After placing flag, it's now player 2's turn, so they place a flag
            state = executeAction(state, 'placeFlag', { id: '2,0' });
            // Back to player 1 - pass
            state = executeAction(state, 'pass');
            // Player 2 passes - all have passed
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');

            // Produce: pass, pass
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Trade');
            expect(state.round).toBe(2);
        });
    });

    describe('Turn Order', () => {
        it('should cycle through players correctly in Trade', () => {
            let state = createGameState('Trade', 3);

            expect(state.currentTurnPlayerIndex).toBe(0);

            state = executeAction(state, 'buy', { commodity: 'Food' });
            expect(state.currentTurnPlayerIndex).toBe(1);

            state = executeAction(state, 'buy', { commodity: 'Food' });
            expect(state.currentTurnPlayerIndex).toBe(2);

            state = executeAction(state, 'buy', { commodity: 'Food' });
            expect(state.currentTurnPlayerIndex).toBe(0); // Wrapped around
        });

        it('should cycle through players correctly in Develop', () => {
            let state = createGameState('Develop', 3);

            expect(state.currentTurnPlayerIndex).toBe(0);

            state = executeAction(state, 'placeFlag', { id: '1,0' });
            expect(state.currentTurnPlayerIndex).toBe(1);

            state = executeAction(state, 'placeFlag', { id: '2,0' });
            expect(state.currentTurnPlayerIndex).toBe(2);

            state = executeAction(state, 'placeFlag', { id: '1,1' });
            expect(state.currentTurnPlayerIndex).toBe(0); // Wrapped around
        });
    });

    describe('Edge Cases', () => {
        it('should work with single player', () => {
            let state = createGameState('Trade', 1);

            // Single pass should advance phase
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');

            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');

            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Trade');
            expect(state.round).toBe(2);
        });

        it('should work with 6 players', () => {
            let state = createGameState('Develop', 6);

            // All 6 must pass
            for (let i = 0; i < 5; i++) {
                state = executeAction(state, 'pass');
                expect(state.phase).toBe('Develop');
            }

            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');
        });

        it('should handle pass count correctly when interrupted', () => {
            let state = createGameState('Develop', 4);

            // P1, P2, P3 pass
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.consecutivePasses).toBe(3);

            // P4 places flag (interrupts)
            state = executeAction(state, 'placeFlag', { id: '1,0' });
            expect(state.consecutivePasses).toBe(0);

            // Now all 4 must pass again
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Develop');

            state = executeAction(state, 'pass');
            expect(state.phase).toBe('Produce');
        });
    });
});
