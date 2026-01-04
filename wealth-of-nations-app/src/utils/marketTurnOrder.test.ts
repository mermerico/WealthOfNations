import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import type { GameState } from '../types/gameState';
import { generateGrid } from './hexUtils';

describe('Market Transaction Turn Order', () => {
    const createTestState = (playerCount: number = 3): GameState => ({
        players: Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            color: '#fff',
            resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
            money: 100,
            loans: 0,
            flags: 18,
            ready: true,
            flag: 'test.svg',
            hasPassed: false
        })),
        board: generateGrid(4),
        markets: {
            Food: { stock: 4, priceIndex: 4 },
            Energy: { stock: 4, priceIndex: 4 },
            Labor: { stock: 4, priceIndex: 4 },
            Ore: { stock: 4, priceIndex: 4 },
            Capital: { stock: 4, priceIndex: 4 }
        },
        phase: 'Trade',
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        round: 1,
        consecutivePasses: 0,
        tilesRemaining: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        },
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: 18,
        initialTiles: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        }
    });

    it('should advance to next player after buying', () => {
        const state = createTestState(3);
        const result = gameReducer(state, 'buy', 'Food');

        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);
    });

    it('should advance to next player after selling', () => {
        const state = createTestState(3);
        const result = gameReducer(state, 'sell', 'Food');

        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);
    });

    it('should wrap around to player 0 after last player trades', () => {
        const state = createTestState(3);
        state.currentTurnPlayerIndex = 2; // Last player
        const result = gameReducer(state, 'buy', 'Food');

        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(0);
    });

    it('should not mark any player as passed after buying', () => {
        const state = createTestState(3);
        // Ensure all players start without having passed
        expect(state.players.every(p => !p.hasPassed)).toBe(true);

        const result = gameReducer(state, 'buy', 'Food');

        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);

        // Critical: NO player should be marked as passed after a buy action
        expect(result.newState?.players[0].hasPassed).toBe(false); // Player who just acted
        expect(result.newState?.players[1].hasPassed).toBe(false); // New current player
        expect(result.newState?.players[2].hasPassed).toBe(false); // Other player

        // Verify all players are not passed
        expect(result.newState?.players.every(p => !p.hasPassed)).toBe(true);
    });

    it('should not mark any player as passed after selling', () => {
        const state = createTestState(3);
        expect(state.players.every(p => !p.hasPassed)).toBe(true);

        const result = gameReducer(state, 'sell', 'Food');

        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);

        // Critical: NO player should be marked as passed after a sell action
        expect(result.newState?.players[0].hasPassed).toBe(false);
        expect(result.newState?.players[1].hasPassed).toBe(false);
        expect(result.newState?.players[2].hasPassed).toBe(false);

        expect(result.newState?.players.every(p => !p.hasPassed)).toBe(true);
    });

    it('should reset hasPassed flag when player trades', () => {
        const state = createTestState(3);
        state.players[0].hasPassed = true;

        const result = gameReducer(state, 'buy', 'Food');

        expect(result.success).toBe(true);
        expect(result.newState?.players[0].hasPassed).toBe(false);
    });

    it('should advance through all players in sequence', () => {
        let state = createTestState(4);

        // Player 0 buys
        let result = gameReducer(state, 'buy', 'Food');
        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);
        state = result.newState!;

        // Player 1 sells
        result = gameReducer(state, 'sell', 'Energy');
        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(2);
        state = result.newState!;

        // Player 2 buys
        result = gameReducer(state, 'buy', 'Labor');
        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(3);
        state = result.newState!;

        // Player 3 sells
        result = gameReducer(state, 'sell', 'Ore');
        expect(result.success).toBe(true);
        expect(result.newState?.currentTurnPlayerIndex).toBe(0); // Wrap around
    });

    it('should not skip any players in a trade round', () => {
        let state = createTestState(3);
        const tradedPlayers: number[] = [];

        // Each player trades once
        for (let i = 0; i < 3; i++) {
            tradedPlayers.push(state.currentTurnPlayerIndex);
            const result = gameReducer(state, 'buy', 'Food');
            expect(result.success).toBe(true);
            state = result.newState!;
        }

        // Verify all players traded in order
        expect(tradedPlayers).toEqual([0, 1, 2]);
        expect(state.currentTurnPlayerIndex).toBe(0); // Back to start
    });
});

