import { describe, it, expect } from 'vitest';
import { isValidPlacement } from './placementLogic';
import { isValidSetupPlacement } from './setupPlacementLogic';
import type { HexCell, Player } from '../types/gameState';

describe('Center Tile (0,0) Restrictions', () => {
    it('should NOT allow setup tile placement on center tile', () => {
        const board: Record<string, HexCell> = {
            '0,0': { q: 0, r: 0, occupant: null }
        };

        const result = isValidSetupPlacement(board, '0,0', 'Farm', 0, [], 'p1');

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('central hex');
    });

    it('should NOT allow industry tile placement on center tile', () => {
        const board: Record<string, HexCell> = {
            '0,0': { q: 0, r: 0, occupant: { type: 'Flag', playerId: 'p1' } }
        };
        const player = { id: 'p1' } as Player;

        const result = isValidPlacement(board, '0,0', 'Factory', 0, player);

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('Cannot place on center tile');
    });

    it('should allow placements on tiles adjacent to center', () => {
        // Test that non-center tiles work fine
        const board: Record<string, HexCell> = {
            '0,0': { q: 0, r: 0, occupant: null },
            '1,0': { q: 1, r: 0, occupant: { type: 'Flag', playerId: 'p1' } }
        };
        const player = { id: 'p1' } as Player;

        const result = isValidPlacement(board, '1,0', 'Farm', 0, player);

        expect(result.isValid).toBe(true);
    });
});
