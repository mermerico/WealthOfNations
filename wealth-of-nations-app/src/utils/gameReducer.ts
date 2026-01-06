/**
 * Pure game state reducer - handles all game actions
 * This can be tested independently of React
 */

import type { GameState, CommodityType, IndustryType, Player } from '../types/gameState';
import { coordsToString, stringToCoords, getNeighbors } from './hexUtils';
import { calculateGlobalProduction, identifyBloc, calculateBlocCosts, calculateProduction } from './production';
import { TILE_DEFINITIONS } from './tileDefinitions';
import { MARKET_STEPS } from './marketDefinitions';
import { isValidPlacement } from './placementLogic';
import { getAvailablePackages } from './packageDefinitions';
import { getDraftOrder, getDraftRoundInfo } from './setupLogic';
import { isValidSetupPlacement } from './setupPlacementLogic';
import { generateGrid } from './hexUtils';

export interface ActionResult {
    success: boolean;
    message?: string;
    newState?: GameState;
}

/**
 * Verify flag and tile counts are consistent
 * Total flags/tiles on board + remaining = initial amount
 */
function assertConsistency(state: GameState): void {
    // Count flags and tiles on board
    const flagsOnBoard: Record<string, number> = {};
    const tilesOnBoard: Record<IndustryType, number> = {
        Farm: 0,
        Generator: 0,
        Academy: 0,
        Mine: 0,
        Factory: 0,
        Bank: 0
    };

    for (const playerId of state.players.map(p => p.id)) {
        flagsOnBoard[playerId] = 0;
    }

    Object.values(state.board).forEach(cell => {
        if (cell.occupant) {
            if (cell.occupant.type === 'Flag') {
                flagsOnBoard[cell.occupant.playerId]++;
            } else if (cell.occupant.type === 'Industry' && cell.occupant.tile) {
                tilesOnBoard[cell.occupant.tile.type]++;
                // Industry tiles implicitly have a flag underneath them
                flagsOnBoard[cell.occupant.playerId]++;
            }
        }
    });

    // Check each player's flags
    state.players.forEach(player => {
        const totalFlags = player.flags + flagsOnBoard[player.id];
        if (totalFlags !== state.initialFlagsPerPlayer) {
            console.error(`Flag count mismatch for ${player.name}: ${totalFlags} !== ${state.initialFlagsPerPlayer}`);
            console.error(`  Player has: ${player.flags}, On board: ${flagsOnBoard[player.id]}`);
            throw new Error(`Flag count inconsistency for ${player.name}`);
        }
    });

    // Check tiles
    for (const tileType of Object.keys(state.tilesRemaining) as IndustryType[]) {
        const total = state.tilesRemaining[tileType] + tilesOnBoard[tileType];
        if (total !== state.initialTiles[tileType]) {
            console.error(`Tile count mismatch for ${tileType}: ${total} !== ${state.initialTiles[tileType]}`);
            console.error(`  Remaining: ${state.tilesRemaining[tileType]}, On board: ${tilesOnBoard[tileType]}`);
            throw new Error(`Tile count inconsistency for ${tileType}`);
        }
    }
}

/**
 * Helper to reset pass indicators for players taking actions
 */
function resetPlayerPass(players: any[], playerIndex: number, updates: any) {
    return players.map((p, i) =>
        i === playerIndex ? { ...p, ...updates, hasPassed: false } : p
    );
}

/**
 * Process a game action and return the new state
 * This is a pure function - no side effects, no React dependencies
 */
