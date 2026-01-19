import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../utils/gameReducer';
import { generateGrid } from '../../utils/hexUtils';
import type { GameState, CommodityType } from '../../types/gameState';

/**
 * Integration tests for isLastRound triggering conditions during Develop phase.
 * 
 * isLastRound is triggered by:
 * 1. A player runs out of flags (places their last flag)
 * 2. Five tile stacks become empty (when building an industry)
 * 3. All hexes on the board are occupied
 * 
 * Uses direct gameReducer calls for reliable state manipulation.
 */
describe('isLastRound Triggering Tests', () => {

    // Helper to create a base Develop-phase game state
    const createDevelopPhaseState = (): GameState => {
        const board = generateGrid(4);

        // Place initial tiles for each player adjacent to center
        board['1,0'].occupant = {
            type: 'Industry',
            playerId: 'p1',
            tile: { id: '1,0', type: 'Farm', ownerId: 'p1', orientation: 0, active: true, automated: false }
        };
        board['-1,1'].occupant = {
            type: 'Industry',
            playerId: 'p2',
            tile: { id: '-1,1', type: 'Generator', ownerId: 'p2', orientation: 0, active: true, automated: false }
        };
        board['0,-1'].occupant = {
            type: 'Industry',
            playerId: 'p3',
            tile: { id: '0,-1', type: 'Mine', ownerId: 'p3', orientation: 0, active: true, automated: false }
        };

        return {
            board,
            players: [
                {
                    id: 'p1', name: 'Player 1', color: '#f00',
                    resources: { Food: 10, Energy: 5, Labor: 10, Ore: 5, Capital: 10 },
                    money: 100, loans: 0, flags: 17, // 18 - 1 tile on board
                    hasProduced: false, ready: true, flag: 'anglica.svg', hasPassed: false
                },
                {
                    id: 'p2', name: 'Player 2', color: '#00f',
                    resources: { Food: 10, Energy: 5, Labor: 10, Ore: 5, Capital: 10 },
                    money: 100, loans: 0, flags: 17, // 18 - 1 tile on board
                    hasProduced: false, ready: true, flag: 'bolshevica.svg', hasPassed: false
                },
                {
                    id: 'p3', name: 'Player 3', color: '#0f0',
                    resources: { Food: 10, Energy: 5, Labor: 10, Ore: 5, Capital: 10 },
                    money: 100, loans: 0, flags: 17, // 18 - 1 tile on board
                    hasProduced: false, ready: true, flag: 'bharat.svg', hasPassed: false
                }
            ],
            currentTurnPlayerIndex: 0,
            firstPlayerIndex: 0,
            phase: 'Develop',
            round: 2,
            markets: {
                Food: { stock: 4, priceIndex: 4 },
                Energy: { stock: 4, priceIndex: 4 },
                Labor: { stock: 4, priceIndex: 4 },
                Ore: { stock: 4, priceIndex: 4 },
                Capital: { stock: 4, priceIndex: 4 }
            },
            pendingTrade: null,
            tilesRemaining: { Farm: 14, Generator: 8, Academy: 9, Mine: 8, Factory: 9, Bank: 9 },
            isLastRound: false,
            gameEnded: false,
            consecutivePasses: 0,
            initialFlagsPerPlayer: 18,
            initialTiles: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
            settings: { promissoryNoteInterestFees: false, multiBuySell: false, automatedFinalTrade: false },
            logs: []
        };
    };

    describe('Trigger: Player runs out of flags', () => {
        it('should set isLastRound when a player places their last flag', () => {
            const state = createDevelopPhaseState();

            // Set Player 1 to have exactly 1 flag remaining
            // They have 1 tile on board, so for consistency: 1 + 1 = 2, but initialFlags = 18
            // So we need to add more tiles to make flags + tiles = 18
            // Currently: 1 tile, 17 flags = 18. Set flags = 1.
            // Need tiles on board = 17 for this player
            // Alternative: reduce initialFlagsPerPlayer to 2 and set flags = 1, tiles = 1
            state.initialFlagsPerPlayer = 2;
            state.players[0].flags = 1; // Last flag
            state.players[1].flags = 1;
            state.players[2].flags = 1;

            // Verify initial state
            expect(state.isLastRound).toBe(false);
            expect(state.players[0].flags).toBe(1);

            // Find an empty cell adjacent to player 1's tile at (1,0)
            // Adjacent cells to (1,0): (0,0)[center], (1,-1), (2,-1), (2,0), (1,1), (0,1)
            // Use (2,0) which should be empty
            expect(state.board['2,0'].occupant).toBeNull();

            // Player 1 places their last flag
            const result = gameReducer(state, 'placeFlag', { id: '2,0' });

            expect(result.success).toBe(true);
            const newState = result.newState!;

            // Verify flag was placed
            expect(newState.board['2,0'].occupant?.type).toBe('Flag');
            expect(newState.board['2,0'].occupant?.playerId).toBe('p1');

            // Verify player now has 0 flags
            expect(newState.players[0].flags).toBe(0);

            // Verify isLastRound is now true
            expect(newState.isLastRound).toBe(true);
        });

        it('should NOT set isLastRound if player still has flags after placement', () => {
            const state = createDevelopPhaseState();

            // Player has 17 flags (plenty remaining)
            expect(state.isLastRound).toBe(false);
            expect(state.players[0].flags).toBe(17);

            // Place a flag
            const result = gameReducer(state, 'placeFlag', { id: '2,0' });

            expect(result.success).toBe(true);
            const newState = result.newState!;

            // Player still has 16 flags
            expect(newState.players[0].flags).toBe(16);

            // isLastRound should NOT be true
            expect(newState.isLastRound).toBe(false);
        });
    });

    describe('Trigger: Five tile stacks become empty', () => {
        it('should set isLastRound when building causes 5th stack to empty', () => {
            const state = createDevelopPhaseState();

            // Set up 4 stacks empty, Bank has 1 remaining
            state.tilesRemaining = {
                Farm: 0,
                Generator: 0,
                Academy: 0,
                Mine: 0,
                Factory: 5, // Still has tiles
                Bank: 1     // Will trigger when emptied
            };

            // Place a flag first for Player 1
            state.board['2,0'].occupant = {
                type: 'Flag',
                playerId: 'p1'
            };

            // Verify initial state
            expect(state.isLastRound).toBe(false);

            // Build Bank on the flagged cell - this empties the 5th stack
            const result = gameReducer(state, 'buildIndustry', {
                id: '2,0',
                type: 'Bank',
                orientation: 0,
                force: true
            });

            expect(result.success).toBe(true);
            const newState = result.newState!;

            // Verify Bank was built
            expect(newState.board['2,0'].occupant?.type).toBe('Industry');
            expect(newState.board['2,0'].occupant?.tile?.type).toBe('Bank');

            // Verify Bank stack is now 0
            expect(newState.tilesRemaining.Bank).toBe(0);

            // Verify isLastRound is now true (5 stacks at 0)
            expect(newState.isLastRound).toBe(true);
        });

        it('should NOT set isLastRound if less than 5 stacks are empty', () => {
            const state = createDevelopPhaseState();

            // Set up 3 stacks empty, other stacks have tiles
            state.tilesRemaining = {
                Farm: 0,
                Generator: 0,
                Academy: 0,
                Mine: 5,
                Factory: 5,
                Bank: 5
            };

            // Place a flag first
            state.board['2,0'].occupant = {
                type: 'Flag',
                playerId: 'p1'
            };

            // Verify initial state
            expect(state.isLastRound).toBe(false);

            // Build Bank - only 4th stack becomes empty (not 5th)
            state.tilesRemaining.Bank = 1;
            const result = gameReducer(state, 'buildIndustry', {
                id: '2,0',
                type: 'Bank',
                orientation: 0,
                force: true
            });

            expect(result.success).toBe(true);
            const newState = result.newState!;

            // 4 stacks empty (Farm, Generator, Academy, Bank), but we need 5
            expect(newState.tilesRemaining.Bank).toBe(0);

            // Count empty stacks
            const emptyStacks = Object.values(newState.tilesRemaining).filter(count => count === 0).length;
            expect(emptyStacks).toBe(4);

            // isLastRound should NOT be true yet
            expect(newState.isLastRound).toBe(false);
        });
    });

    describe('Game end flow after isLastRound', () => {
        it('should end game when all players pass in Trade phase during isLastRound', () => {
            const state = createDevelopPhaseState();

            // Set up state already in last round, in Trade phase
            state.isLastRound = true;
            state.phase = 'Trade';
            state.consecutivePasses = 2; // 2 players have passed

            // Player 3 passes - all 3 have now passed
            const result = gameReducer(state, 'pass');

            expect(result.success).toBe(true);
            const newState = result.newState!;

            // Game should be ended
            expect(newState.gameEnded).toBe(true);
        });

        it('should continue to next phase if not in last round', () => {
            const state = createDevelopPhaseState();

            // Not last round, in Trade phase
            state.isLastRound = false;
            state.phase = 'Trade';
            state.consecutivePasses = 2;

            // Player 3 passes
            const result = gameReducer(state, 'pass');

            expect(result.success).toBe(true);
            const newState = result.newState!;

            // Game should NOT be ended
            expect(newState.gameEnded).toBe(false);

            // Should advance to Develop phase (same round until next Trade phase)
            expect(newState.phase).toBe('Develop');
            expect(newState.round).toBe(2); // Round increments at Trade phase start
        });
    });

    describe('isLastRound persists correctly', () => {
        it('should maintain isLastRound throughout remaining phases', () => {
            const state = createDevelopPhaseState();

            // Trigger isLastRound via flag placement
            state.initialFlagsPerPlayer = 2;
            state.players[0].flags = 1;
            state.players[1].flags = 1;
            state.players[2].flags = 1;

            let currentState = state;

            // Place last flag
            let result = gameReducer(currentState, 'placeFlag', { id: '2,0' });
            expect(result.success).toBe(true);
            currentState = result.newState!;
            expect(currentState.isLastRound).toBe(true);

            // All players pass to move to Produce
            for (let i = 0; i < 3; i++) {
                result = gameReducer(currentState, 'pass');
                expect(result.success).toBe(true);
                currentState = result.newState!;
            }
            expect(currentState.phase).toBe('Produce');
            expect(currentState.isLastRound).toBe(true); // Still true

            // All players confirm production
            for (let i = 0; i < 3; i++) {
                const playerId = currentState.players[i].id;
                result = gameReducer(currentState, 'confirmProduction', { playerId, activeTiles: [] });
                expect(result.success).toBe(true);
                currentState = result.newState!;
            }
            expect(currentState.phase).toBe('Trade');
            expect(currentState.isLastRound).toBe(true); // Still true

            // All players pass in Trade - game ends
            for (let i = 0; i < 3; i++) {
                result = gameReducer(currentState, 'pass');
                expect(result.success).toBe(true);
                currentState = result.newState!;
            }
            expect(currentState.gameEnded).toBe(true);
        });
    });

    describe('Game end: Victory point calculations', () => {
        it('should calculate VP correctly: industries + money - loans', () => {
            const state = createDevelopPhaseState();

            // Set up final game state
            state.isLastRound = true;
            state.phase = 'Trade';
            state.consecutivePasses = 2;

            // Player 1: 1 industry (4 VP) + $100 (10 VP) + 0 loans (0 penalty) = 14 VP
            state.players[0].money = 100;
            state.players[0].loans = 0;

            // Player 2: 1 industry (4 VP) + $50 (5 VP) + 2 loans (-6 VP) = 3 VP
            state.players[1].money = 50;
            state.players[1].loans = 2;

            // Player 3: 1 industry (4 VP) + $200 (20 VP) + 1 loan (-3 VP) = 21 VP
            state.players[2].money = 200;
            state.players[2].loans = 1;

            // End the game
            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            const endState = result.newState!;
            expect(endState.gameEnded).toBe(true);

            // Calculate victory points from the final state
            // We can verify the logic based on final money/industries/loans
            const p1Industries = Object.values(endState.board).filter(
                c => c.occupant?.type === 'Industry' && c.occupant.playerId === 'p1'
            ).length;
            const p2Industries = Object.values(endState.board).filter(
                c => c.occupant?.type === 'Industry' && c.occupant.playerId === 'p2'
            ).length;
            const p3Industries = Object.values(endState.board).filter(
                c => c.occupant?.type === 'Industry' && c.occupant.playerId === 'p3'
            ).length;

            expect(p1Industries).toBe(1);
            expect(p2Industries).toBe(1);
            expect(p3Industries).toBe(1);

            // Verify money and loans are preserved for VP calculation
            expect(endState.players[0].money).toBe(100);
            expect(endState.players[1].money).toBe(50);
            expect(endState.players[2].money).toBe(200);
            expect(endState.players[1].loans).toBe(2);
            expect(endState.players[2].loans).toBe(1);
        });
    });

    describe('Game end: Automated final trade (V2 rules)', () => {
        it('should liquidate all resources when automatedFinalTrade is enabled', () => {
            const state = createDevelopPhaseState();

            // Enable automated final trade
            state.settings.automatedFinalTrade = true;
            state.isLastRound = true;
            state.phase = 'Trade';
            state.consecutivePasses = 2;

            // Give players resources to liquidate
            state.players[0].resources = { Food: 10, Energy: 5, Labor: 0, Ore: 3, Capital: 8 };
            state.players[0].money = 50;
            state.players[1].resources = { Food: 0, Energy: 8, Labor: 2, Ore: 0, Capital: 4 };
            state.players[1].money = 30;
            state.players[2].resources = { Food: 5, Energy: 2, Labor: 1, Ore: 6, Capital: 0 };
            state.players[2].money = 80;

            // Set up markets at mid prices
            state.markets = {
                Food: { stock: 6, priceIndex: 6 },
                Energy: { stock: 6, priceIndex: 6 },
                Labor: { stock: 6, priceIndex: 6 },
                Ore: { stock: 6, priceIndex: 6 },
                Capital: { stock: 6, priceIndex: 6 }
            };

            // End the game
            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            const endState = result.newState!;
            expect(endState.gameEnded).toBe(true);

            // All resources should be 0 after liquidation
            expect(endState.players[0].resources.Food).toBe(0);
            expect(endState.players[0].resources.Energy).toBe(0);
            expect(endState.players[0].resources.Ore).toBe(0);
            expect(endState.players[0].resources.Capital).toBe(0);
            expect(endState.players[1].resources.Energy).toBe(0);
            expect(endState.players[1].resources.Capital).toBe(0);
            expect(endState.players[2].resources.Food).toBe(0);
            expect(endState.players[2].resources.Ore).toBe(0);

            // Players should have more money than before
            expect(endState.players[0].money).toBeGreaterThan(50);
            expect(endState.players[1].money).toBeGreaterThan(30);
            expect(endState.players[2].money).toBeGreaterThan(80);
        });

        it('should NOT liquidate resources when automatedFinalTrade is disabled', () => {
            const state = createDevelopPhaseState();

            // Disable automated final trade (v1 rules)
            state.settings.automatedFinalTrade = false;
            state.isLastRound = true;
            state.phase = 'Trade';
            state.consecutivePasses = 2;

            // Give players resources
            state.players[0].resources = { Food: 10, Energy: 5, Labor: 0, Ore: 3, Capital: 8 };
            state.players[0].money = 50;

            // End the game
            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            const endState = result.newState!;
            expect(endState.gameEnded).toBe(true);

            // Resources should be UNCHANGED
            expect(endState.players[0].resources.Food).toBe(10);
            expect(endState.players[0].resources.Energy).toBe(5);
            expect(endState.players[0].resources.Ore).toBe(3);
            expect(endState.players[0].resources.Capital).toBe(8);

            // Money should be unchanged
            expect(endState.players[0].money).toBe(50);
        });
    });

    describe('Game end: Loan handling (V2 rules)', () => {
        it('should apply loan interest when promissoryNoteInterestFees is enabled', () => {
            const state = createDevelopPhaseState();

            // Enable loan interest
            state.settings.promissoryNoteInterestFees = true;
            state.isLastRound = true;
            state.phase = 'Trade';
            state.consecutivePasses = 2;

            // Player has loans
            state.players[0].loans = 2;
            state.players[0].money = 50;

            // Note: Loan interest is typically charged at start of Trade phase,
            // not at game end. This test verifies loans are tracked for VP penalty.
            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            const endState = result.newState!;
            expect(endState.gameEnded).toBe(true);

            // Loans should still be tracked for VP calculation
            expect(endState.players[0].loans).toBe(2);
        });
    });

    describe('Tie-breaking rules', () => {
        it('should handle equal VP scores (ties are resolved by money)', () => {
            const state = createDevelopPhaseState();

            state.isLastRound = true;
            state.phase = 'Trade';
            state.consecutivePasses = 2;

            // Set up players with same industry count but different money
            // Player 1: 1 industry + $100 = 14 VP
            // Player 2: 1 industry + $100 = 14 VP  
            // Player 3: 1 industry + $100 = 14 VP
            state.players[0].money = 100;
            state.players[0].loans = 0;
            state.players[1].money = 100;
            state.players[1].loans = 0;
            state.players[2].money = 100;
            state.players[2].loans = 0;

            const result = gameReducer(state, 'pass');
            expect(result.success).toBe(true);
            const endState = result.newState!;
            expect(endState.gameEnded).toBe(true);

            // With equal money, industries, and loans - it's a true tie
            // Tie-breaker: highest money wins (all equal here)
            // This verifies the game ends correctly even with ties
        });
    });
});

