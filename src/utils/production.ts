import type { HexCell, CommodityType } from '../types/gameState';
import { getNeighbors, coordsToString } from './hexUtils';
import { TILE_DEFINITIONS } from './tileDefinitions';

interface ProductionInfo {
    commodity: CommodityType | 'Money';
    amount: number;
    log: string[];
}

// Find all connected tiles of same type (and owner)
export function identifyBloc(board: Record<string, HexCell>, startCell: HexCell): HexCell[] {
    if (!startCell.occupant?.tile) return [];

    const type = startCell.occupant.tile.type;
    const owner = startCell.occupant.tile.ownerId; // Currently 'p1' mostly
    const bloc: HexCell[] = [startCell];
    const visited = new Set<string>([coordsToString(startCell.q, startCell.r)]);
    const queue = [startCell];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = getNeighbors(current, board);

        for (const neighbor of neighbors) {
            if (!neighbor || !neighbor.occupant?.tile) continue;

            const nTile = neighbor.occupant.tile;
            const nId = coordsToString(neighbor.q, neighbor.r);

            if (!visited.has(nId) && nTile.type === type && nTile.ownerId === owner) {
                visited.add(nId);
                bloc.push(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return bloc;
}

export interface BlocCosts {
    Food: number;
    Energy: number;
    Labor: number;
    Ore: number;
}

export function calculateBlocCosts(bloc: HexCell[], automatedOverride: boolean = false): BlocCosts {
    const costs = { Food: 0, Energy: 0, Labor: 0, Ore: 0 };
    if (bloc.length === 0) return costs;

    const type = bloc[0].occupant!.tile!.type;
    // Use the override value directly - don't check tiles when explicitly set to false
    const automated = automatedOverride;

    // 1. Food: 1 per tile, unless Farm (0) or Automated (0, paid in Ore).
    if (type !== 'Farm') {
        if (automated) {
            // Automated: Paid in Ore instead
            costs.Ore = 1; // 1 Ore for entire bloc
        } else {
            costs.Food = bloc.length;
        }
    }

    // 2. Energy: 1 per Bloc, unless Generator (0).
    if (type !== 'Generator') {
        costs.Energy = 1;
    }

    // 3. Labor: None for production usually? Rules didn't mention Labor for production.

    return costs;
}

export function calculateProduction(board: Record<string, HexCell>, cell: HexCell, activeTileIds?: Set<string>): ProductionInfo | null {
    if (cell.occupant?.type !== 'Industry' || !cell.occupant.tile) return null;

    // If specific active set provided and this cell not in it, return 0 (or null)
    const cellId = coordsToString(cell.q, cell.r);
    if (activeTileIds && !activeTileIds.has(cellId)) return null;

    const bloc = identifyBloc(board, cell);
    if (bloc.length === 0) return null;

    // Base info from the type (all same in bloc)
    const type = bloc[0].occupant!.tile!.type;
    const def = TILE_DEFINITIONS[type];

    // Heuristic for commodity
    let commodity: CommodityType | 'Money' = 'Money';
    if (type === 'Farm') commodity = 'Food';
    else if (type === 'Generator') commodity = 'Energy';
    else if (type === 'Academy') commodity = 'Labor';
    else if (type === 'Mine') commodity = 'Ore';
    else if (type === 'Factory') commodity = 'Capital';
    else if (type === 'Bank') commodity = 'Money';

    let amount = 0;
    const log: string[] = [];

    // Note: This function calculates production for a SINGLE TILE "cell".
    // Or for the whole Bloc? 
    // Previous implementation was per-tile logic summed in calculateGlobalProduction?
    // No, previous implementation: `calculateProduction` calculated for the BLOCK because it called `getBloc` and iterated `bloc.forEach`.

    log.push(`Bloc Size: ${bloc.length} Tiles`);

    // Calculate contribution of each tile in the bloc
    bloc.forEach(member => {
        const memberId = coordsToString(member.q, member.r);

        // Skip if member is not active (if filtering)
        if (activeTileIds && !activeTileIds.has(memberId)) return;

        const memberTile = member.occupant!.tile!;
        const memberRot = memberTile.orientation || 0;

        // 1. Center Dot
        if (def.hasCenterDot) {
            amount += 1;
            // log.push(`Base (+1 Center) from ${memberId}`); 
        }

        // 2. Edge Matches
        // To avoid double counting internal matches, we can:
        // A. Iterate all neighbors. If neighbor is in Bloc, check match. 
        //    If match, add 0.5. (Total match = 1).
        // B. Keep set of checked edges.

        // Let's use the 0.5 method for robustness (Simpler loop)
        const neighbors = getNeighbors(member, board);

        for (let i = 0; i < 6; i++) {
            const neighbor = neighbors[i];

            // Only count if neighbor exists and has a tile
            // Note: Does production count matches with tiles OUTSIDE the bloc?
            // "When two tiles are adjacent... they form a Full Dot."
            // If I have a Farm next to an enemy Farm, do we both get +0.5? Or do we form a dot?
            // Usually in WoN, you produce for your Bloc. 
            // If the rule implies only matching types form dots, then effectively only same-type neighbors matter.
            // If they are same-type and neighbor is NOT in bloc... that implies different owner?
            // Let's assume for now we count ALL matches with compatible tiles, regardless of owner.
            // But usually Bloc calculations sum the bloc.
            // Let's stick to: Count matches with any compatible neighbor.
            // User requested "3 food" for 2 adjacent farms.

            if (!neighbor || !neighbor.occupant?.tile) continue;

            const nId = coordsToString(neighbor.q, neighbor.r);
            // If neighbor not active, do we count match?
            // "Only dots on fed tiles produce." -> If neighbor is unfed, its half of dot is "off".
            if (activeTileIds && !activeTileIds.has(nId)) continue;

            const nTile = neighbor.occupant.tile;
            const nDef = TILE_DEFINITIONS[nTile.type];
            if (!nDef) continue;

            // Enforce Shared Dot Rule: Only produces if owners match
            if (nTile.ownerId !== memberTile.ownerId) continue;

            const myDefIndex = (i - memberRot + 6) % 6;
            const nPhysIndex = (i + 3) % 6;
            const nRot = nTile.orientation || 0;
            const nDefIndex = (nPhysIndex - nRot + 6) % 6;

            const myFeature = def.features.find(f => f.type === 'Edge' && f.position === myDefIndex);
            const nFeature = nDef.features.find(f => f.type === 'Edge' && f.position === nDefIndex);

            if (myFeature && nFeature && myFeature.commodity === nFeature.commodity) {
                amount += 0.5;
                // log.push(`+0.5 Match at ${memberId} Dir ${i}`);
            }
        }

        // 3. Corner Matches (Tri-Points)
        // Corner k (between Side k and k+1) touches Side k of Me, Side (k+2) of Neighbor(k), Side (k+4) of Neighbor(k+1).
        // Vertex Triad: { Me, Neighbor[k], Neighbor[(k+1)%6] }.
        // Feature Indices involved:
        // Me: Corner k
        // Neighbor[k]: Corner (k+2)%6
        // Neighbor[(k+1)%6]: Corner (k+4)%6

        for (let k = 0; k < 6; k++) {
            const n1 = neighbors[k];
            const n2 = neighbors[(k + 1) % 6];

            if (!n1 || !n1.occupant?.tile || !n2 || !n2.occupant?.tile) continue;

            const n1Id = coordsToString(n1.q, n1.r);
            const n2Id = coordsToString(n2.q, n2.r);
            if (activeTileIds && (!activeTileIds.has(n1Id) || !activeTileIds.has(n2Id))) continue;

            const t1 = n1.occupant.tile;
            const t2 = n2.occupant.tile;
            const def1 = TILE_DEFINITIONS[t1.type];
            const def2 = TILE_DEFINITIONS[t2.type];

            if (!def1 || !def2) continue;

            // Shared Dot Rule: All 3 must have same owner
            if (t1.ownerId !== memberTile.ownerId || t2.ownerId !== memberTile.ownerId) continue;

            const myRot = memberRot;
            const rot1 = t1.orientation || 0;
            const rot2 = t2.orientation || 0;

            // Physical Corner k is between Side k and Side k+1.
            const myDefIdx = (k - myRot + 6) % 6;
            const n1DefIdx = ((k + 2) % 6 - rot1 + 6) % 6;
            const n2DefIdx = ((k + 4) % 6 - rot2 + 6) % 6;

            const fMe = def.features.find(f => f.type === 'Corner' && f.position === myDefIdx);
            const f1 = def1.features.find(f => f.type === 'Corner' && f.position === n1DefIdx);
            const f2 = def2.features.find(f => f.type === 'Corner' && f.position === n2DefIdx);



            if (fMe && f1 && f2 && fMe.feature === 'ThirdDot' && f1.feature === 'ThirdDot' && f2.feature === 'ThirdDot') {
                if (fMe.commodity === f1.commodity && fMe.commodity === f2.commodity) {
                    amount += 1 / 3;
                }
            }
        }
    });

    log.push(`Total Centers: ${bloc.filter(_b => def.hasCenterDot).length}`);
    log.push(`Total Connection Bonus: ${Math.round((amount - bloc.filter(_b => def.hasCenterDot).length) * 100) / 100}`);

    // Round total amount to nearest integer (or 1 decimal if needed, but rules imply integers)
    // "Complete a corner circle" -> 1 dot.
    amount = Math.round(amount * 10) / 10; // keep 1 decimal if 0.5 exists, but 0.33? 
    // Actually, if we have complete dots, we expect X.0. If we have 2 edges (1 dot) and 1 corner (1 dot), we have integer.
    // If we have floating edges? 0.5?
    // User expects "3 Food" from 2 farms. 2.0 (centers) + 1.0 (edges, 0.5 * 2).
    // So usually integer.

    return { commodity, amount, log };
}

export interface ProductionResult {
    outputs: Record<CommodityType | 'Money', number>;
    costs: BlocCosts;
    logs: string[];
}

export function calculateGlobalProduction(board: Record<string, HexCell>): Record<string, ProductionResult> {
    const playerResults: Record<string, ProductionResult> = {};
    const visited = new Set<string>();

    Object.values(board).forEach(cell => {
        const id = coordsToString(cell.q, cell.r);
        if (visited.has(id)) return;
        if (cell.occupant?.type !== 'Industry' || !cell.occupant.tile) return;

        const ownerId = cell.occupant.tile.ownerId;
        if (!playerResults[ownerId]) {
            playerResults[ownerId] = {
                outputs: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0, Money: 0 },
                costs: { Food: 0, Energy: 0, Labor: 0, Ore: 0 },
                logs: []
            };
        }

        const bloc = identifyBloc(board, cell);
        // Check if any tile in the bloc is automated
        const hasAutomation = bloc.some(b => b.occupant?.tile?.automated);
        const prod = calculateProduction(board, cell);
        const costs = calculateBlocCosts(bloc, hasAutomation);

        if (prod) {
            playerResults[ownerId].outputs[prod.commodity] += prod.amount;
            playerResults[ownerId].costs.Food += costs.Food;
            playerResults[ownerId].costs.Energy += costs.Energy;
            playerResults[ownerId].costs.Labor += costs.Labor;
            playerResults[ownerId].costs.Ore += costs.Ore;
            playerResults[ownerId].logs.push(...prod.log);
        }

        bloc.forEach(b => visited.add(coordsToString(b.q, b.r)));
    });

    return playerResults;
}
