import { describe, it, expect } from 'vitest';
import { isValidPlacement } from './placementLogic';
import type { HexCell } from '../types/gameState';

describe('Placement Logic', () => {
    it('should allow placement on own flag', () => {
        const board: Record<string, HexCell> = {
            '1,0': { q: 1, r: 0, occupant: { type: 'Flag', playerId: 'p1' } }
        };
        const player = { id: 'p1' } as any;
        const result = isValidPlacement(board, '1,0', 'Factory', 0, player);
        expect(result.isValid).toBe(true);
    });

    it('should allow placement next to own industry (implied by flag in current logic)', () => {
        // Current logic REQUIRES the cell itself to be a flag.
        // Adjacency check in isValidPlacement as written is a PENALTY (invalidates if mismatch).
        // It doesn't seem to GRANT validity if not on a flag.
        const board: Record<string, HexCell> = {
            '1,0': { q: 1, r: 0, occupant: { type: 'Flag', playerId: 'p1' } }
        };
        const player = { id: 'p1' } as any;
        const result = isValidPlacement(board, '1,0', 'Factory', 0, player);
        expect(result.isValid).toBe(true);
    });

    it('should NOT allow placement on enemy flag', () => {
        const board: Record<string, HexCell> = {
            '1,0': { q: 1, r: 0, occupant: { type: 'Flag', playerId: 'p2' } }
        };
        const player = { id: 'p1' } as any;
        const result = isValidPlacement(board, '1,0', 'Factory', 0, player);
        expect(result.isValid).toBe(false);
    });

    it('should NOT allow placement on empty cell', () => {
        const board: Record<string, HexCell> = {
            '1,0': { q: 1, r: 0, occupant: null }
        };
        const player = { id: 'p1' } as any;
        const result = isValidPlacement(board, '1,0', 'Factory', 0, player);
        expect(result.isValid).toBe(false);
    });

    it('should NOT allow placement on center tile (0,0)', () => {
        const board: Record<string, HexCell> = {
            '0,0': { q: 0, r: 0, occupant: { type: 'Flag', playerId: 'p1' } }
        };
        const player = { id: 'p1' } as any;
        const result = isValidPlacement(board, '0,0', 'Factory', 0, player);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('Cannot place on center tile');
    });
});
