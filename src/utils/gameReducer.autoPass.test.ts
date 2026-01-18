import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { createInitialGameState } from '../shared/gameEngine';
import type { GameState } from '../types/gameState';

describe('Auto-Pass Logic', () => {
    const initialState = createInitialGameState({
        playerCount: 3,
        playerNames: ['Alice', 'Bob', 'Charlie']
    });

    // Set phase to Trade for easier testing of pass logic
    const tradeState: GameState = {
        ...initialState,
        phase: 'Trade',
        currentTurnPlayerIndex: 0,
        players: initialState.players.map(p => ({ ...p, hasPassed: false, autoPass: false }))
    };

    it('should allow toggling autoPass', () => {
        const result = gameReducer(tradeState, 'toggleAutoPass', { playerId: 'p1', enabled: true });
        expect(result.success).toBe(true);
        expect(result.newState?.players[0].autoPass).toBe(true);

        const result2 = gameReducer(result.newState!, 'toggleAutoPass', { playerId: 'p1', enabled: false });
        expect(result2.success).toBe(true);
        expect(result2.newState?.players[0].autoPass).toBe(false);
    });

    it('should NOT skip a player who has autoPass enabled (client handles it)', () => {
        // Setup: P2 has autoPass enabled
        const stateWithAutoPass = {
            ...tradeState,
            players: tradeState.players.map((p, i) => i === 1 ? { ...p, autoPass: true } : p)
        };

        // P1 passes
        const result = gameReducer(stateWithAutoPass, 'pass');
        expect(result.success).toBe(true);

        // Should go to P2 (because reducer doesn't auto-skip anymore, client does)
        expect(result.newState?.currentTurnPlayerIndex).toBe(1);

        // P1 should be marked as passed
        expect(result.newState?.players[0].hasPassed).toBe(true);
        // P2 has NOT passed yet
        expect(result.newState?.players[1].hasPassed).toBe(false);
    });

    // Remainder of tests are invalid because reducer no longer handles skipping.
    // Keeping only state management tests.

    it('should reset autoPass when changing phase manually', () => {
        // Setup: P1 and P2 passed. P3 passes manually (no auto-pass set).
        // Verify autoPass flags (if set on others) are cleared.
        const state = {
            ...tradeState,
            currentTurnPlayerIndex: 2,
            consecutivePasses: 2,
            players: tradeState.players.map((p, i) =>
                (i === 0 || i === 1) ? { ...p, hasPassed: true, autoPass: true } : p
            )
        };

        const result = gameReducer(state, 'pass');
        expect(result.newState?.phase).toBe('Develop');
        expect(result.newState?.players[0].autoPass).toBe(false);
        expect(result.newState?.players[1].autoPass).toBe(false);
    });
});
