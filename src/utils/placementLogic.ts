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
/**
 * Validates dot alignment (Edge and Corner) for a tile placement.
 * @param board Current board state
 * @param cellId Target cell ID
 * @param type Industry type being placed
 * @param orientation Orientation (0-5)
 * @param ignoreCellId Optional cell ID to ignore (useful for moves)
 */
export function validateTileDots(
    board: Record<string, HexCell>,
    cellId: string,
    type: IndustryType,
    orientation: number,
    ignoreCellId?: string
): PlacementValidationResult {
    const def = TILE_DEFINITIONS[type];
    const coords = stringToCoords(cellId);

    // 1. Edge Adjacency Check
    for (let i = 0; i < 6; i++) {
        const neighborCoords = getNeighbor(coords, i);
        const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);

        if (neighborId === ignoreCellId) continue;

        const neighborCell = board[neighborId];
        if (!neighborCell) continue;

        if (neighborCell.occupant && neighborCell.occupant.type === 'Industry' && neighborCell.occupant.tile) {
            const neighborTile = neighborCell.occupant.tile;
            const neighborDef = TILE_DEFINITIONS[neighborTile.type];
            const neighborOrientation = neighborTile.orientation || 0;

            const myDefSideIndex = (i - orientation + 6) % 6;
            const sideFacingMe = (i + 3) % 6;
            const neighborDefSideIndex = (sideFacingMe - neighborOrientation + 6) % 6;

            const myFeature = def.features.find((f: TileFeature) => f.position === myDefSideIndex && f.type === 'Edge');
            const neighborFeature = neighborDef.features.find((f: TileFeature) => f.position === neighborDefSideIndex && f.type === 'Edge');

            if (myFeature && neighborFeature) {
                if (myFeature.feature === 'HalfDot' && neighborFeature.feature === 'HalfDot') {
                    if (myFeature.commodity !== neighborFeature.commodity) {
                        return { isValid: false, reason: 'Edge dot mismatch' };
                    }
                }
            }
        }
    }

    // 2. Corner Adjacency Check
    for (let cornerPos = 0; cornerPos < 6; cornerPos++) {
        // cornerPos 0 corresponds to definition position 5 at orientation 0 (there's a -1 offset)
        // To find which definition position appears at this corner: (cornerPos - 1 - orientation + 12) % 6
        const myCornerFeatureIdx = (cornerPos - 1 - orientation + 12) % 6;
        const myCornerFeature = def.features.find((f: TileFeature) => f.type === 'Corner' && f.position === myCornerFeatureIdx);

        if (!myCornerFeature || myCornerFeature.feature !== 'ThirdDot') continue;

        const edge1 = (cornerPos - 1 + 6) % 6;
        const edge2 = cornerPos;

        for (const edgeDir of [edge1, edge2]) {
            const neighborCoords = getNeighbor(coords, edgeDir);
            const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);

            if (neighborId === ignoreCellId) continue;

            const neighborCell = board[neighborId];

            if (!neighborCell || !neighborCell.occupant || neighborCell.occupant.type !== 'Industry' || !neighborCell.occupant.tile) {
                continue;
            }

            const neighborTile = neighborCell.occupant.tile;
            const neighborDef = TILE_DEFINITIONS[neighborTile.type];
            const neighborOrientation = neighborTile.orientation || 0;

            // Different offsets for the two edges of a corner:
            // edge1 (incoming) shares one vertex, edge2 (outgoing) shares the other
            let neighborCornerPos;
            if (edgeDir === edge1) {
                neighborCornerPos = (edgeDir + 3) % 6;
            } else {
                neighborCornerPos = (edgeDir + 4) % 6;
            }

            const neighborCornerFeatureIdx = (neighborCornerPos - 1 - neighborOrientation + 12) % 6;
            const neighborCornerFeature = neighborDef.features.find((f: TileFeature) => f.type === 'Corner' && f.position === neighborCornerFeatureIdx);

            if (neighborCornerFeature && neighborCornerFeature.feature === 'ThirdDot') {
                if (myCornerFeature.commodity !== neighborCornerFeature.commodity) {
                    return { isValid: false, reason: 'Corner dot mismatch' };
                }
            }
        }
    }

    return { isValid: true };
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

    // 2. Dot Alignment
    if (!force) {
        const dotValidation = validateTileDots(board, cellId, type, orientation);
        if (!dotValidation.isValid) return dotValidation;
    }

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

/**
 * Checks if a move from one cell to another is valid for a given tile.
 * Returns true if the move is valid (destination is empty/own flag and dots match).
 */
export function isValidMoveTarget(
    board: Record<string, HexCell>,
    fromId: string,
    toId: string,
    playerId: string,
    newOrientation?: number
): PlacementValidationResult {
    // Cannot move to center
    if (toId === '0,0') return { isValid: false, reason: 'Cannot move to center tile' };

    const fromCell = board[fromId];
    const toCell = board[toId];

    if (!fromCell?.occupant?.tile) return { isValid: false, reason: 'Invalid source' };

    // Destination must be empty or own flag
    if (toCell.occupant) {
        if (toCell.occupant.type !== 'Flag' || toCell.occupant.playerId !== playerId) {
            return { isValid: false, reason: 'Invalid destination' };
        }
    }

    // Check dot alignment
    const movedTile = fromCell.occupant.tile;
    const orientation = newOrientation !== undefined ? newOrientation : (movedTile.orientation || 0);

    return validateTileDots(board, toId, movedTile.type, orientation, fromId);
}

/**
 * Returns list of valid move target cell IDs for a tile at a given position.
 */
export function getValidMoveTargets(
    board: Record<string, HexCell>,
    fromId: string,
    playerId: string,
    newOrientation?: number
): string[] {
    const fromCell = board[fromId];
    if (!fromCell?.occupant?.tile) return [];

    const validTargets: string[] = [];

    Object.keys(board).forEach(toId => {
        if (toId === fromId) return; // Can't move to same cell

        if (newOrientation !== undefined) {
            if (isValidMoveTarget(board, fromId, toId, playerId, newOrientation).isValid) {
                validTargets.push(toId);
            }
        } else {
            // Check if ANY orientation works
            // logic: try 0..5
            for (let o = 0; o < 6; o++) {
                if (isValidMoveTarget(board, fromId, toId, playerId, o).isValid) {
                    validTargets.push(toId);
                    return; // found one valid orientation, so this target is valid
                }
            }
        }
    });

    return validTargets;
}

