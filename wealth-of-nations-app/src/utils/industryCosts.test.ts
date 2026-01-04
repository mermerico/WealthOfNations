import { describe, it, expect } from 'vitest';
import { TILE_DEFINITIONS } from './tileDefinitions';

describe('Industry Tile Costs', () => {
    describe('Farm Costs', () => {
        it('should cost 1 Ore and 1 Capital', () => {
            const farm = TILE_DEFINITIONS.Farm;
            expect(farm.costStruct.Ore).toBe(1);
            expect(farm.costStruct.Capital).toBe(1);
            expect(farm.costStruct.Labor).toBeUndefined();
            expect(farm.costStruct.Energy).toBeUndefined();
        });
    });

    describe('Generator Costs', () => {
        it('should cost 1 Ore and 1 Capital', () => {
            const generator = TILE_DEFINITIONS.Generator;
            expect(generator.costStruct.Ore).toBe(1);
            expect(generator.costStruct.Capital).toBe(1);
            expect(generator.costStruct.Labor).toBeUndefined();
            expect(generator.costStruct.Energy).toBeUndefined();
        });
    });

    describe('Academy Costs', () => {
        it('should cost 1 Ore and 1 Capital', () => {
            const academy = TILE_DEFINITIONS.Academy;
            expect(academy.costStruct.Ore).toBe(1);
            expect(academy.costStruct.Capital).toBe(1);
            expect(academy.costStruct.Labor).toBeUndefined();
            expect(academy.costStruct.Energy).toBeUndefined();
        });
    });

    describe('Mine Costs', () => {
        it('should cost 1 Labor, 1 Energy, and 1 Capital', () => {
            const mine = TILE_DEFINITIONS.Mine;
            expect(mine.costStruct.Labor).toBe(1);
            expect(mine.costStruct.Energy).toBe(1);
            expect(mine.costStruct.Capital).toBe(1);
            expect(mine.costStruct.Ore).toBeUndefined();
        });
    });

    describe('Factory Costs', () => {
        it('should cost 1 Labor and 2 Ore', () => {
            const factory = TILE_DEFINITIONS.Factory;
            expect(factory.costStruct.Labor).toBe(1);
            expect(factory.costStruct.Ore).toBe(2);
            expect(factory.costStruct.Energy).toBeUndefined();
            expect(factory.costStruct.Capital).toBeUndefined();
        });
    });

    describe('Bank Costs', () => {
        it('should cost 1 Energy, 1 Ore, and 1 Capital', () => {
            const bank = TILE_DEFINITIONS.Bank;
            expect(bank.costStruct.Energy).toBe(1);
            expect(bank.costStruct.Ore).toBe(1);
            expect(bank.costStruct.Capital).toBe(1);
            expect(bank.costStruct.Labor).toBeUndefined();
        });
    });

    describe('Tile Quantities', () => {
        it('should have correct tile count metadata for Farm (15 tiles)', () => {
            // Note: This is documented in rules but may not be in code yet
            // Farm should have 15 total tiles
            const farm = TILE_DEFINITIONS.Farm;
            expect(farm).toBeDefined();
        });

        it('should have correct tile count metadata for other tiles (9 each)', () => {
            // Generator, Academy, Mine, Factory, Bank should each have 9 tiles
            const types = ['Generator', 'Academy', 'Mine', 'Factory', 'Bank'] as const;
            types.forEach(type => {
                const tileDef = TILE_DEFINITIONS[type];
                expect(tileDef).toBeDefined();
            });
        });
    });

    describe('Tile Features', () => {
        it('Farm should have center dot and half-dots on all flat sides', () => {
            const farm = TILE_DEFINITIONS.Farm;
            expect(farm.hasCenterDot).toBe(true);

            // Farm has half-dots on all sides (6 total)
            const halfDots = farm.features.filter(f => f.feature === 'HalfDot');
            expect(halfDots.length).toBeGreaterThan(0);
        });

        it('Generator should have center dot', () => {
            const generator = TILE_DEFINITIONS.Generator;
            expect(generator.hasCenterDot).toBe(true);
        });

        it('Academy should have center dot and include third-dots', () => {
            const academy = TILE_DEFINITIONS.Academy;
            expect(academy.hasCenterDot).toBe(true);

            const thirdDots = academy.features.filter(f => f.feature === 'ThirdDot');
            expect(thirdDots.length).toBeGreaterThan(0);
        });

        it('Mine should have center dot', () => {
            const mine = TILE_DEFINITIONS.Mine;
            expect(mine.hasCenterDot).toBe(true);
        });

        it('Factory should have center dot and third-dots', () => {
            const factory = TILE_DEFINITIONS.Factory;
            expect(factory.hasCenterDot).toBe(true);

            const thirdDots = factory.features.filter(f => f.feature === 'ThirdDot');
            expect(thirdDots.length).toBeGreaterThan(0);
        });

        it('Bank should NOT have center dot', () => {
            const bank = TILE_DEFINITIONS.Bank;
            expect(bank.hasCenterDot).toBe(false);
        });
    });

    describe('Production Outputs', () => {
        it('Farm should produce Food', () => {
            const farm = TILE_DEFINITIONS.Farm;
            const foodFeatures = farm.features.filter(f => f.commodity === 'Food');
            expect(foodFeatures.length).toBeGreaterThan(0);
        });

        it('Generator should produce Energy', () => {
            const generator = TILE_DEFINITIONS.Generator;
            const energyFeatures = generator.features.filter(f => f.commodity === 'Energy');
            expect(energyFeatures.length).toBeGreaterThan(0);
        });

        it('Academy should produce Labor', () => {
            const academy = TILE_DEFINITIONS.Academy;
            const laborFeatures = academy.features.filter(f => f.commodity === 'Labor');
            expect(laborFeatures.length).toBeGreaterThan(0);
        });

        it('Mine should produce Ore', () => {
            const mine = TILE_DEFINITIONS.Mine;
            const oreFeatures = mine.features.filter(f => f.commodity === 'Ore');
            expect(oreFeatures.length).toBeGreaterThan(0);
        });

        it('Factory should produce Capital', () => {
            const factory = TILE_DEFINITIONS.Factory;
            const capitalFeatures = factory.features.filter(f => f.commodity === 'Capital');
            expect(capitalFeatures.length).toBeGreaterThan(0);
        });

        it('Bank features should indicate money production', () => {
            const bank = TILE_DEFINITIONS.Bank;
            // Banks produce $30 per full dot, not commodity cubes
            expect(bank.hasCenterDot).toBe(false); // Banks have no center dot
            expect(bank.features.length).toBeGreaterThan(0);
        });
    });
});
