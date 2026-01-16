/**
 * Pure game state reducer - handles all game actions
 * This can be tested independently of React
 */

import type { GameState, CommodityType, IndustryType, Player } from '../types/gameState';
import { coordsToString, stringToCoords, getNeighbors } from './hexUtils';
import { calculateGlobalProduction, identifyBloc, calculateBlocCosts, calculateProduction } from './production';
import { TILE_DEFINITIONS } from './tileDefinitions';
import { MARKET_STEPS } from './marketDefinitions';
import { isValidPlacement, validateTileDots } from './placementLogic';
import { getAvailablePackages } from './packageDefinitions';
import { getDraftOrder, getDraftRoundInfo } from './setupLogic';
import { isValidSetupPlacement } from './setupPlacementLogic';
import { generateGrid } from './hexUtils';

export interface ActionResult {
    success: boolean;
    message?: string;
    newState?: GameState;
}

function addLog(state: GameState, message: string, type: 'action' | 'phase' | 'system', playerId?: string): GameState {
    const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        message,
        type,
        playerId
    };
    return {
        ...state,
        logs: [...(state.logs || []), newLog].slice(-50) // Keep last 50 logs, latest at the end
    };
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
 * Apply interest fees for promissory notes at the start of Trade phase.
 * Each player pays $1 per loan they have. If they can't afford it,
 * they automatically take loans until they can pay.
 * The interest amount is fixed based on loans at the start (not recalculated after borrowing).
 */
function applyInterestFees(players: Player[]): Player[] {
    return players.map(player => {
        const initialLoans = player.loans;
        const interestDue = initialLoans; // $1 per loan

        if (interestDue === 0) {
            return player;
        }

        let currentMoney = player.money;
        let currentLoans = player.loans;

        // If player can't afford interest, take loans until they can OR until they hit 20 loans
        while (currentMoney < interestDue && currentLoans < 20) {
            // Take a loan: get $20 - currentLoans, add 1 loan
            const loanAmount = Math.max(0, 20 - currentLoans);
            if (loanAmount <= 0) {
                // Can't take any more meaningful loans, break
                break;
            }
            currentMoney += loanAmount;
            currentLoans += 1;
        }

        // Pay the interest
        currentMoney -= interestDue;

        // Debt forgiveness: if interest exceeded ability to pay even with max loans, floor at $0
        if (currentMoney < 0) {
            currentMoney = 0;
        }

        return {
            ...player,
            money: currentMoney,
            loans: currentLoans
        };
    });
}

/**
 * Process a game action and return the new state
 * This is a pure function - no side effects, no React dependencies
 */
