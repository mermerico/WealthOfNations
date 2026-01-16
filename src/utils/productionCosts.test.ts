import { describe, it, expect } from 'vitest';
import { calculateGlobalProduction } from './production';
import type { HexCell } from '../types/gameState';

describe('Production Phase Logic', () => {
    it('calculates production and costs for multiple players separately', () => {
        const board: Record<string, HexCell> = {
            '0,0': {
                q: 0, r: 0, occupant: {
                    type: 'Industry',
                    playerId: 'p1',
                    tile: { id: '0,0', type: 'Farm', orientation: 0, ownerId: 'p1', active: true }
                }
            },
            '1,0': {
                q: 1, r: 0, occupant: {
                    type: 'Industry',
                    playerId: 'p2',
                    tile: { id: '1,0', type: 'Mine', orientation: 0, ownerId: 'p2', active: true }
                }
            }
        };

        const results = calculateGlobalProduction(board);

        // Player 1 (Farm)
        expect(results['p1'].outputs.Food).toBe(1); // 1 center dot
        expect(results['p1'].costs.Food).toBe(0); // Farms feed themselves

        // Player 2 (Mine)
        expect(results['p2'].outputs.Ore).toBe(1); // 1 center dot
        expect(results['p2'].costs.Food).toBe(1); // Mine needs 1 food
        expect(results['p2'].costs.Energy).toBe(1); // Mine needs 1 energy
    });

    it('handles automated blocs correctly in global production', () => {
        const board: Record<string, HexCell> = {
            '0,0': {
                q: 0, r: 0, occupant: {
                    type: 'Industry',
                    playerId: 'p1',
                    tile: { id: '0,0', type: 'Mine', orientation: 0, ownerId: 'p1', active: true, automated: true }
                }
            }
        };

        const results = calculateGlobalProduction(board);

        // Automation is now auto-detected! The fix correctly checks tile.automated
        expect(results['p1'].costs.Ore).toBe(1); // Automated blocs cost Ore instead of Food
        expect(results['p1'].costs.Food).toBe(0); // No food cost for automated bloc
        expect(results['p1'].costs.Energy).toBe(1); // Still need Energy (1 per bloc)
    });

    it('respects the shared dot rule (different players)', () => {
        // Two farms next to each other, different owners
        const board: Record<string, HexCell> = {
            '0,0': {
                q: 0, r: 0, occupant: {
                    type: 'Industry',
                    playerId: 'p1',
                    tile: { id: '0,0', type: 'Farm', orientation: 0, ownerId: 'p1', active: true }
                }
            },
            '1,0': {
                q: 1, r: 0, occupant: {
                    type: 'Industry',
                    playerId: 'p2',
                    tile: { id: '1,0', type: 'Farm', orientation: 0, ownerId: 'p2', active: true }
                }
            }
        };

        const results = calculateGlobalProduction(board);

        // Should NOT form a dot because owners are different
        expect(results['p1'].outputs.Food).toBe(1);
        expect(results['p2'].outputs.Food).toBe(1);
    });
});
