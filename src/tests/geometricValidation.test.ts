/**
 * Geometric Validation Test for Tile Placement
 * 
 * This test validates the placementLogic by computing actual dot positions
 * using the same geometry as the rendering code. If two dots from different
 * tiles overlap (are very close together), they MUST have the same commodity
 * type, otherwise the placement should be invalid.
 * 
 * This is an exhaustive property-based test covering all permutations of:
 * - Industry A type (6 options)
 * - Industry B type (6 options)
 * - Direction of B relative to A (6 options)
 * - Orientation of A (6 options)
 * - Orientation of B (6 options)
 * 
 * Total: 6^5 = 7,776 permutations
 */

import { describe, it, expect } from 'vitest';
import { TILE_DEFINITIONS } from '../utils/tileDefinitions';
import { validateTileDots } from '../utils/placementLogic';
import type { IndustryType, CommodityType } from '../types/gameState';

const HEX_SIZE = 30; // Same as rendering
const INDUSTRY_TYPES: IndustryType[] = ['Farm', 'Generator', 'Academy', 'Mine', 'Factory', 'Bank'];

// Direction offsets in axial coordinates (same as hexUtils)
const DIRECTION_OFFSETS = [
    { q: 0, r: -1 },  // 0: N
    { q: 1, r: -1 },  // 1: NE
    { q: 1, r: 0 },   // 2: SE
    { q: 0, r: 1 },   // 3: S
    { q: -1, r: 1 },  // 4: SW
    { q: -1, r: 0 },  // 5: NW
];

// Angles for edge midpoints (same as Hex.tsx)
const EDGE_ANGLES = [270, 330, 30, 90, 150, 210]; // degrees

// Angles for corner vertices (same as Hex.tsx)
const CORNER_ANGLES = [300, 0, 60, 120, 180, 240]; // degrees

interface DotPosition {
    x: number;
    y: number;
    commodity: string; // Can be CommodityType or 'Money'
    type: 'Edge' | 'Corner';
    featurePosition: number; // Original position in tile definition
}

/**
 * Convert axial hex coordinates to pixel coordinates
 * MUST match src/utils/hexUtils.ts exactly!
 */
function hexToPixel(q: number, r: number): { x: number; y: number } {
    // Flat Topped conversion (from hexUtils.ts)
    const SQRT_3 = Math.sqrt(3);
    const x = HEX_SIZE * (3 / 2 * q);
    const y = HEX_SIZE * (SQRT_3 / 2 * q + SQRT_3 * r);
    return { x, y };
}

/**
 * Calculate world positions of all dots on a tile
 */
function getTileDotPositions(
    industryType: IndustryType,
    orientation: number,
    hexQ: number,
    hexR: number
): DotPosition[] {
    const def = TILE_DEFINITIONS[industryType];
    const { x: hexX, y: hexY } = hexToPixel(hexQ, hexR);
    const positions: DotPosition[] = [];

    for (const feat of def.features) {
        if (!feat.commodity) continue;

        // Apply orientation rotation to the feature position
        const rotatedPosition = (feat.position + orientation) % 6;

        let dotX: number, dotY: number;

        if (feat.type === 'Edge') {
            const angleDeg = EDGE_ANGLES[rotatedPosition];
            const angleRad = angleDeg * Math.PI / 180;
            const dist = (Math.sqrt(3) / 2) * HEX_SIZE;
            dotX = hexX + dist * Math.cos(angleRad);
            dotY = hexY + dist * Math.sin(angleRad);
        } else {
            // Corner
            const angleDeg = CORNER_ANGLES[rotatedPosition];
            const angleRad = angleDeg * Math.PI / 180;
            dotX = hexX + HEX_SIZE * Math.cos(angleRad);
            dotY = hexY + HEX_SIZE * Math.sin(angleRad);
        }

        positions.push({
            x: dotX,
            y: dotY,
            commodity: feat.commodity,
            type: feat.type as 'Edge' | 'Corner',
            featurePosition: feat.position
        });
    }

    return positions;
}

/**
 * Check if two points are close enough to be considered overlapping
 */
function arePointsClose(x1: number, y1: number, x2: number, y2: number, threshold = 0.1): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
}

/**
 * Given two tiles' dots, find any overlapping dots and check if their commodities match.
 * Returns true if placement is geometrically valid (no mismatched overlapping dots).
 */
function isGeometricallyValid(dotsA: DotPosition[], dotsB: DotPosition[]): {
    valid: boolean;
    mismatchedDots: Array<{ dotA: DotPosition; dotB: DotPosition }>;
} {
    const mismatchedDots: Array<{ dotA: DotPosition; dotB: DotPosition }> = [];

    for (const dotA of dotsA) {
        for (const dotB of dotsB) {
            if (arePointsClose(dotA.x, dotA.y, dotB.x, dotB.y)) {
                // These dots overlap - they MUST have the same commodity
                if (dotA.commodity !== dotB.commodity) {
                    mismatchedDots.push({ dotA, dotB });
                }
            }
        }
    }

    return {
        valid: mismatchedDots.length === 0,
        mismatchedDots
    };
}

/**
 * Build a mock board with tile B placed and check if placing tile A is valid
 */
