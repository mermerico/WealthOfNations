import type { IndustryType, Player, HexCell, TileFeature } from '../types/gameState';
import { TILE_DEFINITIONS } from './tileDefinitions';
import { coordsToString, stringToCoords, getNeighbor } from './hexUtils';

export interface PlacementValidationResult {
    isValid: boolean;
    reason?: string;
}

/**
 * Checks if a specific placement is valid.
 */
export function isValidPlacement(
    board: Record<string, HexCell>,
    cellId: string,
    type: IndustryType,
    orientation: number,
    player: Player,
    force: boolean = false
): PlacementValidationResult {
    const cell = board[cellId];
    if (!cell) return { isValid: false, reason: 'Invalid cell' };

    // 0. Cannot place on center tile
    if (cellId === '0,0') {
        return { isValid: false, reason: 'Cannot place on center tile' };
    }

    // 1. Must have Player's Flag
    if (!cell.occupant || cell.occupant.type !== 'Flag' || cell.occupant.playerId !== player.id) {
        return { isValid: false, reason: 'Must place on your own flag' };
    }

    // 2. Adjacency Check
    const def = TILE_DEFINITIONS[type];
    const coords = stringToCoords(cellId);
    let validAdjacency = true;

    for (let i = 0; i < 6; i++) {
        const neighborCoords = getNeighbor(coords, i);
        const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);
        const neighborCell = board[neighborId];

        if (!neighborCell) continue;

        // Neighbor Logic from rules
        if (neighborCell.occupant && neighborCell.occupant.type === 'Industry' && neighborCell.occupant.tile) {
            const neighborTile = neighborCell.occupant.tile;
            const neighborDef = TILE_DEFINITIONS[neighborTile.type];
            const neighborOrientation = neighborTile.orientation || 0;

            // My side: i relative to my orientation
            // Feature position is absolute (0=N, 1=NE...). Rolled by orientation.
            // Effective Feature Index = (i - orientation + 6) % 6 ? 
            // NO. The feature definition uses absolute positions 0-5 on the tile model (N, NE...).
            // When tile is rotated by R (multiples of 60 deg clockwise):
            // The feature originally at Pos P moves to (P + R) % 6.
            // So we look for a feature whose CURRENT position (P_curr) matches the side `i`.
            // P_curr = (P_def + R) % 6  === i
            // So P_def = (i - R + 6) % 6.

            const myDefSideIndex = (i - orientation + 6) % 6;

            // Neighbor side facing me is (i + 3) % 6
            const sideFacingMe = (i + 3) % 6;
            // Neighbor feature definition index matching that side:
            const neighborDefSideIndex = (sideFacingMe - neighborOrientation + 6) % 6;

            const myFeature = def.features.find((f: TileFeature) => f.position === myDefSideIndex && f.type === 'Edge');
            const neighborFeature = neighborDef.features.find((f: TileFeature) => f.position === neighborDefSideIndex && f.type === 'Edge');

            if (myFeature && neighborFeature) {
                if (myFeature.feature === 'HalfDot' && neighborFeature.feature === 'HalfDot') {
                    if (myFeature.commodity !== neighborFeature.commodity) {
                        validAdjacency = false;
                        break;
                    }
                }
            }
        }
    }

    if (!validAdjacency && !force) {
        return { isValid: false, reason: 'Adjacency mismatch' };
    }

    // 3. Corner matching check - check ThirdDots at corners
    // Each corner is shared by up to 3 hexes. Corner at position C is between edges (C-1) and C.
    // For corner at position C, it's shared with neighbors at edges (C-1+6)%6 and C.
    for (let cornerPos = 0; cornerPos < 6; cornerPos++) {
        const myCornerFeatureIdx = (cornerPos - orientation + 6) % 6;
        const myCornerFeature = def.features.find((f: TileFeature) => f.type === 'Corner' && f.position === myCornerFeatureIdx);

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
            const neighborCornerFeature = neighborDef.features.find((f: TileFeature) => f.type === 'Corner' && f.position === neighborCornerFeatureIdx);

            if (neighborCornerFeature && neighborCornerFeature.feature === 'ThirdDot') {
                if (myCornerFeature.commodity !== neighborCornerFeature.commodity) {
                    if (!force) {
                        return { isValid: false, reason: 'Corner adjacency mismatch' };
                    }
                }
            }
        }
    }

    // Force Check handled by caller (cost check), but logic is valid if force=true
    return { isValid: true };
}

/**
 * Returns map of CellID -> Array of Valid Orientations
 */
export function getValidPlacements(
    board: Record<string, HexCell>,
    type: IndustryType,
    player: Player,
    force: boolean = false
): Record<string, number[]> {
    const valid: Record<string, number[]> = {};

    Object.values(board).forEach((cell: HexCell) => {
        const id = coordsToString(cell.q, cell.r);
        // Quick fail: Must implement minimal checks (Flag check)
        if (cell.occupant?.type === 'Flag' && cell.occupant.playerId === player.id) {
            const orientations: number[] = [];
            for (let o = 0; o < 6; o++) {
                if (isValidPlacement(board, id, type, o, player, force).isValid) {
                    orientations.push(o);
                }
            }
            if (orientations.length > 0) {
                valid[id] = orientations;
            }
        }
    });

    return valid;
}
