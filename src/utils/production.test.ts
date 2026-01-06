import { describe, it, expect } from 'vitest';
import { identifyBloc, calculateBlocCosts, calculateProduction } from './production';
import type { HexCell } from '../types/gameState';

describe('Production Logic', () => {
    describe('identifyBloc', () => {
        it('should identify a single tile as a bloc', () => {
            const cell: HexCell = {
                q: 0, r: 0,
                occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Farm', ownerId: 'p1', orientation: 0, active: true } }
            };
            const board = { '0,0': cell };
            const bloc = identifyBloc(board, cell);
            expect(bloc).toHaveLength(1);
            expect(bloc[0].q).toBe(0);
        });

        it('should identify adjacent same-type tiles as a bloc', () => {
            const cell1: HexCell = {
                q: 0, r: 0,
                occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Farm', ownerId: 'p1', orientation: 0, active: true } }
            };
            const cell2: HexCell = {
                q: 1, r: -1, // NE Neighbor
                occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Farm', ownerId: 'p1', orientation: 0, active: true } }
            };
            const board = { '0,0': cell1, '1,-1': cell2 };
            const bloc = identifyBloc(board, cell1);
            expect(bloc).toHaveLength(2);
        });
    });

    describe('calculateBlocCosts', () => {
        it('should calculate food cost for non-automated bloc', () => {
            const bloc: HexCell[] = [
                { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Factory', ownerId: 'p1', orientation: 0, active: true } } },
                { q: 1, r: -1, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Factory', ownerId: 'p1', orientation: 0, active: true } } }
            ];
            const costs = calculateBlocCosts(bloc);
            expect(costs.Food).toBe(2);
            expect(costs.Ore).toBe(0);
            expect(costs.Energy).toBe(1);
        });

        it('should calculate ore cost for automated bloc', () => {
            const bloc: HexCell[] = [
                { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Factory', ownerId: 'p1', orientation: 0, active: true, automated: true } } },
                { q: 1, r: -1, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Factory', ownerId: 'p1', orientation: 0, active: true } } }
            ];
            const costs = calculateBlocCosts(bloc, true); // Pass automatedOverride explicitly
            expect(costs.Food).toBe(0);
            expect(costs.Ore).toBe(1);
            expect(costs.Energy).toBe(1);
        });
    });

    describe('calculateProduction (Shared Dot Rule)', () => {
        it('should handle single player corner match (3 Factory triad)', () => {
            // (0,0), (1,0) [SE], (0,1) [S] meet at a corner.
            // Corner k=2 (between SE and S) on Me(0,0).
            // Me features: 2, 3, 5. Matches 2!
            // N1(1,0) must match corner (2+2)%6=4.
            // N2(0,1) must match corner (2+4)%6=0.

            const f1: HexCell = { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Factory', ownerId: 'p1', orientation: 0, active: true } } } as any;
            const f2: HexCell = { q: 1, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Factory', ownerId: 'p1', orientation: 2, active: true } } } as any;
            const f3: HexCell = { q: 0, r: 1, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '3', type: 'Factory', ownerId: 'p1', orientation: 4, active: true } } } as any;

            const board = { '0,0': f1, '1,0': f2, '0,1': f3 };

            const prod = calculateProduction(board, f1);
            expect(prod?.amount).toBe(4);
        });

        it('should exclude shared corner from production if owned by different players', () => {
            const f1: HexCell = { q: 0, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '1', type: 'Factory', ownerId: 'p1', orientation: 0, active: true } } } as any;
            const f2: HexCell = { q: 1, r: 0, occupant: { type: 'Industry', playerId: 'p1', tile: { id: '2', type: 'Factory', ownerId: 'p1', orientation: 2, active: true } } } as any;
            const f3: HexCell = { q: 0, r: 1, occupant: { type: 'Industry', playerId: 'p2', tile: { id: '3', type: 'Factory', ownerId: 'p2', orientation: 4, active: true } } } as any;

            const board = { '0,0': f1, '1,0': f2, '0,1': f3 };

            const prodP1 = calculateProduction(board, f1);
            // P1 has 2 factories. Centers (2.0). Shared corner is blocked.
            expect(prodP1?.amount).toBe(2);
        });
    });
});