describe('First Player Token Rotation', () => {
    const createEndOfRoundState = (): GameState => ({
        players: Array.from({ length: 3 }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            color: '#fff',
            resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
            money: 0,
            loans: 0,
            flags: 18,
            ready: true,
            flag: 'test.svg',
            hasPassed: false
        })),
        board: generateGrid(4),
        markets: {
            Food: { stock: 4, priceIndex: 4 },
            Energy: { stock: 4, priceIndex: 4 },
            Labor: { stock: 4, priceIndex: 4 },
            Ore: { stock: 4, priceIndex: 4 },
            Capital: { stock: 4, priceIndex: 4 }
        },
        phase: 'Produce',
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        round: 1,
        consecutivePasses: 2, // All players except one have passed
        tilesRemaining: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        },
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: 18,
        initialTiles: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        }
    });

    it('should rotate first player when advancing from Produce to Trade', () => {
        const state = createEndOfRoundState();
        state.firstPlayerIndex = 0;

        const result = gameReducer(state, 'pass');

        expect(result.success).toBe(true);
        expect(result.newState?.phase).toBe('Trade');
        expect(result.newState?.firstPlayerIndex).toBe(1);
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);
        expect(result.newState?.round).toBe(2);
    });

    it('should wrap first player back to 0 after last player', () => {
        const state = createEndOfRoundState();
        state.firstPlayerIndex = 2; // Last player

        const result = gameReducer(state, 'pass');

        expect(result.success).toBe(true);
        expect(result.newState?.firstPlayerIndex).toBe(0);
        expect(result.newState?.currentTurnPlayerIndex).toBe(0);
    });

    it('should rotate first player correctly in 4-player game', () => {
        const state = createEndOfRoundState();
        // Add 4th player
        state.players.push({
            id: 'p4',
            name: 'Player 4',
            color: '#fff',
            resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
            money: 0,
            loans: 0,
            flags: 18,
            ready: true,
            flag: 'test.svg',
            hasPassed: false
        });
        state.consecutivePasses = 3; // All 4 players must pass
        state.firstPlayerIndex = 1;

        const result = gameReducer(state, 'pass');

        expect(result.success).toBe(true);
        expect(result.newState?.firstPlayerIndex).toBe(2);
    });

    it('should track first player across multiple rounds', () => {
        let state = createEndOfRoundState();
        const firstPlayerHistory: number[] = [state.firstPlayerIndex];

        // Simulate 5 rounds - need all players to pass for round to end
        // In Produce phase, once all players pass, it advances to next round
        for (let round = 0; round < 5; round++) {
            // Set consecutivePasses to one less than needed, so next pass triggers transition
            state.consecutivePasses = state.players.length - 1;

            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            expect(result.newState?.phase).toBe('Trade'); // Should have advanced to Trade
            expect(result.newState?.round).toBe(state.round + 1); // Round should increment

            state = result.newState!;
            firstPlayerHistory.push(state.firstPlayerIndex);

            // Advance back to Produce phase for next iteration
            state.phase = 'Produce';
            state.consecutivePasses = 0;
        }

        // Should rotate through all players
        expect(firstPlayerHistory).toEqual([0, 1, 2, 0, 1, 2]);
    });

    it('should not rotate first player during Trade or Develop phases', () => {
        let state = createEndOfRoundState();
        state.phase = 'Trade';
        state.consecutivePasses = 2;
        state.firstPlayerIndex = 1;

        // Pass to end Trade phase
        const result1 = gameReducer(state, 'pass');
        expect(result1.success).toBe(true);
        expect(result1.newState?.phase).toBe('Develop');
        expect(result1.newState?.firstPlayerIndex).toBe(1); // Should not change

        state = result1.newState!;
        state.consecutivePasses = 2;

        // Pass to end Develop phase
        const result2 = gameReducer(state, 'pass');
        expect(result2.success).toBe(true);
        expect(result2.newState?.phase).toBe('Produce');
        expect(result2.newState?.firstPlayerIndex).toBe(1); // Should not change
    });

    it('should clear hasPassed flags when starting new round', () => {
        const state = createEndOfRoundState();
        state.players.forEach(p => p.hasPassed = true);

        const result = gameReducer(state, 'pass');

        expect(result.success).toBe(true);
        expect(result.newState?.players.every(p => !p.hasPassed)).toBe(true);
    });
});
