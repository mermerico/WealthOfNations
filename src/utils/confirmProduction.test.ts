import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import type { GameState } from '../types/gameState';

describe('confirmProduction with Mixed Automation', () => {
    it('should handle separate automated and non-automated blocs correctly', () => {
        // Create a minimal game state with two separate Factory blocs
        const state: GameState = {
            phase: 'Produce',
            currentTurnPlayerIndex: 0,
            players: [
                {
                    id: 'p1',
                    name: 'Player 1',
                    resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 5 },
                    money: 100,
                    loans: 0,
                    flags: 5,
                    color: 'red',
                    ready: true,
                    hasProduced: false,
                    hasPassed: false
                }
            ],
            board: {
                '0,0': { q: 0, r: 0, occupant: null }, // Center empty
                // Automated Factory at 1,0
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile-1',
                            type: 'Factory',
                            orientation: 0,
                            ownerId: 'p1',
                            active: true,
                            automated: true  // AUTOMATED
                        }
                    }
                },
                // Non-automated Factory at -1,0 (opposite side, not adjacent to 1,0)
                '-1,0': {
                    q: -1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile-2',
                            type: 'Factory',
                            orientation: 0,
                            ownerId: 'p1',
                            active: true,
                            automated: false  // NOT AUTOMATED
                        }
                    }
                }
            },
            markets: {
                Food: { stock: 4, priceIndex: 4 },
                Energy: { stock: 4, priceIndex: 4 },
                Labor: { stock: 4, priceIndex: 4 },
                Ore: { stock: 4, priceIndex: 4 },
                Capital: { stock: 4, priceIndex: 4 }
            },
            round: 1,
            firstPlayerIndex: 0,
            consecutivePasses: 0,
            tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 8, Bank: 10 },
            isLastRound: false,
            gameEnded: false,
            logs: [],
            setupPhase: undefined,
            initialFlagsPerPlayer: 8,
            initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
            settings: {
                promissoryNoteInterestFees: false
            }
        };

        // Run production for both tiles
        const result = gameReducer(state, 'confirmProduction', {
            playerId: 'p1',
            activeTiles: ['1,0', '-1,0']  // Both tiles
        });

        expect(result.success).toBe(true);
        if (!result.newState) throw new Error('Expected newState');

        const player = result.newState.players[0];

        // Expected costs:
        // - Automated Factory (1,0): 1 Ore + 1 Energy
        // - Non-automated Factory (-1,0): 1 Food + 1 Energy
        // Total: 1 Ore + 1 Food + 2 Energy
        expect(player.resources.Ore).toBe(9);    // 10 - 1 = 9
        expect(player.resources.Food).toBe(9);   // 10 - 1 = 9 (CRITICAL TEST)
        expect(player.resources.Energy).toBe(8); // 10 - 2 = 8
        expect(player.resources.Capital).toBe(7); // 5 + 2 = 7 (both produce 1 Capital each)
    });

    it('should correctly identify two non-adjacent tiles as separate blocs', () => {
        const state: GameState = {
            phase: 'Produce',
            currentTurnPlayerIndex: 0,
            players: [
                {
                    id: 'p1',
                    name: 'Player 1',
                    resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 5 },
                    money: 100,
                    loans: 0,
                    flags: 5,
                    color: 'red',
                    ready: true,
                    hasProduced: false,
                    hasPassed: false
                }
            ],
            board: {
                '0,0': { q: 0, r: 0, occupant: null },
                // Mine at 2,0
                '2,0': {
                    q: 2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile-1',
                            type: 'Mine',
                            orientation: 0,
                            ownerId: 'p1',
                            active: true,
                            automated: false
                        }
                    }
                },
                // Another Mine at -2,0 (far away, definitely not adjacent)
                '-2,0': {
                    q: -2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile-2',
                            type: 'Mine',
                            orientation: 0,
                            ownerId: 'p1',
                            active: true,
                            automated: false
                        }
                    }
                }
            },
            markets: {
                Food: { stock: 4, priceIndex: 4 },
                Energy: { stock: 4, priceIndex: 4 },
                Labor: { stock: 4, priceIndex: 4 },
                Ore: { stock: 4, priceIndex: 4 },
                Capital: { stock: 4, priceIndex: 4 }
            },
            round: 1,
            firstPlayerIndex: 0,
            consecutivePasses: 0,
            tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 8, Factory: 10, Bank: 10 },
            isLastRound: false,
            gameEnded: false,
            logs: [],
            setupPhase: undefined,
            initialFlagsPerPlayer: 8,
            initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
            settings: {
                promissoryNoteInterestFees: false
            }
        };

        const result = gameReducer(state, 'confirmProduction', {
            playerId: 'p1',
            activeTiles: ['2,0', '-2,0']
        });

        expect(result.success).toBe(true);
        if (!result.newState) throw new Error('Expected newState');

        const player = result.newState.players[0];

        // Two separate Mine blocs, each costs 1 Food + 1 Energy
        expect(player.resources.Food).toBe(8);   // 10 - 2 = 8
        expect(player.resources.Energy).toBe(8); // 10 - 2 = 8
        expect(player.resources.Ore).toBe(12);   // 10 + 2 = 12 (both produce 1 Ore each)
    });

    it('should handle only automated blocs', () => {
        const state: GameState = {
            phase: 'Produce',
            currentTurnPlayerIndex: 0,
            players: [
                {
                    id: 'p1',
                    name: 'Player 1',
                    resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 5 },
                    money: 100,
                    loans: 0,
                    flags: 5,
                    color: 'red',
                    ready: true,
                    hasProduced: false,
                    hasPassed: false
                }
            ],
            board: {
                '0,0': { q: 0, r: 0, occupant: null },
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile-1',
                            type: 'Mine',
                            orientation: 0,
                            ownerId: 'p1',
                            active: true,
                            automated: true
                        }
                    }
                }
            },
            markets: {
                Food: { stock: 4, priceIndex: 4 },
                Energy: { stock: 4, priceIndex: 4 },
                Labor: { stock: 4, priceIndex: 4 },
                Ore: { stock: 4, priceIndex: 4 },
                Capital: { stock: 4, priceIndex: 4 }
            },
            round: 1,
            firstPlayerIndex: 0,
            consecutivePasses: 0,
            tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 9, Factory: 10, Bank: 10 },
            isLastRound: false,
            gameEnded: false,
            logs: [],
            setupPhase: undefined,
            initialFlagsPerPlayer: 8,
            initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
            settings: {
                promissoryNoteInterestFees: false
            }
        };

        const result = gameReducer(state, 'confirmProduction', {
            playerId: 'p1',
            activeTiles: ['1,0']
        });

        expect(result.success).toBe(true);
        if (!result.newState) throw new Error('Expected newState');

        const player = result.newState.players[0];

        // Automated Mine costs 1 Ore + 1 Energy
        expect(player.resources.Ore).toBe(10);   // 10 - 1 + 1 = 10 (net zero)
        expect(player.resources.Food).toBe(10);  // Unchanged (not used for automated)
        expect(player.resources.Energy).toBe(9); // 10 - 1 = 9
    });
});
