import { describe, it, expect } from 'vitest';
import { calculateBlocCosts } from './production';
import type { HexCell, IndustryTile } from '../types/gameState';

describe('Production Costs with Automation', () => {
    const createTile = (type: string, automated: boolean = false): IndustryTile => ({
        id: 'test-tile',
        type: type as any,
        ownerId: 'p1',
        orientation: 0,
        active: true,
        automated
    });

    const createCell = (q: number, r: number, tile: IndustryTile): HexCell => ({
        q,
        r,
        occupant: {
            type: 'Industry',
            playerId: 'p1',
            tile
        }
    });

    describe('Non-automated blocs', () => {
        it('should use Food for non-Farm blocs', () => {
            const tile1 = createTile('Mine', false);
            const tile2 = createTile('Mine', false);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            const costs = calculateBlocCosts(bloc, false);

            expect(costs.Food).toBe(2); // 1 per tile
            expect(costs.Energy).toBe(1); // 1 per bloc
            expect(costs.Ore).toBe(0);
            expect(costs.Labor).toBe(0);
        });

        it('should not use Food for Farm blocs', () => {
            const tile1 = createTile('Farm', false);
            const tile2 = createTile('Farm', false);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            const costs = calculateBlocCosts(bloc, false);

            expect(costs.Food).toBe(0);
            expect(costs.Energy).toBe(1);
            expect(costs.Ore).toBe(0);
        });

        it('should not use Energy for Generator blocs', () => {
            const tile1 = createTile('Generator', false);
            const tile2 = createTile('Generator', false);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            const costs = calculateBlocCosts(bloc, false);

            expect(costs.Food).toBe(2);
            expect(costs.Energy).toBe(0);
            expect(costs.Ore).toBe(0);
        });
    });

    describe('Fully automated blocs', () => {
        it('should use Ore instead of Food when fully automated', () => {
            const tile1 = createTile('Mine', true);
            const tile2 = createTile('Mine', true);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            const costs = calculateBlocCosts(bloc, true);

            expect(costs.Food).toBe(0); // No food when automated
            expect(costs.Energy).toBe(1);
            expect(costs.Ore).toBe(1); // 1 ore for entire bloc
            expect(costs.Labor).toBe(0);
        });

        it('should use 1 Ore per bloc regardless of size', () => {
            const tile1 = createTile('Academy', true);
            const tile2 = createTile('Academy', true);
            const tile3 = createTile('Academy', true);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2),
                createCell(2, 0, tile3)
            ];

            const costs = calculateBlocCosts(bloc, true);

            expect(costs.Food).toBe(0);
            expect(costs.Energy).toBe(1);
            expect(costs.Ore).toBe(1); // Still just 1 Ore
        });
    });

    describe('Partially fed automated blocs', () => {
        it('should use Food when only some tiles fed in automated bloc', () => {
            // Scenario: Bloc has 3 tiles with automation, but only 2 are being fed
            // The UI should pass tiles WITHOUT automation property when not running automation
            const tile1 = createTile('Factory', false); // No automation when partially feeding
            const tile2 = createTile('Factory', false);
            const partialBloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            // Pass false for automation since not all tiles are fed
            const costs = calculateBlocCosts(partialBloc, false);

            expect(costs.Food).toBe(2); // Should use Food, not Ore
            expect(costs.Energy).toBe(1);
            expect(costs.Ore).toBe(0); // No Ore when not fully automated
        });

        it('tiles with automated=true use Food when automation override=false', () => {
            // This demonstrates the fix
            const tile1 = createTile('Factory', true); // Has automation property
            const tile2 = createTile('Factory', true);
            const partialBloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            // When we pass false, it should NOT use automation
            const costs = calculateBlocCosts(partialBloc, false);

            // FIXED: Now uses Food because we explicitly said not to use automation
            expect(costs.Food).toBe(2);
            expect(costs.Ore).toBe(0);
            expect(costs.Energy).toBe(1);
        });
    });

    describe('Mixed scenarios', () => {
        it('should handle single tile automated bloc', () => {
            const tile = createTile('Bank', true);
            const bloc = [createCell(0, 0, tile)];

            const costs = calculateBlocCosts(bloc, true);

            expect(costs.Food).toBe(0);
            expect(costs.Energy).toBe(1);
            expect(costs.Ore).toBe(1);
        });

        it('should handle automated Farm (no Food cost either way)', () => {
            const tile1 = createTile('Farm', true);
            const tile2 = createTile('Farm', true);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            const costs = calculateBlocCosts(bloc, true);

            expect(costs.Food).toBe(0); // Farms don't use Food
            expect(costs.Energy).toBe(1);
            expect(costs.Ore).toBe(0); // Farms don't need Ore for automation
        });

        it('should handle automated Generator (no Energy cost)', () => {
            const tile1 = createTile('Generator', true);
            const tile2 = createTile('Generator', true);
            const bloc = [
                createCell(0, 0, tile1),
                createCell(1, 0, tile2)
            ];

            const costs = calculateBlocCosts(bloc, true);

            expect(costs.Food).toBe(0); // Automated = no food
            expect(costs.Energy).toBe(0); // Generators don't use Energy
            expect(costs.Ore).toBe(1);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty bloc', () => {
            const costs = calculateBlocCosts([], false);

            expect(costs.Food).toBe(0);
            expect(costs.Energy).toBe(0);
            expect(costs.Ore).toBe(0);
            expect(costs.Labor).toBe(0);
        });

        it('should respect automatedOverride parameter over tile automation property', () => {
            const tile = createTile('Mine', true); // Tile has automation
            const bloc = [createCell(0, 0, tile)];

            // When we pass false, it should NOT use automation
            const costs = calculateBlocCosts(bloc, false);

            // FIXED: Override parameter is now respected
            expect(costs.Food).toBe(1);
            expect(costs.Ore).toBe(0);
        });
    });
});

describe('Expected behavior for UI logic', () => {
    it('describes the correct automation logic flow', () => {
        // This test documents the expected behavior:

        // 1. When "Run Automation" is checked:
        //    - All tiles in bloc should be automatically fed
        //    - Cost calculation should use: calculateBlocCosts(bloc, true)
        //    - Result: 0 Food, 1 Ore (for non-Farm/non-Generator)

        // 2. When "Run Automation" is unchecked:
        //    - Only manually selected tiles are fed
        //    - Cost calculation should use: calculateBlocCosts(selectedTiles, false)
        //    - Result: N Food (N = number of selected tiles), 0 Ore

        // 3. The key insight:
        //    - Automation only applies when ALL tiles in the bloc are being run
        //    - If only some tiles selected, even if bloc has automation token, use Food

        expect(true).toBe(true); // Documentation test
    });
});
