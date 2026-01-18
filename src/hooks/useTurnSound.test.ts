import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTurnSound } from './useTurnSound';
import type { GameState, Player, TradeOffer } from '../types/gameState';

// Mock Audio
const mockPlay = vi.fn().mockResolvedValue(undefined);

// Create a simple mock Audio class
class MockAudio {
    currentTime = 0;
    play = mockPlay;
    pause = vi.fn();

    constructor(public src: string) { }
}

describe('useTurnSound', () => {
    beforeEach(() => {
        // Set up window.Audio mock
        (window as any).Audio = MockAudio;

        vi.clearAllMocks();

        // Reset navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            value: false,
            writable: true,
            configurable: true
        });
    });

    // Mock Game State Helper
    const createMockGameState = (overrides: Partial<GameState> = {}): GameState => ({
        players: [
            {
                id: 'p1',
                name: 'Player 1',
                color: '#ff0000',
                resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
                money: 0,
                flags: 0,
                loans: 0,
                ready: false,
                autoPass: false
            } as Player,
            {
                id: 'p2',
                name: 'Player 2',
                color: '#00ff00',
                resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
                money: 0,
                flags: 0,
                loans: 0,
                ready: false,
                autoPass: false
            } as Player,
        ],
        board: {},
        markets: {
            Food: { stock: 4, priceIndex: 4 },
            Energy: { stock: 4, priceIndex: 4 },
            Labor: { stock: 4, priceIndex: 4 },
            Ore: { stock: 4, priceIndex: 4 },
            Capital: { stock: 4, priceIndex: 4 },
        },
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        phase: 'Trade',
        round: 1,
        pendingTrade: null,
        gameEnded: false,
        consecutivePasses: 0,
        tilesRemaining: {
            Farm: 10,
            Generator: 10,
            Academy: 10,
            Mine: 10,
            Factory: 10,
            Bank: 10,
        },
        isLastRound: false,
        initialFlagsPerPlayer: 10,
        initialTiles: {
            Farm: 10,
            Generator: 10,
            Academy: 10,
            Mine: 10,
            Factory: 10,
            Bank: 10,
        },
        settings: {
            promissoryNoteInterestFees: false,
        },
        logs: [],
        ...overrides,
    });

    const emptyOffer: TradeOffer = { commodities: {}, money: 0, loans: 0 };

    // Helper to render hook
    const renderSoundHook = (
        initialState: GameState,
        mode: 'local' | 'remote' = 'local',
        selfPlayerId: string | null = null
    ) => {
        return renderHook(
            ({ gameState, mode, selfPlayer }) => useTurnSound(gameState, mode, selfPlayer),
            {
                initialProps: {
                    gameState: initialState,
                    mode,
                    selfPlayer: selfPlayerId ? { playerId: selfPlayerId } : null
                }
            }
        );
    };

    describe('Local Hotseat Mode', () => {
        it('should play sound when turn changes between players', () => {
            const state1 = createMockGameState({ currentTurnPlayerIndex: 0 });
            const { rerender } = renderSoundHook(state1, 'local');

            const state2 = createMockGameState({ currentTurnPlayerIndex: 1 });
            rerender({ gameState: state2, mode: 'local', selfPlayer: null });

            expect(mockPlay).toHaveBeenCalledTimes(1);
        });

        it('should play sound when entering Produce phase', () => {
            const state1 = createMockGameState({ phase: 'Develop' });
            const { rerender } = renderSoundHook(state1, 'local');

            const state2 = createMockGameState({ phase: 'Produce' });
            rerender({ gameState: state2, mode: 'local', selfPlayer: null });

            expect(mockPlay).toHaveBeenCalledTimes(1);
        });

        it('should play sound when receiving a trade proposal', () => {
            const state1 = createMockGameState({ pendingTrade: null });
            const { rerender } = renderSoundHook(state1, 'local');

            const state2 = createMockGameState({
                pendingTrade: {
                    proposerId: 'p1',
                    targetId: 'p2',
                    giving: emptyOffer,
                    receiving: emptyOffer
                }
            });
            rerender({ gameState: state2, mode: 'local', selfPlayer: null });

            expect(mockPlay).toHaveBeenCalledTimes(1);
        });

        it('should NOT play sound if auto-pass is enabled for the new turn player', () => {
            const state1 = createMockGameState({ currentTurnPlayerIndex: 0 });
            const { rerender } = renderSoundHook(state1, 'local');

            const state2 = createMockGameState({
                currentTurnPlayerIndex: 1,
                players: [
                    {
                        id: 'p1',
                        name: 'P1',
                        color: '#ff0000',
                        resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
                        money: 0,
                        flags: 0,
                        loans: 0,
                        ready: false,
                        autoPass: false
                    } as Player,
                    {
                        id: 'p2',
                        name: 'P2',
                        color: '#00ff00',
                        resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
                        money: 0,
                        flags: 0,
                        loans: 0,
                        ready: false,
                        autoPass: true
                    } as Player
                ]
            });
            rerender({ gameState: state2, mode: 'local', selfPlayer: null });

            expect(mockPlay).not.toHaveBeenCalled();
        });
    });

    describe('Remote Multiplayer Mode', () => {
        const SELF_ID = 'p1';
        const OTHER_ID = 'p2';

        it('should play sound when it becomes YOUR turn', () => {
            const state1 = createMockGameState({ currentTurnPlayerIndex: 1 }); // Player 2's turn
            const { rerender } = renderSoundHook(state1, 'remote', SELF_ID);

            const state2 = createMockGameState({ currentTurnPlayerIndex: 0 }); // Player 1's turn (Self)
            rerender({ gameState: state2, mode: 'remote', selfPlayer: { playerId: SELF_ID } });

            expect(mockPlay).toHaveBeenCalledTimes(1);
        });

        it('should NOT play sound when it becomes OTHER player turn', () => {
            const state1 = createMockGameState({ currentTurnPlayerIndex: 0 }); // Player 1's turn
            const { rerender } = renderSoundHook(state1, 'remote', SELF_ID);

            const state2 = createMockGameState({ currentTurnPlayerIndex: 1 }); // Player 2's turn (Other)
            rerender({ gameState: state2, mode: 'remote', selfPlayer: { playerId: SELF_ID } });

            expect(mockPlay).not.toHaveBeenCalled();
        });

        it('should play sound when YOU receive a trade proposal', () => {
            const state1 = createMockGameState({ pendingTrade: null });
            const { rerender } = renderSoundHook(state1, 'remote', SELF_ID);

            const state2 = createMockGameState({
                pendingTrade: {
                    proposerId: OTHER_ID,
                    targetId: SELF_ID, // Target is Self
                    giving: emptyOffer,
                    receiving: emptyOffer
                }
            });
            rerender({ gameState: state2, mode: 'remote', selfPlayer: { playerId: SELF_ID } });

            expect(mockPlay).toHaveBeenCalledTimes(1);
        });

        it('should NOT play sound when SOMEONE ELSE receives a trade proposal', () => {
            const state1 = createMockGameState({ pendingTrade: null });
            const { rerender } = renderSoundHook(state1, 'remote', SELF_ID);

            const state2 = createMockGameState({
                pendingTrade: {
                    proposerId: SELF_ID,
                    targetId: OTHER_ID, // Target is Other
                    giving: emptyOffer,
                    receiving: emptyOffer
                }
            });
            rerender({ gameState: state2, mode: 'remote', selfPlayer: { playerId: SELF_ID } });

            expect(mockPlay).not.toHaveBeenCalled();
        });

        it('should play sound for Produce phase (affects everyone)', () => {
            const state1 = createMockGameState({ phase: 'Develop' });
            const { rerender } = renderSoundHook(state1, 'remote', SELF_ID);

            const state2 = createMockGameState({ phase: 'Produce' });
            rerender({ gameState: state2, mode: 'remote', selfPlayer: { playerId: SELF_ID } });

            expect(mockPlay).toHaveBeenCalledTimes(1);
        });
    });
});
