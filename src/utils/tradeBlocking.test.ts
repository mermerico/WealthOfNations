
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { createInitialGameState } from '../shared/gameEngine';
import type { GameState, CommodityType } from '../types/gameState';

describe('Trade Blocking Logic', () => {
    // Helper to setup a pending trade state
    const setupPendingTrade = (): GameState => {
        const initialState = createInitialGameState({
            playerCount: 3,
            randomizeFirstPlayer: false,
            firstPlayerIndex: 0
        });

        // Advance to Trade phase
        let state = { ...initialState, phase: 'Trade' as const };

        // Give P1 some money to buy things
        const p1 = state.players[0];
        const p2 = state.players[1];

        const playersWithResources = state.players.map(p => {
            if (p.id === 'p1') return { ...p, money: 100, resources: { ...p.resources, Food: 5 } };
            // Give P2 Energy so they can fulfill the trade (receive Food, give Energy)
            if (p.id === 'p2') return { ...p, money: 100, resources: { ...p.resources, Energy: 5 } };
            return p;
        });

        state = { ...state, players: playersWithResources };

        // P1 proposes trade to P2
        const result = gameReducer(state, 'proposeTrade', {
            proposerId: 'p1',
            targetId: 'p2',
            giving: { commodities: { Food: 1 }, money: 0, loans: 0 },
            receiving: { commodities: { Energy: 1 }, money: 0, loans: 0 }
        });

        if (!result.success || !result.newState) throw new Error('Failed to setup pending trade');
        return result.newState;
    };

    it('blocks proposer from buying commodities', () => {
        const state = setupPendingTrade();

        // P1 tries to buy
        const result = gameReducer(state, 'buy', 'Food');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/pending trade/i);
    });

    it('blocks proposer from selling commodities', () => {
        const state = setupPendingTrade();

        // P1 tries to sell
        const result = gameReducer(state, 'sell', 'Food');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/pending trade/i);
    });

    it('blocks proposer from passing', () => {
        const state = setupPendingTrade();

        // P1 tries to pass
        const result = gameReducer(state, 'pass');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/pending trade/i);
    });

    it('blocks proposer from taking loans', () => {
        const state = setupPendingTrade();

        // P1 tries to take loan
        const result = gameReducer(state, 'takeLoan');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/pending trade/i);
    });

    it('blocks proposer from repaying loans', () => {
        const state = setupPendingTrade();

        // P1 tries to repay loan
        const result = gameReducer(state, 'repayLoan');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/pending trade/i);
    });

    it('blocks proposer from proposing another trade', () => {
        const state = setupPendingTrade();

        // P1 tries to propose another trade
        const result = gameReducer(state, 'proposeTrade', {
            proposerId: 'p1',
            targetId: 'p3',
            giving: { commodities: { Food: 1 }, money: 0, loans: 0 },
            receiving: { commodities: { Energy: 1 }, money: 0, loans: 0 }
        });

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/trade is already pending/i); // Existing message
    });

    it('allows target to accept trade', () => {
        const state = setupPendingTrade();

        // P2 (target) accepts
        // gameReducer doesn't check *who* called it (that's server/UI job), 
        // but checking 'acceptTrade' logic itself should still work
        const result = gameReducer(state, 'acceptTrade');

        expect(result.success).toBe(true);
        expect(result.newState?.pendingTrade).toBeNull();
    });

    it('allows target to reject trade', () => {
        const state = setupPendingTrade();

        // P2 (target) rejects
        const result = gameReducer(state, 'rejectTrade');

        expect(result.success).toBe(true);
        expect(result.newState?.pendingTrade).toBeNull();
    });

    // Additional check: Does it block unaffected players? 
    // The reducer usually checks "currentTurnPlayerIndex".
    // If P1 is current turn, P3 shouldn't be acting anyway.
    // If P1 proposed to P2, usually P1 is the current turn player.
    // The gameReducer logic implicitly handles current player actions. 
    // So if P1 is blocked, no one else can act until P1's turn is resolved (unless synchronous play).
    // But since `buy` / `sell` checks `state.players[state.currentTurnPlayerIndex]`, 
    // it effectively blocks the turn player.
});
