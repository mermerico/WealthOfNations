import { describe, it, expect } from 'vitest';
import { generateGrid } from '../../utils/hexUtils';
import { gameReducer } from '../../utils/gameReducer';
import type { GameState, Player, HexCell, IndustryTile } from '../../types/gameState';
import { MARKET_STARTING_QUANTITIES } from '../../utils/marketPrices';

/**
 * Integration tests for the Move Industry action.
 * 
 * These tests use the ACTUAL game reducer (not mocks) to verify:
 * - Move costs (base cost, force cost)
 * - Move validation (destination, dot alignment)
 * - Undo mechanics (moving tiles back)
 * - Multi-move sequences (1-3 moves per turn)
 * - Flag refunds when moving onto owned flags
 */

// Helper to create a game state in Develop phase with tiles already placed
function createDevelopState(playerCount: number = 2): GameState {
    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][i],
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
        phase: 'Develop',
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
            Farm: 18, Generator: 18, Academy: 18,
            Mine: 18, Factory: 18, Bank: 18
        },
        settings: {
            promissoryNoteInterestFees: false
        },
        logs: []
    };
}

// Helper to place a tile directly on the board
function placeTileOnBoard(state: GameState, cellId: string, playerId: string, tileType: 'Farm' | 'Generator' | 'Academy' | 'Mine' | 'Factory' | 'Bank', orientation: number = 0): GameState {
    const cell = state.board[cellId];
    if (!cell) throw new Error(`Cell ${cellId} not found`);

    const tile: IndustryTile = {
        id: `tile-${cellId}`,
        type: tileType,
        ownerId: playerId,
        orientation,
        active: false
    };

    return {
        ...state,
        board: {
            ...state.board,
            [cellId]: {
                ...cell,
                occupant: {
                    type: 'Industry',
                    playerId,
                    tile
                }
            }
        }
    };
}

// Helper to place a flag on the board
function placeFlagOnBoard(state: GameState, cellId: string, playerId: string): GameState {
    const cell = state.board[cellId];
    if (!cell) throw new Error(`Cell ${cellId} not found`);

    return {
        ...state,
        board: {
            ...state.board,
            [cellId]: {
                ...cell,
                occupant: {
                    type: 'Flag',
                    playerId
                }
            }
        }
    };
}

// Helper to execute an action
function executeAction(state: GameState, action: string, payload?: any): { state: GameState, success: boolean, message?: string } {
    const result = gameReducer(state, action, payload);
    if (!result.success) {
        return { state, success: false, message: result.message };
    }
    return { state: result.newState!, success: true };
}

// Helper that throws on failure
function mustExecute(state: GameState, action: string, payload?: any): GameState {
    const result = gameReducer(state, action, payload);
    if (!result.success) {
        throw new Error(`Action failed: ${result.message}`);
    }
    return result.newState!;
}

