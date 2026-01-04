import type { Coordinate } from '../types/gameState';

// Flat Topped Hex Utils
// Reference: https://www.redblobgames.com/grids/hexagons/

export const HEX_SIZE = 50; // Radius in pixels
const SQRT_3 = Math.sqrt(3);

export const hexWidth = () => HEX_SIZE * 2;
export const hexHeight = () => SQRT_3 * HEX_SIZE;

// Directions: N, NE, SE, S, SW, NW (Clockwise starting from Top)
// For Flat Topped:
// Top is usually (0, -1) in axial?
// Let's verify neighbors for Flat Top Axial where q=x, r=z (cube) -> q,r
// Neighbors: 
// +q, -r (NE)
// +q, +0 (SE)
// +0, +r (S) 
// -q, +r (SW)
// -q, +0 (NW)
// +0, -r (N)
// Actually standard axial for flat top:
// If (0,0) is center.
// Right (+1, 0) ? No that's Pointy Top.
//
// Let's stick to the list:
// 1. Top (N): q=0, r=-1
// 2. Top-Right (NE): q=+1, r=-1
// 3. Bottom-Right (SE): q=+1, r=0
// 4. Bottom (S): q=0, r=+1
// 5. Bottom-Left (SW): q=-1, r=+1
// 6. Top-Left (NW): q=-1, r=0

export const DIRECTIONS: Coordinate[] = [
    { q: 0, r: -1 }, // Index 0: N (Top)
    { q: 1, r: -1 }, // Index 1: NE (Top-Right)
    { q: 1, r: 0 },  // Index 2: SE (Bottom-Right)
    { q: 0, r: 1 },  // Index 3: S (Bottom)
    { q: -1, r: 1 }, // Index 4: SW (Bottom-Left)
    { q: -1, r: 0 }, // Index 5: NW (Top-Left)
];

export function getNeighbor(coord: Coordinate, directionIndex: number): Coordinate {
    // directionIndex: 0-5
    // Corresponds to Side 1..6 (1-based in rules, 0-based here)
    const dir = DIRECTIONS[directionIndex % 6];
    return {
        q: coord.q + dir.q,
        r: coord.r + dir.r
    };
}

export function hexToPixel(q: number, r: number): { x: number, y: number } {
    // Flat Topped conversion
    const x = HEX_SIZE * (3 / 2 * q);
    const y = HEX_SIZE * (SQRT_3 / 2 * q + SQRT_3 * r);
    return { x, y };
}

export function pixelToHex(x: number, y: number): Coordinate {
    const q = (2. / 3 * x) / HEX_SIZE;
    const r = (-1. / 3 * x + SQRT_3 / 3 * y) / HEX_SIZE;
    return axialRound(q, r);
}

function axialRound(q: number, r: number): Coordinate {
    return cubeRound(axialToCube(q, r)); // Simplified for now, or just implement round
}

function axialToCube(q: number, r: number) {
    return { q, r, s: -q - r };
}

function cubeRound(cube: { q: number, r: number, s: number }): Coordinate {
    let rx = Math.round(cube.q);
    let ry = Math.round(cube.r);
    let rz = Math.round(cube.s);

    const x_diff = Math.abs(rx - cube.q);
    const y_diff = Math.abs(ry - cube.r);
    const z_diff = Math.abs(rz - cube.s);

    if (x_diff > y_diff && x_diff > z_diff) {
        rx = -ry - rz;
    } else if (y_diff > z_diff) {
        ry = -rx - rz;
    }

    return { q: rx, r: ry };
}

export function coordsToString(q: number, r: number): string {
    return `${q},${r}`;
}

// Returns array of 6 neighbors (undefined if missing in grid)
// We need the full grid to find them.
export function getNeighbors(cell: Coordinate, grid: Record<string, import('../types/gameState').HexCell>): (import('../types/gameState').HexCell | undefined)[] {
    const neighbors: (import('../types/gameState').HexCell | undefined)[] = [];
    for (let i = 0; i < 6; i++) {
        const coord = getNeighbor(cell, i);
        const id = coordsToString(coord.q, coord.r);
        neighbors.push(grid[id]);
    }
    return neighbors;
}

// Generate a grid
export function generateGrid(radius: number): Record<string, import('../types/gameState').HexCell> {
    const grid: Record<string, import('../types/gameState').HexCell> = {};
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            const id = coordsToString(q, r);
            grid[id] = { q, r, occupant: null };
        }
    }
    return grid;
}

export function stringToCoords(str: string): Coordinate {
    const [q, r] = str.split(',').map(Number);
    return { q, r };
}