export function gameReducer(state: GameState, action: string, payload?: any): ActionResult {
    switch (action) {
        // ===== SETUP PHASE ACTIONS =====
        case 'startSetup': {
            // Randomly choose first player
            const randomFirstPlayer = Math.floor(Math.random() * state.players.length);
            const draftOrder = getDraftOrder(0, state.players.length, randomFirstPlayer);

            return {
                success: true,
                newState: {
                    ...state,
                    phase: 'Setup',
                    board: generateGrid(4),
                    firstPlayerIndex: randomFirstPlayer,
                    setupPhase: {
                        step: 'selectPackage',
                        firstPlayerIndex: randomFirstPlayer,
                        draftRound: 0,
                        currentDrafterIndex: draftOrder[0],
                        takenPackageIds: [],
                        pendingPlacement: null
                    }
                }
            };
        }

        case 'determineFirstPlayer': {
            if (!payload) return { success: false, message: 'Missing payload' };
            if (state.phase !== 'Setup' || !state.setupPhase) return { success: false, message: 'Not in Setup phase' };
            if (state.setupPhase.step !== 'determineFirstPlayer') return { success: false, message: 'Wrong setup step' };

            const { playerIndex } = payload;
            if (playerIndex < 0 || playerIndex >= state.players.length) return { success: false, message: 'Invalid player index' };

            const draftOrder = getDraftOrder(0, state.players.length, playerIndex);

            return {
                success: true,
                newState: {
                    ...state,
                    setupPhase: {
                        ...state.setupPhase,
                        step: 'selectPackage',
                        firstPlayerIndex: playerIndex,
                        currentDrafterIndex: draftOrder[0]
                    }
                }
            };
        }

        case 'selectPackage': {
            if (!payload) return { success: false, message: 'Missing payload' };
            if (state.phase !== 'Setup' || !state.setupPhase) return { success: false, message: 'Not in Setup phase' };
            if (state.setupPhase.step !== 'selectPackage') return { success: false, message: 'Wrong setup step' };

            const { packageId } = payload;

            // Verify package is available
            const available = getAvailablePackages(state.players.length, state.setupPhase.takenPackageIds);
            const pkg = available.find(p => p.id === packageId);
            if (!pkg) return { success: false, message: 'Package not available' };

            // Add package money and commodities to current player
            const currentPlayer = state.players[state.setupPhase.currentDrafterIndex];
            const newPlayers = [...state.players];
            newPlayers[state.setupPhase.currentDrafterIndex] = {
                ...currentPlayer,
                money: currentPlayer.money + pkg.money,
                resources: {
                    Food: currentPlayer.resources.Food + (pkg.commodities.Food || 0),
                    Energy: currentPlayer.resources.Energy + (pkg.commodities.Energy || 0),
                    Labor: currentPlayer.resources.Labor + (pkg.commodities.Labor || 0),
                    Ore: currentPlayer.resources.Ore + (pkg.commodities.Ore || 0),
                    Capital: currentPlayer.resources.Capital + (pkg.commodities.Capital || 0)
                }
            };

            // If no tiles to place (commodity package), auto-advance to next player
            if (pkg.tiles.length === 0) {
                const { draftRound, firstPlayerIndex } = state.setupPhase;
                const playerCount = state.players.length;
                const draftOrder = getDraftOrder(draftRound, playerCount, firstPlayerIndex);
                const currentIndex = draftOrder.indexOf(state.setupPhase.currentDrafterIndex);

                if (currentIndex === draftOrder.length - 1) {
                    // Round complete
                    const nextRound = draftRound + 1;
                    const { totalRounds } = getDraftRoundInfo(playerCount, nextRound);
                    if (nextRound >= totalRounds) {
                        // Setup complete
                        return {
                            success: true,
                            newState: {
                                ...state,
                                players: newPlayers,
                                phase: 'Trade',
                                currentTurnPlayerIndex: firstPlayerIndex,
                                setupPhase: undefined
                            }
                        };
                    } else {
                        // Start next round
                        const nextDraftOrder = getDraftOrder(nextRound, playerCount, firstPlayerIndex);
                        return {
                            success: true,
                            newState: {
                                ...state,
                                players: newPlayers,
                                setupPhase: {
                                    ...state.setupPhase,
                                    step: 'selectPackage',
                                    draftRound: nextRound,
                                    currentDrafterIndex: nextDraftOrder[0],
                                    takenPackageIds: [...state.setupPhase.takenPackageIds, packageId],
                                    pendingPlacement: null
                                }
                            }
                        };
                    }
                } else {
                    // Next drafter in same round
                    return {
                        success: true,
                        newState: {
                            ...state,
                            players: newPlayers,
                            setupPhase: {
                                ...state.setupPhase,
                                step: 'selectPackage',
                                currentDrafterIndex: draftOrder[currentIndex + 1],
                                takenPackageIds: [...state.setupPhase.takenPackageIds, packageId],
                                pendingPlacement: null
                            }
                        }
                    };
                }
            }

            // Has tiles to place
            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    setupPhase: {
                        ...state.setupPhase,
                        step: 'placeTile',
                        takenPackageIds: [...state.setupPhase.takenPackageIds, packageId],
                        pendingPlacement: {
                            packageId,
                            tilesRemaining: pkg.tiles,
                            placementHistory: []
                        }
                    }
                }
            };
        }

        case 'placeSetupTile': {
            if (!payload) return { success: false, message: 'Missing payload' };
            if (state.phase !== 'Setup' || !state.setupPhase) return { success: false, message: 'Not in Setup phase' };
            if (state.setupPhase.step !== 'placeTile' || !state.setupPhase.pendingPlacement) return { success: false, message: 'Wrong setup step' };

            const { cellId, tileType, orientation } = payload;
            const currentPlayer = state.players[state.setupPhase.currentDrafterIndex];

            // Get list of tiles already placed by this player during setup
            const setupTileCells = Object.entries(state.board)
                .filter(([_, cell]) => cell.occupant?.type === 'Industry' && cell.occupant.playerId === currentPlayer.id)
                .map(([id, _]) => id);

            // Validate placement
            const validation = isValidSetupPlacement(state.board, cellId, tileType, orientation, setupTileCells, currentPlayer.id);
            if (!validation.isValid) {
                return { success: false, message: validation.reason };
            }

            // Place the tile
            const newBoard = { ...state.board };
            newBoard[cellId] = {
                ...newBoard[cellId],
                occupant: {
                    type: 'Industry',
                    playerId: currentPlayer.id,
                    tile: {
                        id: cellId,
                        type: tileType,
                        ownerId: currentPlayer.id,
                        orientation,
                        active: true,
                        automated: false
                    }
                }
            };

            // Update pending placement
            const { packageId, tilesRemaining, placementHistory } = state.setupPhase.pendingPlacement;
            const tileIndex = tilesRemaining.indexOf(tileType);
            const updatedTiles = [...tilesRemaining.slice(0, tileIndex), ...tilesRemaining.slice(tileIndex + 1)];
            const updatedHistory = [...placementHistory, cellId];

            // Decrement global tiles remaining
            const newTilesRemaining = {
                ...state.tilesRemaining,
                [tileType]: state.tilesRemaining[tileType as IndustryType] - 1
            };

            // Decrement player flags (tiles have implicit flags underneath)
            const newPlayers = state.players.map((p, i) =>
                i === state.setupPhase!.currentDrafterIndex
                    ? { ...p, flags: p.flags - 1 }
                    : p
            );

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    setupPhase: {
                        ...state.setupPhase,
                        pendingPlacement: {
                            packageId,
                            tilesRemaining: updatedTiles,
                            placementHistory: updatedHistory
                        }
                    },
                    board: newBoard,
                    tilesRemaining: newTilesRemaining
                }
            };
        }

        case 'undoSetupPlacement': {
            if (state.phase !== 'Setup' || !state.setupPhase) return { success: false, message: 'Not in Setup phase' };
            if (state.setupPhase.step !== 'placeTile' || !state.setupPhase.pendingPlacement) return { success: false, message: 'Wrong setup step' };

            const { packageId, tilesRemaining, placementHistory } = state.setupPhase.pendingPlacement;

            if (placementHistory.length === 0) return { success: false, message: 'Nothing to undo' };

            // Get the last placed cell ID
            const lastCellId = placementHistory[placementHistory.length - 1];
            const lastCell = state.board[lastCellId];

            if (!lastCell?.occupant?.tile) return { success: false, message: 'Invalid cell' };

            const newBoard = { ...state.board };
            newBoard[lastCellId] = {
                ...newBoard[lastCellId],
                occupant: null
            };

            // Add the tile back to tilesRemaining
            const updatedTiles = [...tilesRemaining, lastCell.occupant.tile.type];
            const updatedHistory = placementHistory.slice(0, -1);

            // Increment global tiles remaining
            const newTilesRemaining = {
                ...state.tilesRemaining,
                [lastCell.occupant.tile.type]: state.tilesRemaining[lastCell.occupant.tile.type as IndustryType] + 1
            };

            // Increment player flags (restore flag from under tile)
            const newPlayers = state.players.map((p, i) =>
                i === state.setupPhase!.currentDrafterIndex
                    ? { ...p, flags: p.flags + 1 }
                    : p
            );

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    setupPhase: {
                        ...state.setupPhase,
                        pendingPlacement: {
                            packageId,
                            tilesRemaining: updatedTiles,
                            placementHistory: updatedHistory
                        }
                    },
                    board: newBoard,
                    tilesRemaining: newTilesRemaining
                }
            };
        }

        // ===== TRADE/DEVELOP/PRODUCE ACTIONS =====

        case 'rotateSetupTile': {
            if (state.phase !== 'Setup' || !state.setupPhase) return { success: false, message: 'Not in Setup phase' };
            if (state.setupPhase.step !== 'placeTile' || !state.setupPhase.pendingPlacement) return { success: false, message: 'Wrong setup step' };

            const { placementHistory } = state.setupPhase.pendingPlacement;
            if (placementHistory.length === 0) return { success: false, message: 'Nothing to rotate' };

            // Get the last placed cell ID
            const lastCellId = placementHistory[placementHistory.length - 1];
            const lastCell = state.board[lastCellId];

            if (!lastCell?.occupant?.tile) return { success: false, message: 'Invalid cell' };

            const currentOrientation = lastCell.occupant.tile.orientation || 0;
            const tileType = lastCell.occupant.tile.type;
            const currentPlayer = state.players[state.setupPhase.currentDrafterIndex];

            // Get tiles placed BEFORE this one for validation
            const setupTileCellsBeforeThis = placementHistory.slice(0, -1);

            // Temporarily remove this tile from the board for validation
            const tempBoard = { ...state.board };
            tempBoard[lastCellId] = {
                ...tempBoard[lastCellId],
                occupant: null
            };

            // Find the next valid orientation by trying each one
            let newOrientation = currentOrientation;
            for (let attempt = 0; attempt < 6; attempt++) {
                newOrientation = (currentOrientation + attempt + 1) % 6;
                const validation = isValidSetupPlacement(tempBoard, lastCellId, tileType, newOrientation, setupTileCellsBeforeThis, currentPlayer.id);
                if (validation.isValid) {
                    break;
                }
            }

            // If we cycled back to current orientation, no valid rotations exist
            if (newOrientation === currentOrientation) {
                return { success: false, message: 'No valid rotations available' };
            }

            const newBoard = { ...state.board };
            newBoard[lastCellId] = {
                ...newBoard[lastCellId],
                occupant: {
                    ...lastCell.occupant,
                    tile: {
                        ...lastCell.occupant.tile,
                        orientation: newOrientation
                    }
                }
            };

            return {
                success: true,
                newState: {
                    ...state,
                    board: newBoard
                }
            };
        }

        case 'pass': {
            // Special handling for Setup phase
            if (state.phase === 'Setup' && state.setupPhase?.step === 'placeTile') {
                if (!state.setupPhase.pendingPlacement) return { success: false, message: 'No pending placement' };

                // Only allow pass when all tiles are placed
                if (state.setupPhase.pendingPlacement.tilesRemaining.length > 0) {
                    return { success: false, message: 'Must place all tiles before passing' };
                }

                // Move to next drafter
                const { draftRound, firstPlayerIndex } = state.setupPhase;
                const playerCount = state.players.length;
                const draftOrder = getDraftOrder(draftRound, playerCount, firstPlayerIndex);
                const currentIndex = draftOrder.indexOf(state.setupPhase.currentDrafterIndex);

                if (currentIndex === draftOrder.length - 1) {
                    // Round complete
                    const nextRound = draftRound + 1;
                    const { totalRounds } = getDraftRoundInfo(playerCount, nextRound);
                    if (nextRound >= totalRounds) {
                        // Setup complete
                        return {
                            success: true,
                            newState: {
                                ...state,
                                phase: 'Trade',
                                currentTurnPlayerIndex: firstPlayerIndex,
                                firstPlayerIndex: firstPlayerIndex,
                                setupPhase: undefined
                            }
                        };
                    } else {
                        // Start next round
                        const nextDraftOrder = getDraftOrder(nextRound, playerCount, firstPlayerIndex);
                        return {
                            success: true,
                            newState: {
                                ...state,
                                setupPhase: {
                                    ...state.setupPhase,
                                    step: 'selectPackage',
                                    draftRound: nextRound,
                                    currentDrafterIndex: nextDraftOrder[0],
                                    pendingPlacement: null
                                }
                            }
                        };
                    }
                } else {
                    // Next drafter in same round
                    return {
                        success: true,
                        newState: {
                            ...state,
                            setupPhase: {
                                ...state.setupPhase,
                                step: 'selectPackage',
                                currentDrafterIndex: draftOrder[currentIndex + 1],
                                pendingPlacement: null
                            }
                        }
                    };
                }
            }

            // Mark current player as having passed
            const playersWithPass = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex ? { ...p, hasPassed: true } : p
            );

            // Normal pass handling for Trade/Develop/Produce phases
            const newConsecutivePasses = state.consecutivePasses + 1;

            // Check if game should end (isLastRound + all players pass in Trade phase)
            if (state.isLastRound && state.phase === 'Trade' && newConsecutivePasses >= state.players.length) {
                return {
                    success: true,
                    newState: {
                        ...state,
                        players: playersWithPass,
                        gameEnded: true,
                        consecutivePasses: 0
                    }
                };
            }

            // Check if all players have passed
            if (newConsecutivePasses >= state.players.length) {
                // Clear all pass indicators when advancing phase
                const playersWithoutPass = playersWithPass.map(p => ({ ...p, hasPassed: false }));

                // Advance phase
                if (state.phase === 'Trade') {
                    return {
                        success: true,
                        newState: {
                            ...state,
                            players: playersWithoutPass,
                            phase: 'Develop',
                            consecutivePasses: 0,
                            currentTurnPlayerIndex: state.firstPlayerIndex
                        }
                    };
                } else if (state.phase === 'Develop') {
                    return {
                        success: true,
                        newState: {
                            ...state,
                            players: playersWithoutPass,
                            phase: 'Produce',
                            consecutivePasses: 0
                        }
                    };
                } else if (state.phase === 'Produce') {
                    // Next round - rotate first player
                    const nextFirstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;

                    console.log('[gameReducer] Produce → Trade transition:');
                    console.log(`  Current firstPlayerIndex: ${state.firstPlayerIndex}`);
                    console.log(`  Next firstPlayerIndex: ${nextFirstPlayerIndex}`);
                    console.log(`  Current round: ${state.round}`);
                    console.log(`  Next round: ${state.round + 1}`);

                    return {
                        success: true,
                        newState: {
                            ...state,
                            players: playersWithoutPass,
                            phase: 'Trade',
                            round: state.round + 1,
                            consecutivePasses: 0,
                            firstPlayerIndex: nextFirstPlayerIndex,
                            currentTurnPlayerIndex: nextFirstPlayerIndex
                        }
                    };
                }
            } else {
                // Next player
                const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

                return {
                    success: true,
                    newState: {
                        ...state,
                        players: playersWithPass,
                        consecutivePasses: newConsecutivePasses,
                        currentTurnPlayerIndex: nextPlayerIndex
                    }
                };
            }
            break;
        }

        case 'buy': {
            if (!payload) return { success: false, message: 'Missing commodity type' };

            // Support both formats: 'Food' or { commodity: 'Food' }
            const type = (typeof payload === 'string' ? payload : payload.commodity) as CommodityType;
            const stock = state.markets[type].stock;
            if (stock <= 0) return { success: false, message: 'Market empty' };

            const price = MARKET_STEPS[stock - 1].buy;
            const player = state.players[state.currentTurnPlayerIndex];

            if (player.money < price) return { success: false, message: 'Not enough money' };

            const newPlayers = resetPlayerPass(state.players, state.currentTurnPlayerIndex, {
                money: player.money - price,
                resources: {
                    ...player.resources,
                    [type]: player.resources[type] + 1
                }
            });

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    markets: {
                        ...state.markets,
                        [type]: { ...state.markets[type], stock: stock - 1 }
                    },
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex
                }
            };
        }

        case 'sell': {
            if (!payload) return { success: false, message: 'Missing commodity type' };

            // Support both formats: 'Food' or { commodity: 'Food' }
            const type = (typeof payload === 'string' ? payload : payload.commodity) as CommodityType;
            const stock = state.markets[type].stock;
            if (stock >= MARKET_STEPS.length) return { success: false, message: 'Market full' };

            const price = MARKET_STEPS[stock].sell;
            const player = state.players[state.currentTurnPlayerIndex];

            if (player.resources[type] <= 0) return { success: false, message: 'No resource to sell' };

            const newPlayers = resetPlayerPass(state.players, state.currentTurnPlayerIndex, {
                money: player.money + price,
                resources: {
                    ...player.resources,
                    [type]: player.resources[type] - 1
                }
            });

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    markets: {
                        ...state.markets,
                        [type]: { ...state.markets[type], stock: stock + 1 }
                    },
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex
                }
            };
        }



        case 'proposeTrade': {
            if (!payload) return { success: false, message: 'Missing trade details' };
            if (state.phase !== 'Trade') return { success: false, message: 'Can only trade in Trade phase' };
            if (state.pendingTrade) return { success: false, message: 'A trade is already pending' };

            const { proposerId, targetId, giving, receiving } = payload;

            // Basic validation
            if (!proposerId || !targetId || !giving || !receiving) {
                return { success: false, message: 'Invalid trade proposal' };
            }

            if (proposerId === targetId) return { success: false, message: 'Cannot trade with yourself' };

            const proposer = state.players.find(p => p.id === proposerId);
            const target = state.players.find(p => p.id === targetId);

            if (!proposer || !target) return { success: false, message: 'Player not found' };

            // Verify proposer has resources
            for (const [commodity, amount] of Object.entries(giving.commodities) as [CommodityType, number][]) {
                if (!amount) continue;
                if (proposer.resources[commodity] < amount) return { success: false, message: 'Insufficient resources to give' };
            }
            if (proposer.money < giving.money) return { success: false, message: 'Insufficient money to give' };
            if (proposer.loans < giving.loans) return { success: false, message: 'Insufficient loans to give' };

            return {
                success: true,
                newState: {
                    ...state,
                    pendingTrade: {
                        proposerId,
                        targetId,
                        giving,
                        receiving
                    }
                }
            };
        }

        case 'rejectTrade': {
            if (!state.pendingTrade) return { success: false, message: 'No pending trade' };
            // In a real secure backend we'd check if the actor matches targetId, 
            // but the reducer is pure logic. The caller/server checks permissions.

            return {
                success: true,
                newState: {
                    ...state,
                    pendingTrade: null
                }
            };
        }

        case 'acceptTrade': {
            if (!state.pendingTrade) return { success: false, message: 'No pending trade' };

            const { proposerId, targetId, giving, receiving } = state.pendingTrade;

            const newPlayers = [...state.players];
            const proposerIndex = newPlayers.findIndex(p => p.id === proposerId);
            const targetIndex = newPlayers.findIndex(p => p.id === targetId);

            if (proposerIndex === -1 || targetIndex === -1) return { success: false, message: 'Invalid players' };

            const proposer = { ...newPlayers[proposerIndex], resources: { ...newPlayers[proposerIndex].resources } };
            const target = { ...newPlayers[targetIndex], resources: { ...newPlayers[targetIndex].resources } };

            // Re-validate resources (in case they changed since proposal - though unlikely in sync flow)
            for (const [commodity, amount] of Object.entries(giving.commodities) as [CommodityType, number][]) {
                if (!amount) continue;
                if (proposer.resources[commodity] < amount) return { success: false, message: 'Proposer no longer has resources' };
            }
            if (proposer.money < giving.money) return { success: false, message: 'Proposer no longer has money' };

            // Validate target has what they're giving (receiving side of proposal is what target GIVES)
            for (const [commodity, amount] of Object.entries(receiving.commodities) as [CommodityType, number][]) {
                if (!amount) continue;
                if (target.resources[commodity] < amount) return { success: false, message: 'You have insufficient resources' };
            }
            if (target.money < receiving.money) return { success: false, message: 'You have insufficient money' };

            // Execute the trade
            // Giving: Proposer -> Target
            for (const [commodity, amount] of Object.entries(giving.commodities) as [CommodityType, number][]) {
                if (amount) {
                    proposer.resources[commodity] -= amount;
                    target.resources[commodity] += amount;
                }
            }
            proposer.money -= giving.money;
            target.money += giving.money;
            proposer.loans -= giving.loans; // Giving a loan means paying it off? Or transferring debt?
            // "Loans" in this game usually means Promissory Notes (items you can trade).
            // If it's a debt, giving it is bad? 
            // Definition: "loans: number; // Promissory notes". usually positive = debt?
            // "repayLoan" reduces it. So it is Debt.
            // If I give you a Loan, do I give you my Debt? Or do I give you a Note that is valuable?
            // Context check: `updateGivingLoans` in TradeModal does `giving.loans`.
            // If I give a loan, I am transferring MY debt to YOU? That seems unlikely to be accepted unless paid for.
            // OR does "Loans" mean "I take a loan from the bank and give you the cash?"
            // Rules check: "Promissory notes" might be tradeable items?
            // Let's assume transfer of debt for now as 'giving' a loan.
            target.loans += giving.loans;
            proposer.loans -= giving.loans; // Wait, if I give a loan, I get rid of it?
            // Actually, if it's a debt, I can't just give it away. 
            // IF "Loans" are "Promissory Notes" that function as Wildcards/Jokers (positive asset), then:
            // proposer.loans -= giving.loans (Lose asset)
            // target.loans += giving.loans (Gain asset)
            // Let's look at `takeLoan`: money +20, loans +1. `repayLoan`: money -25, loans -1.
            // So Loans are DEBTS.
            // Trading Debt: "I will give you $50 if you take my 1 Loan".
            // Proposer: Money -50, Loans -1. Match?
            // Proposer.loans -= giving.loans. Correct.
            // Target.loans += giving.loans. Correct.

            // Receiving: Target -> Proposer
            for (const [commodity, amount] of Object.entries(receiving.commodities) as [CommodityType, number][]) {
                if (amount) {
                    target.resources[commodity] -= amount;
                    proposer.resources[commodity] += amount;
                }
            }
            target.money -= receiving.money;
            proposer.money += receiving.money;
            // receiving.loans means Target GIVES loans to Proposer
            target.loans -= receiving.loans;
            proposer.loans += receiving.loans;

            newPlayers[proposerIndex] = proposer;
            newPlayers[targetIndex] = target;

            // Advance the turn (auto-pass after trade)
            // The active player (proposer) effectively passes the turn by completing a trade.
            // We replicate basic turn advancement here.

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    pendingTrade: null,
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex
                }
            };
        }

        case 'takeLoan': {
            if (state.phase !== 'Trade') return { success: false, message: 'Can only take loans in Trade phase' };

            const player = state.players[state.currentTurnPlayerIndex];
            const loanAmount = 20 - player.loans;
            if (loanAmount <= 0) return { success: false, message: 'Cannot take more loans' };

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex
                    ? {
                        ...p,
                        money: p.money + loanAmount,
                        loans: p.loans + 1
                    }
                    : p
            );

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    consecutivePasses: 0
                }
            };
        }

        case 'repayLoan': {
            if (state.phase !== 'Trade') return { success: false, message: 'Can only repay loans in Trade phase' };

            const player = state.players[state.currentTurnPlayerIndex];

            if (player.loans <= 0) return { success: false, message: 'No loans to repay' };
            if (player.money < 25) return { success: false, message: 'Not enough money to repay' };

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex
                    ? {
                        ...p,
                        money: p.money - 25,
                        loans: p.loans - 1
                    }
                    : p
            );

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    consecutivePasses: 0
                }
            };
        }

        case 'placeFlag': {
            const { id, extraTurns } = payload || {};
            const cell = state.board[id];

            if (!cell) {
                return { success: false, message: 'Invalid cell' };
            }

            if (cell.occupant) {
                return { success: false, message: 'Cell already occupied' };
            }

            // Cannot place on center tile
            if (id === '0,0') {
                return { success: false, message: 'Cannot place on center tile' };
            }

            const currentPlayer = state.players[state.currentTurnPlayerIndex];

            if (currentPlayer.flags <= 0) {
                return { success: false, message: 'No flags remaining' };
            }

            // Cost: 1 Labor (only in Develop phase)
            if (state.phase === 'Develop') {
                if (currentPlayer.resources['Labor'] < 1) {
                    return { success: false, message: 'Not enough Labor' };
                }
            }

            // Adjacency validation: Must be adjacent to own flag/tile (unless first placement)
            const ownedCount = Object.values(state.board).filter(cell =>
                cell.occupant && cell.occupant.playerId === currentPlayer.id
            ).length;

            if (ownedCount > 0) {
                const coords = stringToCoords(id);
                const neighbors = getNeighbors(coords, state.board);
                const hasFriend = neighbors.some((n: any) => n && n.occupant && n.occupant.playerId === currentPlayer.id);
                if (!hasFriend) {
                    return { success: false, message: 'Must be adjacent to your territory' };
                }
            }

            // Place the flag
            const newBoard = {
                ...state.board,
                [id]: {
                    ...cell,
                    occupant: {
                        type: 'Flag' as const,
                        playerId: currentPlayer.id
                    }
                }
            };

            // Update player flags and deduct Labor cost
            const playerUpdates: Partial<Player> = {
                flags: currentPlayer.flags - 1
            };

            if (state.phase === 'Develop') {
                playerUpdates.resources = {
                    ...currentPlayer.resources,
                    Labor: currentPlayer.resources.Labor - 1
                };
            }

            const newPlayers = resetPlayerPass(state.players, state.currentTurnPlayerIndex, playerUpdates);

            // Check for game end conditions
            let isLastRound = state.isLastRound;
            if (!isLastRound) {
                const anyPlayerOutOfFlags = newPlayers.some(p => p.flags === 0);
                const allHexesOccupied = Object.values(newBoard).every((cell: any) => cell.occupant !== null);

                if (anyPlayerOutOfFlags || allHexesOccupied) {
                    isLastRound = true;
                }
            }

            // Reset consecutive passes (action taken)
            // Auto-advance turn unless extraTurns is set
            const nextPlayerIndex = extraTurns
                ? state.currentTurnPlayerIndex
                : (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    board: newBoard,
                    players: newPlayers,
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    isLastRound
                }
            };
        }

        case 'automateBloc': {
            if (state.phase !== 'Develop') return { success: false, message: 'Can only automate in Develop phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { id, extraTurns } = payload;
            const cell = state.board[id];

            if (!cell || !cell.occupant || cell.occupant.type !== 'Industry' || !cell.occupant.tile) {
                return { success: false, message: 'Invalid cell' };
            }

            const player = state.players[state.currentTurnPlayerIndex];

            if (cell.occupant.playerId !== player.id) return { success: false, message: 'Not your tile' };
            if (cell.occupant.tile.automated) return { success: false, message: 'Already automated' };
            if (cell.occupant.tile.type === 'Farm') return { success: false, message: 'Cannot automate Farms' };

            // Cost: 1 Energy, 2 Capital
            if (player.resources.Energy < 1 || player.resources.Capital < 2) {
                return { success: false, message: 'Insufficient resources' };
            }

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex
                    ? {
                        ...p,
                        resources: {
                            ...p.resources,
                            Energy: p.resources.Energy - 1,
                            Capital: p.resources.Capital - 2
                        }
                    }
                    : p
            );

            const newBoard = { ...state.board };
            const newTile = { ...cell.occupant.tile, automated: true };
            newBoard[id] = {
                ...cell,
                occupant: {
                    ...cell.occupant,
                    tile: newTile
                }
            };

            const nextPlayerIndex = extraTurns
                ? state.currentTurnPlayerIndex
                : (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    board: newBoard
                }
            };
        }

        case 'buildIndustry': {
            if (state.phase !== 'Develop') return { success: false, message: 'Can only build in Develop phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { id, type, orientation, force, extraTurns } = payload;
            const industryType = type as IndustryType;

            const player = state.players[state.currentTurnPlayerIndex];

            const validation = isValidPlacement(state.board, id, industryType, orientation || 0, player, force);

            if (!validation.isValid && !force) {
                return { success: false, message: validation.reason };
            }

            const normalValidation = isValidPlacement(state.board, id, industryType, orientation || 0, player, false);
            const isNaturallyValid = normalValidation.isValid;

            if (force && !isNaturallyValid) {
                if (player.resources['Capital'] < 1) {
                    return { success: false, message: 'Not enough Capital for force placement' };
                }
            }

            const def = TILE_DEFINITIONS[industryType];
            if (!def || !def.costStruct) return { success: false, message: 'Invalid tile type' };

            const cost = { ...def.costStruct };

            if (force && !isNaturallyValid) {
                cost['Capital'] = (cost['Capital'] || 0) + 1;
            }

            // Check afford
            for (const [res, amount] of Object.entries(cost)) {
                if (player.resources[res as CommodityType] < amount!) {
                    return { success: false, message: `Insufficient ${res}` };
                }
            }

            // Deduct
            const newRes = { ...player.resources };
            for (const [res, amount] of Object.entries(cost)) {
                newRes[res as CommodityType] -= amount!;
            }

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex ? { ...p, resources: newRes } : p
            );

            // Place Tile
            const newTile = {
                id: Math.random().toString(36).substr(2, 9),
                type: industryType,
                ownerId: player.id,
                orientation: orientation || 0,
                active: false
            };

            const newBoard = {
                ...state.board,
                [id]: {
                    ...state.board[id],
                    occupant: {
                        type: 'Industry' as const,
                        playerId: player.id,
                        tile: newTile
                    }
                }
            };

            // Decrement tiles remaining
            const newTilesRemaining = {
                ...state.tilesRemaining,
                [industryType]: state.tilesRemaining[industryType] - 1
            };

            const nextPlayerIndex = extraTurns
                ? state.currentTurnPlayerIndex
                : (state.currentTurnPlayerIndex + 1) % state.players.length;

            // Check for game end conditions
            let isLastRound = state.isLastRound;
            if (!isLastRound) {
                const anyPlayerOutOfFlags = newPlayers.some(p => p.flags === 0);
                const allHexesOccupied = Object.values(newBoard).every((cell: any) => cell.occupant !== null);
                const emptyStacks = Object.values(newTilesRemaining).filter(count => count === 0).length;
                const fiveStacksEmpty = emptyStacks >= 5;

                if (anyPlayerOutOfFlags || allHexesOccupied || fiveStacksEmpty) {
                    isLastRound = true;
                }
            }

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    board: newBoard,
                    tilesRemaining: newTilesRemaining,
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    isLastRound
                }
            };
        }

        case 'moveIndustry': {
            if (state.phase !== 'Develop') return { success: false, message: 'Can only move in Develop phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { fromId, toId, extraTurns } = payload;

            if (toId === '0,0') {
                return { success: false, message: 'Cannot move to center tile' };
            }

            const player = state.players[state.currentTurnPlayerIndex];

            // Cost: 1 Capital
            if (player.resources['Capital'] < 1) {
                return { success: false, message: 'Not enough Capital' };
            }

            const fromCell = state.board[fromId];
            const toCell = state.board[toId];

            if (!fromCell.occupant || fromCell.occupant.type !== 'Industry' || fromCell.occupant.playerId !== player.id) {
                return { success: false, message: 'Invalid source' };
            }

            let validDest = false;
            let refundFlag = false;

            if (!toCell.occupant) {
                validDest = true;
            } else if (toCell.occupant.type === 'Flag' && toCell.occupant.playerId === player.id) {
                validDest = true;
                refundFlag = true;
            }

            if (!validDest) {
                return { success: false, message: 'Invalid destination' };
            }

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex
                    ? {
                        ...p,
                        resources: {
                            ...p.resources,
                            Capital: p.resources['Capital'] - 1
                        },
                        flags: refundFlag ? p.flags + 1 : p.flags
                    }
                    : p
            );

            const movedOccupant = { ...fromCell.occupant };

            const nextPlayerIndex = extraTurns
                ? state.currentTurnPlayerIndex
                : (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    board: {
                        ...state.board,
                        [fromId]: { ...fromCell, occupant: null },
                        [toId]: { ...toCell, occupant: movedOccupant }
                    }
                }
            };
        }

        case 'confirmProduction': {
            if (state.phase !== 'Produce') return { success: false, message: 'Not in Produce phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { activeTiles } = payload;
            const activeSet = new Set<string>(activeTiles);

            let player = state.players[state.currentTurnPlayerIndex];

            const visited = new Set<string>();
            let totalFood = 0;
            let totalEnergy = 0;
            const outputs: Record<string, number> = {};

            Object.values(state.board).forEach(cell => {
                if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                    const id = coordsToString(cell.q, cell.r);
                    if (visited.has(id)) return;

                    const bloc = identifyBloc(state.board, cell);
                    bloc.forEach(b => visited.add(coordsToString(b.q, b.r)));

                    const activeMembers = bloc.filter(t => activeSet.has(coordsToString(t.q, t.r)));
                    if (activeMembers.length > 0) {
                        const costs = calculateBlocCosts(activeMembers, false);
                        totalFood += costs.Food;
                        totalEnergy += costs.Energy;

                        const prod = calculateProduction(state.board, activeMembers[0], activeSet);
                        if (prod) {
                            outputs[prod.commodity] = (outputs[prod.commodity] || 0) + prod.amount;
                        }
                    }
                }
            });

            if (player.resources.Food < totalFood || player.resources.Energy < totalEnergy) {
                return { success: false, message: 'Not enough resources to produce' };
            }

            const updatedRes = { ...player.resources };
            updatedRes.Food -= totalFood;
            updatedRes.Energy -= totalEnergy;

            let addedMoney = 0;
            Object.entries(outputs).forEach(([type, amt]) => {
                if (type === 'Money') {
                    addedMoney += amt * 30;
                } else {
                    const rType = type as keyof typeof updatedRes;
                    if (updatedRes[rType] !== undefined) {
                        updatedRes[rType] += amt;
                    }
                }
            });

            player = {
                ...player,
                resources: updatedRes,
                money: player.money + addedMoney
            };

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex ? player : p
            );

            const newConsecutivePasses = state.consecutivePasses + 1;

            if (newConsecutivePasses >= state.players.length) {
                const nextFirstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;

                const resetPlayers = newPlayers.map(player => ({
                    ...player,
                    hasPassed: false
                }));

                return {
                    success: true,
                    newState: {
                        ...state,
                        players: resetPlayers,
                        phase: 'Trade',
                        round: state.round + 1,
                        currentTurnPlayerIndex: nextFirstPlayerIndex,
                        firstPlayerIndex: nextFirstPlayerIndex,
                        consecutivePasses: 0
                    }
                };
            }

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    consecutivePasses: newConsecutivePasses
                }
            };
        }

        case 'produce': {
            const playerProduction = calculateGlobalProduction(state.board);
            const newPlayers = state.players.map(p => {
                const result = playerProduction[p.id];
                if (!result) return p;

                const canAfford =
                    p.resources.Food >= result.costs.Food &&
                    p.resources.Energy >= result.costs.Energy &&
                    p.resources.Ore >= result.costs.Ore;

                if (!canAfford) {
                    return p;
                }

                const nextResources = { ...p.resources };
                nextResources.Food -= result.costs.Food;
                nextResources.Energy -= result.costs.Energy;
                nextResources.Ore -= result.costs.Ore;

                let nextMoney = p.money;
                (Object.entries(result.outputs) as [CommodityType | 'Money', number][]).forEach(([type, amt]) => {
                    if (type === 'Money') {
                        nextMoney += amt * 30;
                    } else {
                        nextResources[type as CommodityType] += amt;
                    }
                });

                return {
                    ...p,
                    resources: nextResources,
                    money: nextMoney
                };
            });

            const nextFirstPlayerIndex = (state.round % state.players.length);

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    phase: 'Trade',
                    round: state.round + 1,
                    currentTurnPlayerIndex: nextFirstPlayerIndex
                }
            };
        }

        case 'sandboxPlaceTile': {
            if (!payload) return { success: false, message: 'Missing payload' };
            const { id, cell } = payload;

            return {
                success: true,
                newState: {
                    ...state,
                    board: {
                        ...state.board,
                        [id]: cell
                    }
                }
            };
        }

        case 'debug': {
            if (!payload) return { success: false, message: 'Missing payload' };
            const { type, amount, field } = payload;

            const newPlayers = state.players.map((p, i) => {
                if (i !== state.currentTurnPlayerIndex) return p;

                if (field === 'money') {
                    return { ...p, money: p.money + amount };
                } else if (field === 'flags') {
                    return { ...p, flags: p.flags + amount };
                } else if (field === 'resource') {
                    return {
                        ...p,
                        resources: {
                            ...p.resources,
                            [type]: Math.max(0, p.resources[type as CommodityType] + amount)
                        }
                    };
                }
                return p;
            });

            return {
                success: true,
                newState: { ...state, players: newPlayers }
            };
        }

        case 'loadState': {
            return {
                success: true,
                newState: payload
            };
        }

        default:
            return { success: false, message: `Unknown action: ${action}` };
    }

    return { success: false, message: 'Action not handled' };
}

/**
 * Wrapper that adds consistency checks after state changes
 */
export function gameReducerWithChecks(state: GameState, action: string, payload?: any): ActionResult {
    const result = gameReducer(state, action, payload);

    // Run consistency checks on successful state changes
    if (result.success && result.newState) {
        try {
            assertConsistency(result.newState);
        } catch (error) {
            console.error('Consistency check failed after action:', action, payload);
            console.error(error);
            // Return the error but keep the state change (for debugging)
            // In production, you might want to revert the state
            return {
                success: false,
                message: `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    return result;
}