describe('Move Industry Integration Tests', () => {
    describe('Basic Move Operations', () => {
        it('should move a tile from one cell to an empty cell', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            // Move the tile
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            // Verify tile moved
            expect(state.board['1,0'].occupant).toBeNull();
            expect(state.board['2,0'].occupant?.type).toBe('Industry');
            expect(state.board['2,0'].occupant?.tile?.type).toBe('Farm');

            // Verify cost was deducted (1 Capital base cost)
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);
        });

        it('should fail to move to center tile (0,0)', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '0,0'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('center');
        });

        it('should fail to move another player\'s tile', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p2', 'Farm'); // P2's tile

            // P1 tries to move P2's tile
            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid source');
        });

        it('should fail to move to an occupied cell', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');
            state = placeTileOnBoard(state, '2,0', 'p2', 'Generator');

            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid destination');
        });
    });

    describe('Move Costs', () => {
        it('should charge 1 Capital for base move', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);
        });

        it('should charge 0 Capital when skipBaseCost is true', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0',
                    skipBaseCost: true
                }]
            });

            expect(state.players[0].resources.Capital).toBe(initialCapital); // No cost
        });

        it('should charge extra 1 Capital when force is true', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0',
                    force: true
                }]
            });

            // 1 base + 1 force = 2
            expect(state.players[0].resources.Capital).toBe(initialCapital - 2);
        });

        it('should charge only force cost when skipBaseCost + force', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0',
                    skipBaseCost: true,
                    force: true
                }]
            });

            // 0 base + 1 force = 1
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);
        });

        it('should fail move when player has insufficient Capital', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            // Set Capital to 0
            state = {
                ...state,
                players: state.players.map((p, i) =>
                    i === 0 ? { ...p, resources: { ...p.resources, Capital: 0 } } : p
                )
            };

            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Capital');
        });
    });

    describe('Flag Refund on Move', () => {
        it('should refund flag when moving onto own flag', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');
            state = placeFlagOnBoard(state, '2,0', 'p1');

            const initialFlags = state.players[0].flags;

            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            // Flag should be refunded
            expect(state.players[0].flags).toBe(initialFlags + 1);
            // Tile should be at destination
            expect(state.board['2,0'].occupant?.type).toBe('Industry');
        });

        it('should NOT refund flag when moving to empty cell', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialFlags = state.players[0].flags;

            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(state.players[0].flags).toBe(initialFlags); // No change
        });

        it('should fail to move onto another player\'s flag', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');
            state = placeFlagOnBoard(state, '2,0', 'p2'); // P2's flag

            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid destination');
        });
    });

    describe('Multi-Move Sequences', () => {
        it('should allow 3 moves in one sequence', () => {
            let state = createDevelopState();
            // Place tiles in separate locations that won't have adjacency issues
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');
            state = placeTileOnBoard(state, '-1,0', 'p1', 'Farm'); // Opposite side
            state = placeTileOnBoard(state, '0,-1', 'p1', 'Farm'); // Different direction

            const initialCapital = state.players[0].resources.Capital;

            // Submit 3 moves in one batch
            // Move 1: 1,0 -> 1,1 (Base Cost 1)
            // Move 2: -1,0 -> -1,1 (Free)
            // Move 3: 0,-1 -> 0,-2 (Free)
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [
                    { fromId: '1,0', toId: '1,1' },
                    { fromId: '-1,0', toId: '-1,1', skipBaseCost: true },
                    { fromId: '0,-1', toId: '0,-2', skipBaseCost: true }
                ]
            });

            // Verify total cost is 1
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);

            // Verify all tiles moved
            expect(state.board['1,0'].occupant).toBeNull();
            expect(state.board['1,1'].occupant?.tile?.type).toBe('Farm');
            expect(state.board['-1,0'].occupant).toBeNull();
            expect(state.board['-1,1'].occupant?.tile?.type).toBe('Farm');
            expect(state.board['0,-1'].occupant).toBeNull();
            expect(state.board['0,-2'].occupant?.tile?.type).toBe('Farm');
        });
    });

    describe('Undo Move Operations', () => {
        it('should allow undoing a move by moving tile back (at no cost with skipBaseCost)', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            // Do the move
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(state.board['2,0'].occupant?.tile?.type).toBe('Farm');
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);

            // Manually reset turn to allow Undo (since moveSequence ends turn)
            state = { ...state, currentTurnPlayerIndex: 0 };

            // Undo by moving back (with skipBaseCost and NO force)
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '2,0',
                    toId: '1,0',
                    skipBaseCost: true,
                    force: false // NO COST for undo
                }]
            });

            // Tile should be back
            expect(state.board['1,0'].occupant?.tile?.type).toBe('Farm');
            expect(state.board['2,0'].occupant).toBeNull();

            // Undo should NOT cost extra (skipBaseCost: true, force: false)
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);
        });

        it('should successfully undo even with 0 Capital when skipBaseCost and no force', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            // Do the move first
            state = mustExecute(state, 'moveIndustry', {
                fromId: '1,0',
                toId: '2,0',
                extraTurns: true
            });

            // Set Capital to 0 to simulate spent resources
            state = {
                ...state,
                players: state.players.map((p, i) =>
                    i === 0 ? { ...p, resources: { ...p.resources, Capital: 0 } } : p
                )
            };

            // Manually reset turn
            state = { ...state, currentTurnPlayerIndex: 0 };

            // Undo should still work with skipBaseCost and no force
            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '2,0',
                    toId: '1,0',
                    skipBaseCost: true,
                    force: false
                }]
            });

            expect(result.success).toBe(true);
            expect(result.state.board['1,0'].occupant?.tile?.type).toBe('Farm');
        });

        it('should FAIL undo with force:true when player has 0 Capital', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            // Do the move first
            state = mustExecute(state, 'moveIndustry', {
                fromId: '1,0',
                toId: '2,0',
                extraTurns: true
            });

            // Set Capital to 0
            state = {
                ...state,
                players: state.players.map((p, i) =>
                    i === 0 ? { ...p, resources: { ...p.resources, Capital: 0 } } : p
                )
            };

            // Manually reset turn
            state = { ...state, currentTurnPlayerIndex: 0 };

            // Undo with force:true should FAIL (costs 1 Capital)
            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '2,0',
                    toId: '1,0',
                    skipBaseCost: true,
                    force: true // This costs 1 Capital!
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Capital');
        });

        it('should allow moving same tile twice and undoing both moves', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            // First move (pays base cost = 1)
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(state.board['2,0'].occupant?.tile?.type).toBe('Farm');
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1);

            // Manually reset turn
            state = { ...state, currentTurnPlayerIndex: 0 };

            // Second move of same tile (skipBaseCost, so free)
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '2,0',
                    toId: '3,0',
                    skipBaseCost: true
                }]
            });

            expect(state.board['3,0'].occupant?.tile?.type).toBe('Farm');
            expect(state.board['2,0'].occupant).toBeNull();
            expect(state.players[0].resources.Capital).toBe(initialCapital - 1); // Still just 1 spent

            // Manually reset turn
            state = { ...state, currentTurnPlayerIndex: 0 };

            // Undo second move (move back from 3,0 to 2,0)
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '3,0',
                    toId: '2,0',
                    skipBaseCost: true,
                    force: true // Use force to ensure it can move back
                }]
            });

            expect(state.board['2,0'].occupant?.tile?.type).toBe('Farm');
            expect(state.board['3,0'].occupant).toBeNull();

            // Manually reset turn
            state = { ...state, currentTurnPlayerIndex: 0 };

            // Undo first move (move back from 2,0 to 1,0)
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '2,0',
                    toId: '1,0',
                    skipBaseCost: true,
                    force: true
                }]
            });

            // Tile should be back at original position
            expect(state.board['1,0'].occupant?.tile?.type).toBe('Farm');
            expect(state.board['2,0'].occupant).toBeNull();
        });
    });

    describe('Phase Restrictions', () => {
        it('should only allow moves in Develop phase', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            // Change to Trade phase
            state = { ...state, phase: 'Trade' };

            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Develop phase');
        });

        it('should not allow moves in Produce phase', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            state = { ...state, phase: 'Produce' };

            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(result.success).toBe(false);
        });
    });

    describe('Failed Move Validation', () => {
        it('should NOT increment move counter when move fails', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');
            state = placeTileOnBoard(state, '2,0', 'p2', 'Generator'); // Occupied by P2

            const initialCapital = state.players[0].resources.Capital;

            // Try to move to an occupied cell (should fail)
            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            // Move should fail
            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid destination');

            // State should be unchanged (no Capital deducted)
            expect(result.state.players[0].resources.Capital).toBe(initialCapital);

            // Tile should still be at original location
            expect(result.state.board['1,0'].occupant?.tile?.type).toBe('Farm');
        });

        it('should NOT increment move counter when moving to center tile', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            const initialCapital = state.players[0].resources.Capital;

            // Try to move to center (0,0) - should fail
            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '0,0'
                }]
            });

            // Move should fail
            expect(result.success).toBe(false);
            expect(result.message).toContain('center');

            // State should be unchanged
            expect(result.state.players[0].resources.Capital).toBe(initialCapital);
            expect(result.state.board['1,0'].occupant?.tile?.type).toBe('Farm');
        });

        it('should NOT increment move counter when moving to opponent flag', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');
            state = placeFlagOnBoard(state, '2,0', 'p2'); // P2's flag

            const initialCapital = state.players[0].resources.Capital;

            // Try to move onto opponent's flag (should fail)
            const result = executeAction(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            // Move should fail
            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid destination');

            // State should be unchanged
            expect(result.state.players[0].resources.Capital).toBe(initialCapital);
            expect(result.state.board['1,0'].occupant?.tile?.type).toBe('Farm');
        });
    });

    describe('Consecutive Passes Reset', () => {
        it('should reset consecutivePasses when move is performed', () => {
            let state = createDevelopState();
            state = placeTileOnBoard(state, '1,0', 'p1', 'Farm');

            // Simulate that P1 passed
            state = { ...state, consecutivePasses: 1 };

            // P1 does a move instead
            state = mustExecute(state, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0'
                }]
            });

            expect(state.consecutivePasses).toBe(0);
        });
    });
});