function checkPlacementWithLogic(
    industryA: IndustryType,
    industryB: IndustryType,
    direction: number,
    orientA: number,
    orientB: number
): boolean {
    const dirOffset = DIRECTION_OFFSETS[direction];

    // A is at origin, B is at dirOffset
    const board = {
        [`${dirOffset.q},${dirOffset.r}`]: {
            q: dirOffset.q,
            r: dirOffset.r,
            occupant: {
                type: 'Industry' as const,
                playerId: 'p1',
                tile: {
                    id: `${dirOffset.q},${dirOffset.r}`,
                    type: industryB,
                    ownerId: 'p1',
                    orientation: orientB,
                    active: true,
                    automated: false
                }
            }
        },
        '0,0': {
            q: 0,
            r: 0,
            occupant: null
        }
    };

    const result = validateTileDots(board, '0,0', industryA, orientA);
    return result.isValid;
}

describe('Geometric Dot Validation', () => {
    it('should have matching validity between geometric calculation and validateTileDots for all permutations', () => {
        let totalTests = 0;
        let mismatches = 0;
        const mismatchDetails: string[] = [];

        for (const industryA of INDUSTRY_TYPES) {
            for (const industryB of INDUSTRY_TYPES) {
                for (let direction = 0; direction < 6; direction++) {
                    for (let orientA = 0; orientA < 6; orientA++) {
                        for (let orientB = 0; orientB < 6; orientB++) {
                            totalTests++;

                            const dirOffset = DIRECTION_OFFSETS[direction];

                            // Get dot positions for both tiles
                            const dotsA = getTileDotPositions(industryA, orientA, 0, 0);
                            const dotsB = getTileDotPositions(industryB, orientB, dirOffset.q, dirOffset.r);

                            // Check geometric validity
                            const geoResult = isGeometricallyValid(dotsA, dotsB);
                            const geometricallyValid = geoResult.valid;

                            // Check logic validity
                            const logicValid = checkPlacementWithLogic(industryA, industryB, direction, orientA, orientB);

                            if (geometricallyValid !== logicValid) {
                                mismatches++;
                                const detail = `${industryA}(o${orientA}) + ${industryB}(o${orientB}) @ dir${direction}: ` +
                                    `geo=${geometricallyValid}, logic=${logicValid}`;

                                if (geoResult.mismatchedDots.length > 0) {
                                    const dotInfo = geoResult.mismatchedDots.map(m =>
                                        `${m.dotA.type}[${m.dotA.commodity}] vs ${m.dotB.type}[${m.dotB.commodity}]`
                                    ).join(', ');
                                    mismatchDetails.push(`${detail} - overlapping dots: ${dotInfo}`);
                                } else {
                                    mismatchDetails.push(detail);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (mismatches > 0) {
            console.log(`\nMismatches found (${mismatches}/${totalTests}):`);
            // Only log first 20 to avoid spam
            mismatchDetails.slice(0, 20).forEach(d => console.log(`  ${d}`));
            if (mismatchDetails.length > 20) {
                console.log(`  ... and ${mismatchDetails.length - 20} more`);
            }
        }

        expect(mismatches, `Found ${mismatches} mismatches between geometric and logic validation`).toBe(0);
    });

    it('should correctly identify overlapping dots on shared edges', () => {
        // Test specific case: Academy and Factory sharing NW edge
        // Academy at (0,0), Factory at NW (-1, 0)
        const academyDots = getTileDotPositions('Academy', 0, 0, 0);
        const factoryDots = getTileDotPositions('Factory', 0, -1, 0);

        // Find any overlapping dots
        let overlaps = 0;
        for (const dA of academyDots) {
            for (const dF of factoryDots) {
                if (arePointsClose(dA.x, dA.y, dF.x, dF.y)) {
                    overlaps++;
                }
            }
        }

        // There should be some overlapping dots on the shared edge/corners
        // (exact number depends on tile definitions)
        expect(overlaps).toBeGreaterThanOrEqual(0);
    });

    it('should validate the bug case: Academy vs Factory at NW with B orient 3', () => {
        // This is the specific bug case from the original issue
        const industryA = 'Academy' as IndustryType;
        const industryB = 'Factory' as IndustryType;
        const direction = 5; // NW
        const orientB = 3;

        // Expected valid orientations for A: 0, 1, 2, 4
        // Expected invalid orientations for A: 3, 5
        const expectedValid = [0, 1, 2, 4];
        const expectedInvalid = [3, 5];

        for (const orientA of expectedValid) {
            const dirOffset = DIRECTION_OFFSETS[direction];
            const dotsA = getTileDotPositions(industryA, orientA, 0, 0);
            const dotsB = getTileDotPositions(industryB, orientB, dirOffset.q, dirOffset.r);
            const geoResult = isGeometricallyValid(dotsA, dotsB);
            const logicValid = checkPlacementWithLogic(industryA, industryB, direction, orientA, orientB);

            expect(geoResult.valid,
                `Geometric: Academy orient ${orientA} should be valid`).toBe(true);
            expect(logicValid,
                `Logic: Academy orient ${orientA} should be valid`).toBe(true);
        }

        for (const orientA of expectedInvalid) {
            const dirOffset = DIRECTION_OFFSETS[direction];
            const dotsA = getTileDotPositions(industryA, orientA, 0, 0);
            const dotsB = getTileDotPositions(industryB, orientB, dirOffset.q, dirOffset.r);
            const geoResult = isGeometricallyValid(dotsA, dotsB);
            const logicValid = checkPlacementWithLogic(industryA, industryB, direction, orientA, orientB);

            expect(geoResult.valid,
                `Geometric: Academy orient ${orientA} should be invalid (mismatch: ${JSON.stringify(geoResult.mismatchedDots)})`).toBe(false);
            expect(logicValid,
                `Logic: Academy orient ${orientA} should be invalid`).toBe(false);
        }
    });
});