export function gameReducer(state: GameState, action: string, payload?: any): ActionResult {
    // Trade Blocking Logic
    if (state.pendingTrade) {
        // Actions that are blocked for the proposer while waiting
        const blockedActions = [
            'buy', 'sell', 'pass', 'takeLoan', 'repayLoan',
            'buildIndustry', 'moveIndustry', 'placeFlag', 'automateBloc',
            'confirmProduction', 'selectPackage', 'placeSetupTile'
        ];

        // Also block proposing NEW trades (though the case 'proposeTrade' already checks this, 
        // adding it here for consistency in "blocked actions" list conceptually, 
        // but 'proposeTrade' logic is specific so we can leave it or include it)
        // 'proposeTrade' case has its own check.

        if (blockedActions.includes(action)) {
            const currentPlayer = state.players[state.currentTurnPlayerIndex];
            // If the current player is the one who proposed, they must wait
            if (currentPlayer.id === state.pendingTrade.proposerId) {
                return { success: false, message: 'Waiting for trade response (action blocked by pending trade)' };
            }
        }
    }

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
                    const phaseState = addLog(state, 'Phase changed to Develop', 'phase');
                    return {
                        success: true,
                        newState: {
                            ...phaseState,
                            players: playersWithoutPass,
                            phase: 'Develop',
                            consecutivePasses: 0,
                            currentTurnPlayerIndex: state.firstPlayerIndex
                        }
                    };
                } else if (state.phase === 'Develop') {
                    // Reset production flag for all players
                    const playersReadyToProduce = playersWithoutPass.map(p => ({ ...p, hasProduced: false }));
                    const phaseState = addLog(state, 'Phase changed to Produce', 'phase');
                    return {
                        success: true,
                        newState: {
                            ...phaseState,
                            players: playersReadyToProduce,
                            phase: 'Produce',
                            consecutivePasses: 0,
                            currentTurnPlayerIndex: state.firstPlayerIndex
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

                    // Apply interest fees if setting is enabled
                    const playersForTrade = state.settings?.promissoryNoteInterestFees
                        ? applyInterestFees(playersWithoutPass)
                        : playersWithoutPass;

                    const phaseState = addLog(state, `Round ${state.round + 1} started`, 'system');
                    return {
                        success: true,
                        newState: {
                            ...phaseState,
                            players: playersForTrade,
                            phase: 'Trade',
                            round: state.round + 1,
                            consecutivePasses: 0,
                            firstPlayerIndex: nextFirstPlayerIndex,
                            currentTurnPlayerIndex: nextFirstPlayerIndex,
                            tradeIntents: {}
                        }
                    };
                }
            } else {
                // Next player
                const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;
                const player = state.players[state.currentTurnPlayerIndex];
                const actionState = addLog(state, `${player.name} passed`, 'action', player.id);

                return {
                    success: true,
                    newState: {
                        ...actionState,
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
            const steps = MARKET_STEPS[type];

            // When market is empty (stock=0), buy from supply at same price as stock=1
            // Price index: stock=0 uses steps[0], stock=1 uses steps[0], stock=2 uses steps[1], etc.
            const priceIndex = Math.max(0, stock - 1);
            const price = steps[priceIndex].buy;
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

            // Stock decreases by 1, but stays at 0 if already 0 (buying from supply)
            const newStock = Math.max(0, stock - 1);

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    markets: {
                        ...state.markets,
                        [type]: { ...state.markets[type], stock: newStock }
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
            const steps = MARKET_STEPS[type];
            const maxStock = steps.length;

            // When market is full (stock=maxStock), sell to supply at same price as stock=maxStock-1
            // Price index: capped at maxStock-1
            const priceIndex = Math.min(stock, maxStock - 1);
            const price = steps[priceIndex].sell;
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

            // Stock increases by 1, but stays at maxStock if already full (selling to supply)
            const newStock = Math.min(maxStock, stock + 1);

            return {
                success: true,
                newState: {
                    ...state,
                    players: newPlayers,
                    markets: {
                        ...state.markets,
                        [type]: { ...state.markets[type], stock: newStock }
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

            const actionState = addLog(state, `${proposer.name} proposed a trade to ${target.name}`, 'action', proposer.id);

            return {
                success: true,
                newState: {
                    ...actionState,
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

            const target = state.players.find(p => p.id === state.pendingTrade?.targetId);
            const actionState = addLog(state, `${target?.name || 'Someone'} rejected a trade`, 'action', target?.id);

            return {
                success: true,
                newState: {
                    ...actionState,
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

            const actionState = addLog(state, `${target.name} accepted a trade from ${proposer.name}`, 'action', target.id);

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            return {
                success: true,
                newState: {
                    ...actionState,
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

        case 'setTradeIntent': {
            if (state.phase !== 'Trade') return { success: false, message: 'Can only set trade intent in Trade phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { playerId, desiredInventory, ready } = payload;

            if (!playerId || !desiredInventory) {
                return { success: false, message: 'Invalid trade intent' };
            }

            // Validate player exists
            const player = state.players.find(p => p.id === playerId);
            if (!player) return { success: false, message: 'Player not found' };

            const newTradeIntents = {
                ...state.tradeIntents,
                [playerId]: {
                    playerId,
                    desiredInventory,
                    ready: ready ?? false
                }
            };

            return {
                success: true,
                newState: {
                    ...state,
                    tradeIntents: newTradeIntents
                }
            };
        }

        case 'placeFlag': {
            const { id } = payload || {};
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
            // Reset consecutive passes (action taken)
            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            const actionState = addLog(state, `${currentPlayer.name} placed a flag at (${coordsToString(stringToCoords(id).q, stringToCoords(id).r)})`, 'action', currentPlayer.id);

            return {
                success: true,
                newState: {
                    ...actionState,
                    board: newBoard,
                    players: newPlayers,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    consecutivePasses: 0,
                    isLastRound
                }
            };
        }

        case 'automateBloc': {
            if (state.phase !== 'Develop') return { success: false, message: 'Can only automate in Develop phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { id } = payload;
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

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            const actionState = addLog(state, `${player.name} automated a ${cell.occupant.tile.type} at (${coordsToString(stringToCoords(id).q, stringToCoords(id).r)})`, 'action', player.id);

            return {
                success: true,
                newState: {
                    ...actionState,
                    players: newPlayers,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    board: newBoard,
                    consecutivePasses: 0
                }
            };
        }

        case 'buildIndustry': {
            if (state.phase !== 'Develop') return { success: false, message: 'Can only build in Develop phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { id, type, orientation, force } = payload;
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
                const hasExistingFlag = state.board[id].occupant?.type === 'Flag' && state.board[id].occupant.playerId === player.id;
                if (!hasExistingFlag && player.flags < 1) {
                    return { success: false, message: 'Not enough Flags for placement off-grid' };
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

            // Deduct resources
            const newRes = { ...player.resources };
            for (const [res, amount] of Object.entries(cost)) {
                newRes[res as CommodityType] -= amount!;
            }

            // Flag handling: 
            // If building on own flag: 0 flags consumed (flag on board becomes implicit industry flag)
            // If building on empty (force): 1 flag consumed from supply
            const hasExistingFlag = state.board[id].occupant?.type === 'Flag' && state.board[id].occupant.playerId === player.id;
            const flagsConsumed = hasExistingFlag ? 0 : 1;

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex ? { ...p, resources: newRes, flags: p.flags - flagsConsumed } : p
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

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

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

            const actionState = addLog(state, `${player.name} built a ${industryType} at (${coordsToString(stringToCoords(id).q, stringToCoords(id).r)})`, 'action', player.id);

            return {
                success: true,
                newState: {
                    ...actionState,
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

            const { fromId, toId, force, skipBaseCost, orientation } = payload;

            if (toId === '0,0') {
                return { success: false, message: 'Cannot move to center tile' };
            }

            const player = state.players[state.currentTurnPlayerIndex];

            // Base Cost: 1 Capital (unless skipped, e.g., for 2nd/3rd move of the action)
            const baseCost = skipBaseCost ? 0 : 1;

            // Force Cost: 1 Capital per tile forced
            const forceCost = force ? 1 : 0;

            const totalCost = baseCost + forceCost;

            if (player.resources['Capital'] < totalCost) {
                return { success: false, message: `Not enough Capital (Need ${totalCost})` };
            }

            const fromCell = state.board[fromId];
            const toCell = state.board[toId];

            if (!fromCell.occupant || fromCell.occupant.type !== 'Industry' || fromCell.occupant.playerId !== player.id) {
                return { success: false, message: 'Invalid source' };
            }

            // Destination basic validation (must be empty or own flag)
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

            // Dot Adjacency Validation (unless Forced)
            const movedTile = fromCell.occupant.tile;
            if (movedTile && !force) {
                const targetOrientation = orientation !== undefined ? orientation : (movedTile.orientation || 0);
                const dotValidation = validateTileDots(state.board, toId, movedTile.type, targetOrientation, fromId);

                if (!dotValidation.isValid) {
                    return { success: false, message: `${dotValidation.reason} (use Force to override)` };
                }
            }

            const newPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex
                    ? {
                        ...p,
                        resources: {
                            ...p.resources,
                            Capital: p.resources['Capital'] - totalCost
                        },
                        flags: refundFlag ? p.flags + 1 : p.flags
                    }
                    : p
            );

            const movedOccupant = { ...fromCell.occupant };
            if (movedOccupant.tile) {
                movedOccupant.tile = {
                    ...movedOccupant.tile,
                    orientation: orientation !== undefined ? orientation : (movedOccupant.tile.orientation || 0)
                };
            }

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;

            const actionState = addLog(state, `${player.name} moved a tile from (${fromId}) to (${toId})`, 'action', player.id);

            return {
                success: true,
                newState: {
                    ...actionState,
                    players: newPlayers,
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex,
                    board: {
                        ...state.board,
                        [fromId]: { ...fromCell, occupant: null },
                        [toId]: { ...toCell, occupant: movedOccupant }
                    }
                }
            };
        }

        case 'moveIndustrySequence': {
            if (state.phase !== 'Develop') return { success: false, message: 'Can only move in Develop phase' };
            if (!payload || !payload.moves || !Array.isArray(payload.moves)) return { success: false, message: 'Missing moves payload' };

            const moves = payload.moves as Array<{ fromId: string; toId: string; orientation?: number; force?: boolean; skipBaseCost?: boolean }>;
            const player = state.players[state.currentTurnPlayerIndex];

            // Initialize tracking state
            let currentBoard = { ...state.board };
            let currentCapital = player.resources.Capital;
            let currentFlags = player.flags;
            let totalCost = 0;
            let logDetails: string[] = [];

            // Process moves
            // Limit to 3 moves
            if (moves.length > 3) return { success: false, message: 'Max 3 moves allowed' };

            for (const move of moves) {
                const { fromId, toId, orientation, force, skipBaseCost } = move;

                if (toId === '0,0') return { success: false, message: 'Cannot move to center tile' };

                const baseCost = skipBaseCost ? 0 : 1;
                const forceCost = force ? 1 : 0;
                const moveCost = baseCost + forceCost;

                if (currentCapital < moveCost) return { success: false, message: `Insufficient Capital (Need ${moveCost})` };

                const fromCell = currentBoard[fromId];
                const toCell = currentBoard[toId];

                // Validate Source
                if (!fromCell.occupant || fromCell.occupant.type !== 'Industry' || fromCell.occupant.playerId !== player.id) {
                    return { success: false, message: `Invalid source at ${fromId}` };
                }

                // Validate Destination
                let validDest = false;
                let stepRefundFlag = false;

                if (fromId === toId) {
                    validDest = true;
                } else if (!toCell.occupant) {
                    validDest = true;
                } else if (toCell.occupant.type === 'Flag' && toCell.occupant.playerId === player.id) {
                    validDest = true;
                    stepRefundFlag = true;
                }

                if (!validDest) return { success: false, message: `Invalid destination at ${toId}` };

                // Validate Dot Adjacency
                const movedTile = fromCell.occupant.tile;
                if (movedTile && !force) {
                    const targetOrientation = orientation !== undefined ? orientation : (movedTile.orientation || 0);
                    // Use validateTileDots against currentBoard (which mirrors state as we move)
                    const dotValidation = validateTileDots(currentBoard, toId, movedTile.type, targetOrientation, fromId);
                    if (!dotValidation.isValid) {
                        return { success: false, message: `${dotValidation.reason} (use Force to override)` };
                    }
                }

                // Apply Move to Temp State
                currentCapital -= moveCost;
                totalCost += moveCost;
                if (stepRefundFlag) {
                    currentFlags += 1;
                    // refundFlag tracked elsewhere or unused?
                    // We increment currentFlags so we are good.
                }

                const movedOccupant = { ...fromCell.occupant };
                if (movedOccupant.tile) {
                    movedOccupant.tile = {
                        ...movedOccupant.tile,
                        orientation: orientation !== undefined ? orientation : (movedOccupant.tile.orientation || 0)
                    };
                }

                currentBoard = {
                    ...currentBoard,
                    [fromId]: { ...fromCell, occupant: null },
                    [toId]: { ...toCell, occupant: movedOccupant }
                };

                logDetails.push(`${fromId}→${toId}`);
            }

            // Apply final state changes
            const finalPlayers = state.players.map((p, i) =>
                i === state.currentTurnPlayerIndex
                    ? {
                        ...p,
                        resources: {
                            ...p.resources,
                            Capital: currentCapital // Use the final tracking variable directly
                        },
                        flags: currentFlags
                    }
                    : p
            );

            const nextPlayerIndex = (state.currentTurnPlayerIndex + 1) % state.players.length;
            const actionState = addLog(state, `${player.name} moved tiles: ${logDetails.join(', ')}`, 'action', player.id);

            return {
                success: true,
                newState: {
                    ...actionState,
                    players: finalPlayers,
                    board: currentBoard,
                    consecutivePasses: 0,
                    currentTurnPlayerIndex: nextPlayerIndex
                }
            };
        }

        case 'confirmProduction': {
            console.log(`[Reducer:confirmProduction] Starting for player ${payload?.playerId}`);
            if (state.phase !== 'Produce') return { success: false, message: 'Not in Produce phase' };
            if (!payload) return { success: false, message: 'Missing payload' };

            const { activeTiles, playerId } = payload;
            if (!playerId) return { success: false, message: 'Missing playerId' };

            const playerIndex = state.players.findIndex(p => p.id === playerId);
            if (playerIndex === -1) return { success: false, message: 'Player not found' };

            let player = state.players[playerIndex];
            if (player.hasProduced) return { success: false, message: 'Already produced' };

            const activeSet = new Set<string>(activeTiles);
            console.log(`[Reducer:confirmProduction] Active tiles: ${Array.from(activeSet).join(', ')}`);

            const visited = new Set<string>();
            let totalFood = 0;
            let totalEnergy = 0;
            let totalOre = 0;
            const outputs: Record<string, number> = {};

            Object.values(state.board).forEach(cell => {
                if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                    const id = coordsToString(cell.q, cell.r);
                    if (visited.has(id)) return;

                    const bloc = identifyBloc(state.board, cell);
                    bloc.forEach(b => visited.add(coordsToString(b.q, b.r)));

                    const activeMembers = bloc.filter(t => activeSet.has(coordsToString(t.q, t.r)));
                    if (activeMembers.length > 0) {
                        // Check if any active member has automation
                        const hasAutomation = activeMembers.some(t => t.occupant?.tile?.automated);
                        const costs = calculateBlocCosts(activeMembers, hasAutomation);
                        console.log(`[Reducer:confirmProduction] Bloc at ${id} (type: ${cell.occupant.tile?.type}): active=${activeMembers.length}, automated=${hasAutomation}, costs=F:${costs.Food}, E:${costs.Energy}, O:${costs.Ore}`);

                        totalFood += costs.Food;
                        totalEnergy += costs.Energy;
                        totalOre += costs.Ore;

                        const prod = calculateProduction(state.board, activeMembers[0], activeSet);
                        if (prod) {
                            outputs[prod.commodity] = (outputs[prod.commodity] || 0) + prod.amount;
                            console.log(`[Reducer:confirmProduction]   -> Output: ${prod.amount} ${prod.commodity}`);
                        }
                    }
                }
            });

            console.log(`[Reducer:confirmProduction] Total costs: Food=${totalFood}, Energy=${totalEnergy}, Ore=${totalOre}`);
            console.log(`[Reducer:confirmProduction] Player resources: Food=${player.resources.Food}, Energy=${player.resources.Energy}, Ore=${player.resources.Ore}`);

            if (player.resources.Food < totalFood || player.resources.Energy < totalEnergy || player.resources.Ore < totalOre) {
                console.log(`[Reducer:confirmProduction] REJECTED: Insufficient resources`);
                return { success: false, message: 'Not enough resources to produce' };
            }

            const updatedRes = { ...player.resources };
            updatedRes.Food -= totalFood;
            updatedRes.Energy -= totalEnergy;
            updatedRes.Ore -= totalOre;

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
                money: player.money + addedMoney,
                hasProduced: true
            };

            const newPlayers = state.players.map((p, i) =>
                i === playerIndex ? player : p
            );

            const allProduced = newPlayers.every(p => p.hasProduced);

            if (allProduced) {
                console.log(`[Reducer:confirmProduction] All players produced. Advancing round.`);
                const nextFirstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;

                const resetPlayers = newPlayers.map(p => ({
                    ...p,
                    hasPassed: false,
                    hasProduced: false
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
                        consecutivePasses: 0,
                        tradeIntents: {}
                    }
                };
            }

            // Not all produced - advance to next player who hasn't produced
            let nextIndex = state.currentTurnPlayerIndex;
            for (let i = 1; i < state.players.length; i++) {
                const tryIndex = (state.currentTurnPlayerIndex + i) % state.players.length;
                if (!newPlayers[tryIndex].hasProduced) {
                    nextIndex = tryIndex;
                    break;
                }
            }

            const actionState = addLog(state, `${player.name} completed production`, 'action', player.id);
            console.log(`[Reducer:confirmProduction] SUCCESS. Next turn: ${nextIndex}`);

            return {
                success: true,
                newState: {
                    ...actionState,
                    players: newPlayers,
                    currentTurnPlayerIndex: nextIndex
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

        case 'skipSetup': {
            // Debug action: Skip the Setup phase entirely, going directly to Trade
            // Used in integration tests
            if (state.phase !== 'Setup') {
                return { success: false, message: 'Not in Setup phase' };
            }
            const firstPlayerIndex = state.setupPhase?.firstPlayerIndex ?? 0;
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
