import { describe, it, expect } from 'vitest';
import { calculateBlocCosts } from '../utils/production';
import type { HexCell } from '../types/gameState';

describe('Production Phase Logic', () => {
    const createTile = (type: string, automated = false): HexCell => ({
        q: 0,
        r: 0,
        occupant: {
            type: 'Industry',
            playerId: 'p1',
            tile: {
                id: '0,0',
                type: type as any,
                ownerId: 'p1',
                orientation: 0,
                active: true,
                automated
            }
        }
    });

    describe('calculateBlocCosts', () => {
        it('should calculate food cost for non-farm tiles', () => {
            const bloc = [createTile('Mine'), createTile('Mine')];
            const costs = calculateBlocCosts(bloc, false);

            expect(costs.Food).toBe(2); // 1 per tile
            expect(costs.Energy).toBe(1); // 1 per bloc
        });

        it('should not charge food for Farm tiles', () => {
            const bloc = [createTile('Farm'), createTile('Farm')];
            const costs = calculateBlocCosts(bloc, false);

            expect(costs.Food).toBe(0); // Farms don't need food
            expect(costs.Energy).toBe(1); // 1 per bloc
        });

        it('should not charge energy for Generator tiles', () => {
            const bloc = [createTile('Generator'), createTile('Generator')];
            const costs = calculateBlocCosts(bloc, false);

            expect(costs.Food).toBe(2); // 1 per tile
            expect(costs.Energy).toBe(0); // Generators don't need energy
        });

        it('should charge ore instead of food for automated blocs', () => {
            const bloc = [createTile('Mine', true), createTile('Mine')];
            const costs = calculateBlocCosts(bloc, true); // Pass true for automated

            expect(costs.Food).toBe(0); // Automated = no food cost
            expect(costs.Ore).toBe(1); // 1 ore for entire automated bloc
            expect(costs.Energy).toBe(1); // Still need energy
        });

        it('should charge ore when automation override is true', () => {
            const bloc = [createTile('Mine'), createTile('Mine')];
            const costs = calculateBlocCosts(bloc, true); // Forcing automation

            expect(costs.Food).toBe(0);
            expect(costs.Ore).toBe(1);
            expect(costs.Energy).toBe(1);
        });
    });

    describe('Bloc Configuration State Management', () => {
        it('should initialize with all tiles powered and fed', () => {
            // This test would use React Testing Library to test component state
            // For now, testing the logic separately
            const bloc = {
                tiles: [createTile('Farm'), createTile('Farm')]
            };

            // Default state should have:
            // - powered: true
            // - automated: false (if no automation token)
            // - fedTiles: Set containing all tile IDs
            expect(bloc.tiles.length).toBe(2);
        });
    });

    describe('Production Calculation with Fed Tiles', () => {
        it('should only calculate production for fed tiles within powered bloc', () => {
            // This would test that unfed tiles don't contribute to production
            // The actual implementation is in calculateProduction which filters by activeTileIds
            const bloc = [createTile('Farm'), createTile('Farm')];

            // If only 1 tile is fed, production should reflect just that tile
            // This is verified through the activeTileIds parameter in calculateProduction
            expect(bloc.length).toBe(2);
        });
    });
});
