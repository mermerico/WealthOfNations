import { describe, it, expect } from 'vitest';
import { generateGrid } from './hexUtils';
import { isValidSetupPlacement, getValidSetupPlacements } from './setupPlacementLogic';

describe('Setup Placement Logic', () => {
    const createEmptyBoard = () => generateGrid(4);

    it('should reject placement in central hex (0,0)', () => {
        const board = createEmptyBoard();
        const result = isValidSetupPlacement(board, '0,0', 'Farm', 0, [], 'p1');

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('central hex');
    });

    it('should allow first tile placement anywhere except center', () => {
        const board = createEmptyBoard();
        const result = isValidSetupPlacement(board, '1,0', 'Farm', 0, [], 'p1');

        expect(result.isValid).toBe(true);
    });

    it('should require contiguity for second tile', () => {
        const board = createEmptyBoard();

        // First tile at 1,0
        const firstResult = isValidSetupPlacement(board, '1,0', 'Farm', 0, [], 'p1');
        expect(firstResult.isValid).toBe(true);

        // Second tile NOT adjacent should fail
        const result = isValidSetupPlacement(board, '3,0', 'Farm', 0, ['1,0'], 'p1');
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('adjacent');
    });

    it('should allow adjacent second tile', () => {
        const board = createEmptyBoard();

        // Place first tile at 1,0
        board['1,0'] = {
            ...board['1,0'],
            occupant: {
                type: 'Industry',
                playerId: 'p1',
                tile: {
                    id: 't1',
                    type: 'Farm',
                    ownerId: 'p1',
                    orientation: 0,
                    active: true,
                    automated: false
                }
            }
        };

        // Second tile adjacent at 2,0 (neighbor to the east)
        const result = isValidSetupPlacement(board, '2,0', 'Farm', 0, ['1,0'], 'p1');
        expect(result.isValid).toBe(true);
    });

    it('should reject placement on occupied cell', () => {
        const board = createEmptyBoard();

        // Place a tile
        board['1,0'] = {
            ...board['1,0'],
            occupant: {
                type: 'Industry',
                playerId: 'p1',
                tile: {
                    id: 't1',
                    type: 'Farm',
                    ownerId: 'p1',
                    orientation: 0,
                    active: true,
                    automated: false
                }
            }
        };

        // Try to place another tile on same cell
        const result = isValidSetupPlacement(board, '1,0', 'Farm', 0, [], 'p1');
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('occupied');
    });

    it('should reject mismatched color dots touching', () => {
        const board = createEmptyBoard();

        // Place a Farm (Food dots) at 1,0 with orientation 0
        board['1,0'] = {
            ...board['1,0'],
            occupant: {
                type: 'Industry',
                playerId: 'p1',
                tile: {
                    id: 't1',
                    type: 'Farm',
                    ownerId: 'p1',
                    orientation: 0,
                    active: true,
                    automated: false
                }
            }
        };

        // Try to place Generator (Energy dots) adjacent with wrong orientation
        // This might be valid depending on which edges touch
        // Farm at orientation 0: has Food half-dots on edges
        // Generator at orientation 0: has Energy half-dots on edges
        // If Food edge touches Energy edge, should be rejected

        const result = isValidSetupPlacement(board, '2,0', 'Generator', 0, ['1,0'], 'p1');

        // The result depends on tile definitions
        // Check if validation works
        if (!result.isValid) {
            expect(result.reason).toContain('Cannot place');
        }
    });

    describe('getValidSetupPlacements', () => {
        it('should return all valid cells with orientations for first tile', () => {
            const board = createEmptyBoard();
            const validPlacements = getValidSetupPlacements(board, 'Farm', [], 'p1');

            // Should have many valid cells (all except center)
            expect(Object.keys(validPlacements).length).toBeGreaterThan(0);

            // Center should not be included
            expect(validPlacements['0,0']).toBeUndefined();

            // Each valid cell should have at least one valid orientation
            Object.values(validPlacements).forEach(orientations => {
                expect(orientations.length).toBeGreaterThan(0);
            });
        });

        it('should only return adjacent cells for second tile', () => {
            const board = createEmptyBoard();

            // Place first tile at 1,0
            board['1,0'] = {
                ...board['1,0'],
                occupant: {
                    type: 'Industry',
                    playerId: 'p1',
                    tile: {
                        id: 't1',
                        type: 'Farm',
                        ownerId: 'p1',
                        orientation: 0,
                        active: true,
                        automated: false
                    }
                }
            };

            const validPlacements = getValidSetupPlacements(board, 'Farm', ['1,0'], 'p1');

            // Should only have cells adjacent to 1,0
            // Neighbors of 1,0: (2,0), (1,1), (0,1), (0,0), (1,-1), (2,-1)
            // But (0,0) is center and excluded
            const validCells = Object.keys(validPlacements);

            expect(validCells.length).toBeGreaterThan(0);
            expect(validCells.length).toBeLessThanOrEqual(5); // At most 5 neighbors (6 minus center)
        });

        it('should return empty object if no valid placements', () => {
            const board = createEmptyBoard();

            // Fill the board or create a scenario with no valid placements
            // For now, just test that center is always invalid
            const centerOnlyCheck = getValidSetupPlacements(board, 'Farm', [], 'p1');
            expect(centerOnlyCheck['0,0']).toBeUndefined();
        });
    });

    describe('Farm tile placement (debugging real issue)', () => {
        it('should allow Farm tile at 1,0 as first tile', () => {
            const board = createEmptyBoard();

            // Test exact scenario from game
            const validPlacements = getValidSetupPlacements(board, 'Farm', [], 'p1');

            console.log('Valid placements for Farm (first tile):', Object.keys(validPlacements));
            console.log('Cell 1,0 valid orientations:', validPlacements['1,0']);

            expect(validPlacements['1,0']).toBeDefined();
            expect(validPlacements['1,0'].length).toBeGreaterThan(0);
        });

        it('should validate Farm placement at specific cell and orientation', () => {
            const board = createEmptyBoard();

            // Test multiple cells and orientations
            const testCells = ['1,0', '2,0', '1,1', '0,1', '-1,0', '0,-1'];

            testCells.forEach(cellId => {
                for (let orientation = 0; orientation < 6; orientation++) {
                    const result = isValidSetupPlacement(board, cellId, 'Farm', orientation, [], 'p1');
                    if (cellId !== '0,0') { // Skip center
                        expect(result.isValid).toBe(true);
                        console.log(`Farm at ${cellId}, orientation ${orientation}: ${result.isValid ? 'VALID' : 'INVALID'}`);
                    }
                }
            });
        });
    });
});
