import { describe, it, expect } from 'vitest';
import { calculateGlobalProduction } from '../utils/production';
import type { HexCell } from '../types/gameState';

describe('Shared Dot Rule Integration', () => {
    it('should reduce production for shared edge between players', () => {
        // Two Farms sharing an edge.
        // P1 Farm at (0,0), P2 Farm at (1,-1)
        const f1: HexCell = { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Farm', ownerId: 'p1', orientation: 0, active: true } } } as any;
        const f2: HexCell = { q: 1, r: -1, occupant: { type: 'Industry', playerId: 'p2', tile: { id: '2', type: 'Farm', ownerId: 'p2', orientation: 0, active: true } } } as any;

        const board = { '0,0': f1, '1,-1': f2 };

        const results = calculateGlobalProduction(board);
        // Each farm has center dot (1.0). 
        // Shared edge between P1 and P2 should NOT produce.
        // Total Food: 2.0.
        const totalFood = (results['p1']?.outputs.Food || 0) + (results['p2']?.outputs.Food || 0);
        expect(totalFood).toBe(2);
    });

    it('should allow production for shared edge within same player bloc', () => {
        const f1: HexCell = { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Farm', ownerId: 'p1', orientation: 0, active: true } } } as any;
        const f2: HexCell = { q: 1, r: -1, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Farm', ownerId: 'p1', orientation: 0, active: true } } } as any;

        const board = { '0,0': f1, '1,-1': f2 };

        const results = calculateGlobalProduction(board);
        // Each farm has center dot (1.0). 
        // Shared edge between P1 and P1 should produce (0.5 * 2 = 1.0).
        // Total Food: 3.0.
        const totalFood = (results['p1']?.outputs.Food || 0);
        expect(totalFood).toBe(3);
    });

    it('should handle complex 3-player (or 2-player + empty) shared corners', () => {
        // (0,0) P1, (1,0) [SE] P1, (0,1) [S] P2
        // Orientation 0, 2, 4 aligns corners for triplet.
        const f1: HexCell = { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Factory', ownerId: 'p1', orientation: 0, active: true } } } as any;
        const f2: HexCell = { q: 1, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Factory', ownerId: 'p1', orientation: 2, active: true } } } as any;
        const f3: HexCell = { q: 0, r: 1, occupant: { type: 'Industry', playerId: 'p2', tile: { id: '3', type: 'Factory', ownerId: 'p2', orientation: 4, active: true } } } as any;

        const board = { '0,0': f1, '1,0': f2, '0,1': f3 };

        const results = calculateGlobalProduction(board);
        // P1 total: 2 centers (2.0). Shared corner is blocked by P2. Total: 2.0.
        // P2 total: 1 center (1.0). Shared corner is blocked by P1. Total: 1.0.
        // Grand Total Capital: 3.0.
        const totalCapital = (results['p1']?.outputs.Capital || 0) + (results['p2']?.outputs.Capital || 0);
        expect(totalCapital).toBe(3);
    });
});
