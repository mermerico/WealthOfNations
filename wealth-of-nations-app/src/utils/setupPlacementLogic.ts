import type { IndustryType, HexCell } from '../types/gameState';
import { TILE_DEFINITIONS } from './tileDefinitions';
import { coordsToString, stringToCoords, getNeighbor } from './hexUtils';

export interface SetupPlacementValidationResult {
    isValid: boolean;
    reason?: string;
}

/**
 * Validates if a tile can be placed during setup phase.
 * Setup rules:
 * 1. Cannot place in central hex (0,0)
 * 2. Must be contiguous with previously placed setup tiles (if any)
 * 3. Different colored partial dots cannot touch
 * 4. Same color or blank sides are OK
 */
export function isValidSetupPlacement(
    board: Record<string, HexCell>,
    cellId: string,
    type: IndustryType,
    orientation: number,
    setupTileCells: string[], // Previously placed tiles in this setup for this player
    _playerId: string
): SetupPlacementValidationResult {
    const cell = board[cellId];
    if (!cell) return { isValid: false, reason: 'Invalid cell' };

    const coords = stringToCoords(cellId);

    // 1. Cannot place in central hex
    if (coords.q === 0 && coords.r === 0) {
        return { isValid: false, reason: 'Cannot place in central hex' };
    }

    // 2. Cell must be empty
    if (cell.occupant) {
        return { isValid: false, reason: 'Cell is occupied' };
    }

    // 3. Contiguity check: if this isn't the first tile, must be adjacent to a setup tile
    if (setupTileCells.length > 0) {
        const isAdjacent = setupTileCells.some(setupCellId => {
            const setupCoords = stringToCoords(setupCellId);
            // Check all 6 directions
            for (let dir = 0; dir < 6; dir++) {
                const neighbor = getNeighbor(setupCoords, dir);
                if (coordsToString(neighbor.q, neighbor.r) === cellId) {
                    return true;
                }
            }
            return false;
        });

        if (!isAdjacent) {
            return { isValid: false, reason: 'Must be adjacent to previously placed setup tiles' };
        }
    }

    // 4. Color matching check - different colors cannot touch
    const def = TILE_DEFINITIONS[type];

    for (let i = 0; i < 6; i++) {
        const neighborCoords = getNeighbor(coords, i);
        const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);
        const neighborCell = board[neighborId];

        if (!neighborCell || !neighborCell.occupant || neighborCell.occupant.type !== 'Industry' || !neighborCell.occupant.tile) {
            continue; // No neighbor or not an industry
        }

        const neighborTile = neighborCell.occupant.tile;
        const neighborDef = TILE_DEFINITIONS[neighborTile.type];
        const neighborOrientation = neighborTile.orientation || 0;

        // Calculate which edge of my tile faces this neighbor
        const myEdge = i;
        // Calculate which edge of neighbor faces me
        const neighborEdge = (i + 3) % 6;

        // Get rotated feature index for my tile
        const myFeatureIdx = (myEdge - orientation + 6) % 6;
        // Get rotated feature index for neighbor tile
        const neighborFeatureIdx = (neighborEdge - neighborOrientation + 6) % 6;

        // Find edge features
        const myFeature = def.features.find(f => f.type === 'Edge' && f.position === myFeatureIdx);
        const neighborFeature = neighborDef.features.find(f => f.type === 'Edge' && f.position === neighborFeatureIdx);

        // If both have half-dots, check if they match
        if (myFeature && neighborFeature &&
            myFeature.feature === 'HalfDot' && neighborFeature.feature === 'HalfDot') {

            if (myFeature.commodity !== neighborFeature.commodity) {
                return {
                    isValid: false,
                    reason: `Setup rule: Cannot place ${myFeature.commodity} dot next to ${neighborFeature.commodity} dot`
                };
            }
        }
    }

    // 5. Corner matching check - check ThirdDots at corners
    // Each corner is shared by up to 3 hexes. Corner at position C is between edges (C-1) and C.
    // For corner at position C, it's shared with neighbors at edges (C-1+6)%6 and C.
    for (let cornerPos = 0; cornerPos < 6; cornerPos++) {
        const myCornerFeatureIdx = (cornerPos - orientation + 6) % 6;
        const myCornerFeature = def.features.find(f => f.type === 'Corner' && f.position === myCornerFeatureIdx);

        if (!myCornerFeature || myCornerFeature.feature !== 'ThirdDot') continue;

        // Check the two neighbors that share this corner
        const edge1 = (cornerPos - 1 + 6) % 6;
        const edge2 = cornerPos;

        for (const edgeDir of [edge1, edge2]) {
            const neighborCoords = getNeighbor(coords, edgeDir);
            const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);
            const neighborCell = board[neighborId];

            if (!neighborCell || !neighborCell.occupant || neighborCell.occupant.type !== 'Industry' || !neighborCell.occupant.tile) {
                continue;
            }

            const neighborTile = neighborCell.occupant.tile;
            const neighborDef = TILE_DEFINITIONS[neighborTile.type];
            const neighborOrientation = neighborTile.orientation || 0;

            // Calculate which corner of the neighbor corresponds to this shared corner
            // Corner shared via edge E with neighbor: their corner is at position (E+2)%6 or (E+3)%6
            // For edge1 (cornerPos-1): neighbor corner is at (edge1+3)%6
            // For edge2 (cornerPos): neighbor corner is at (edge2+2)%6
            let neighborCornerPos;
            if (edgeDir === edge1) {
                neighborCornerPos = (edgeDir + 3) % 6;
            } else {
                neighborCornerPos = (edgeDir + 2) % 6;
            }

            const neighborCornerFeatureIdx = (neighborCornerPos - neighborOrientation + 6) % 6;
            const neighborCornerFeature = neighborDef.features.find(f => f.type === 'Corner' && f.position === neighborCornerFeatureIdx);

            if (neighborCornerFeature && neighborCornerFeature.feature === 'ThirdDot') {
                if (myCornerFeature.commodity !== neighborCornerFeature.commodity) {
                    return {
                        isValid: false,
                        reason: `Setup rule: Cannot place ${myCornerFeature.commodity} corner dot next to ${neighborCornerFeature.commodity} corner dot`
                    };
                }
            }
        }
    }

    return { isValid: true };
}

/**
 * Get all valid placements for a tile during setup
 */
export function getValidSetupPlacements(
    board: Record<string, HexCell>,
    type: IndustryType,
    setupTileCells: string[],
    _playerId: string
): Record<string, number[]> {
    const validPlacements: Record<string, number[]> = {};

    // Get all empty cells (except center)
    Object.entries(board).forEach(([cellId, cell]) => {
        const coords = stringToCoords(cellId);
        if (coords.q === 0 && coords.r === 0) return; // Skip center
        if (cell.occupant) return; // Skip occupied

        // Try all 6 orientations
        for (let orientation = 0; orientation < 6; orientation++) {
            const result = isValidSetupPlacement(
                board,
                cellId,
                type,
                orientation,
                setupTileCells,
                _playerId
            );

            if (result.isValid) {
                if (!validPlacements[cellId]) {
                    validPlacements[cellId] = [];
                }
                validPlacements[cellId].push(orientation);
            }
        }
    });

    return validPlacements;
}
