import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Board } from '../components/game/Board';
import type { HexCell, IndustryType, CommodityType } from '../types/gameState';
import { TILE_DEFINITIONS } from '../utils/tileDefinitions';
import { coordsToString, stringToCoords, getNeighbors, getNeighbor } from '../utils/hexUtils';
import { calculateProduction, calculateGlobalProduction, identifyBloc, calculateBlocCosts } from '../utils/production';
import { MarketBoard } from '../components/game/MarketBoard';
import { PlayerRoster } from '../components/game/PlayerRoster';
import { ControlPanel } from '../components/game/ControlPanel';
import { useGameEngineContext } from '../hooks/GameEngineProvider';
import { ResourceIcon } from '../components/ui/ResourceIcon';
import SetupPhase from '../components/game/SetupPhase';
import { getValidSetupPlacements } from '../utils/setupPlacementLogic';
import { getValidPlacements } from '../utils/placementLogic';
import { TradeModal, AcceptTradeModal, type TradeOffer } from '../components/game/TradeModal';
import MarketTransactionModal from '../components/game/MarketTransactionModal';
import { MARKET_STEPS } from '../utils/marketDefinitions';
import { VictoryScreen } from '../components/game/VictoryScreen';
import { getAvailablePackages } from '../utils/packageDefinitions';

export const Sandbox: React.FC = () => {
    // Game Engine State
    const {
        gameState,
        handleAction: dispatchAction,
        startNewGame,
        mode,
        selfPlayer,
        requestRematch,
        lobby,
        leaveLobby
    } = useGameEngineContext();

    // UI State
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<IndustryType | 'Flag' | 'Eraser' | 'Rotate' | 'Move' | 'Automate'>('Farm');
    const [forceMode, setForceMode] = useState(false);
    const [moveSourceId, setMoveSourceId] = useState<string | null>(null);
    const [extraTurns, setExtraTurns] = useState(false);

    // Move operation state
    const [moveHistory, setMoveHistory] = useState<Array<{ from: string, to: string }>>([]);
    const [movesCompleted, setMovesCompleted] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [moveForceMode, setMoveForceMode] = useState(false);
    const [pendingMoveTarget, setPendingMoveTarget] = useState<{ from: string, to: string, orientation: number } | null>(null);


    // Interaction State
    const [interactionMode, setInteractionMode] = useState<'idle' | 'placing'>('idle');
    const [pendingBuild, setPendingBuild] = useState<{ id: string, type: IndustryType, orientation: number } | null>(null);
    const [validPlacements, setValidPlacements] = useState<Record<string, number[]> | null>(null);

    // Trade Modal State
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [pendingTrade, setPendingTrade] = useState<{
        proposerId: string;
        targetId: string;
        giving: TradeOffer;
        receiving: TradeOffer;
    } | null>(null);

    // Market Transaction Modal State
    const [pendingMarketTransaction, setPendingMarketTransaction] = useState<{
        action: 'buy' | 'sell';
        commodity: CommodityType;
        amount: number;
    } | null>(null);
    const [marketErrorMessage, setMarketErrorMessage] = useState<string | null>(null);

    // Helper to get active player
    const player = gameState.players[gameState.currentTurnPlayerIndex];

    // Setup Phase State
    const [setupValidPlacements, setSetupValidPlacements] = useState<Record<string, number[]>>({});

    // Auto-determine tile type from pendingPlacement
    const setupTileType = gameState.setupPhase?.pendingPlacement?.tilesRemaining[0] || null;

    const activePlayerId = useMemo(() => {
        if (gameState.phase === 'Setup' && gameState.setupPhase?.currentDrafterIndex !== undefined) {
            const drafter = gameState.players[gameState.setupPhase.currentDrafterIndex];
            return drafter ? drafter.id : null;
        }
        const current = gameState.players[gameState.currentTurnPlayerIndex];
        return current ? current.id : null;
    }, [gameState]);

    const activePlayer = useMemo(() => {
        if (!activePlayerId) return null;
        return gameState.players.find(p => p.id === activePlayerId) ?? null;
    }, [gameState.players, activePlayerId]);

    const canAct = useMemo(() => {
        if (mode !== 'remote') return true;
        if (!selfPlayer) return false;
        if (!activePlayerId) return false;
        return selfPlayer.playerId === activePlayerId;
    }, [mode, selfPlayer, activePlayerId]);

    const interactionLocked = mode === 'remote' && !canAct && !gameState.gameEnded;

    const handleAction = useCallback((action: string, payload?: any) => {
        if (mode === 'remote') {
            if (!selfPlayer) {
                console.warn(`Blocked action ${action} because client has no assigned seat.`);
                return;
            }
            if (!canAct) {
                console.warn(`Blocked action ${action} because it is not this player's turn.`);
                return;
            }
        }
        dispatchAction(action, payload);
    }, [dispatchAction, mode, selfPlayer, canAct]);

    // Update setup valid placements when setup tile is selected
    useEffect(() => {
        console.log('useEffect [setupValidPlacements]:', {
            phase: gameState.phase,
            setupTileType,
            step: gameState.setupPhase?.step,
            hasSetupPhase: !!gameState.setupPhase,
            currentDrafterIndex: gameState.setupPhase?.currentDrafterIndex
        });

        if (gameState.phase === 'Setup' && setupTileType && gameState.setupPhase?.step === 'placeTile' && gameState.setupPhase?.currentDrafterIndex !== undefined) {
            const currentPlayer = gameState.players[gameState.setupPhase.currentDrafterIndex];
            // Get list of tiles already placed by current player during setup
            const setupTileCells = Object.entries(gameState.board)
                .filter(([_, cell]) => cell.occupant?.type === 'Industry' && cell.occupant.playerId === currentPlayer.id)
                .map(([id, _]) => id);
            const valids = getValidSetupPlacements(gameState.board, setupTileType, setupTileCells, currentPlayer.id);
            console.log('Setting setupValidPlacements:', Object.keys(valids).length, 'cells');
            setSetupValidPlacements(valids);
        } else {
            console.log('Clearing setupValidPlacements');
            setSetupValidPlacements({});
        }
    }, [gameState.phase, setupTileType, gameState.board, gameState.setupPhase?.step, gameState.setupPhase?.currentDrafterIndex]);

    // Calculate valid placements for Develop phase
    useEffect(() => {
        if (gameState.phase === 'Develop') {
            // Calculate valid placements based on selected tool
            if (TILE_DEFINITIONS[selectedTool as IndustryType]) {
                // Industry tile placement
                const valids = getValidPlacements(gameState.board, selectedTool as IndustryType, player, forceMode);
                console.log('[Develop Phase] Calculating valid placements:', {
                    tool: selectedTool,
                    validCellCount: Object.keys(valids).length,
                    sampleCells: Object.keys(valids).slice(0, 5)
                });
                setValidPlacements(valids);
            } else if (selectedTool === 'Move') {
                // Valid cells are those with player's own industry tiles (if has Capital and not already moving)
                const valids: Record<string, number[]> = {};
                if (player.resources.Capital >= 1 && !isMoving) {
                    Object.entries(gameState.board).forEach(([id, cell]) => {
                        if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                            valids[id] = [0]; // Orientation doesn't matter for move tool
                        }
                    });
                }
                setValidPlacements(valids);
            } else if (selectedTool === 'Flag') {
                // Valid cells are empty, adjacent to player's territories, and player has labor (excluding center)
                const valids: Record<string, number[]> = {};
                if (player.resources.Labor >= 1 && player.flags > 0) {
                    const ownedCount = Object.values(gameState.board).filter(cell =>
                        cell.occupant && cell.occupant.playerId === player.id
                    ).length;

                    Object.entries(gameState.board).forEach(([id, cell]) => {
                        if (!cell.occupant && id !== '0,0') { // Exclude center tile
                            // If player has no territories yet, any empty cell is valid
                            if (ownedCount === 0) {
                                valids[id] = [0];
                            } else {
                                // Check if adjacent to player's territory
                                const coords = stringToCoords(id);
                                const neighbors = getNeighbors(coords, gameState.board);
                                const hasFriend = neighbors.some((n: HexCell | undefined) =>
                                    n && n.occupant && n.occupant.playerId === player.id
                                );
                                if (hasFriend) {
                                    valids[id] = [0];
                                }
                            }
                        }
                    });
                }
                setValidPlacements(valids);
            } else if (selectedTool === 'Automate') {
                // Valid cells are player's own non-automated industry tiles (except Farms) with sufficient resources
                const valids: Record<string, number[]> = {};
                if (player.resources.Energy >= 1 && player.resources.Capital >= 2) {
                    Object.entries(gameState.board).forEach(([id, cell]) => {
                        if (cell.occupant?.type === 'Industry' &&
                            cell.occupant.playerId === player.id &&
                            cell.occupant.tile &&
                            !cell.occupant.tile.automated &&
                            cell.occupant.tile.type !== 'Farm') { // Farms don't need automation
                            valids[id] = [0];
                        }
                    });
                }
                setValidPlacements(valids);
            } else {
                setValidPlacements(null);
            }
        } else {
            setValidPlacements(null);
        }
    }, [gameState.phase, gameState.board, selectedTool, player.id, player.resources, player.flags, forceMode, isMoving]);

    // Setup Handlers
    const handleSelectPackage = (packageId: string) => {
        handleAction('selectPackage', { packageId });
    };

    const handleSetupCellClick = (cellId: string) => {
        console.log('handleSetupCellClick called:', {
            cellId,
            phase: gameState.phase,
            setupTileType,
            step: gameState.setupPhase?.step,
            hasValidPlacements: Object.keys(setupValidPlacements).length,
            validOrientationsForCell: setupValidPlacements[cellId]
        });

        if (gameState.phase !== 'Setup' || !setupTileType) {
            console.log('Early return: phase =', gameState.phase, ', setupTileType =', setupTileType, ', step =', gameState.setupPhase?.step);
            return;
        }

        const validOrientations = setupValidPlacements[cellId];
        if (!validOrientations || validOrientations.length === 0) {
            // Check if it's the central hex
            if (cellId === '0,0') {
                console.log('Cannot place in central hex (forbidden by rules)');
            } else {
                console.log('No valid orientations for cell', cellId);
            }
            return;
        }

        // Use first valid orientation
        const orientation = validOrientations[0];
        console.log('Placing tile:', { cellId, tileType: setupTileType, orientation });
        handleAction('placeSetupTile', { cellId, tileType: setupTileType, orientation });
        setSelectedCellId(null); // Clear selection after placement
    };

    // -- Production Logic --
    // Per-bloc configuration
    interface BlocConfig {
        powered: boolean;        // Whether to power this bloc
        automated: boolean;      // Whether to run automation (if applicable)
        fedTiles: Set<string>;   // Which tiles within the bloc to feed
    }

    const [blocConfigs, setBlocConfigs] = useState<Map<number, BlocConfig>>(new Map());
    const [hoveredBlocIndex, setHoveredBlocIndex] = useState<number | null>(null);
    const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);

    const playerBlocs = useMemo(() => {
        if (gameState.phase !== 'Produce') return [];
        const visited = new Set<string>();
        const blocs: { type: IndustryType, tiles: HexCell[] }[] = [];

        Object.values(gameState.board).forEach(cell => {
            if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                const id = coordsToString(cell.q, cell.r);
                if (visited.has(id)) return;

                const blocTiles = identifyBloc(gameState.board, cell);
                blocTiles.forEach(b => visited.add(coordsToString(b.q, b.r)));
                blocs.push({ type: cell.occupant.tile!.type, tiles: blocTiles });
            }
        });
        return blocs;
    }, [gameState.board, gameState.phase, player.id]);

    // Clear selection when entering produce phase
    useEffect(() => {
        if (gameState.phase === 'Produce') {
            setSelectedCellId(null);
        }
    }, [gameState.phase]);

    // Initialize bloc configs when playerBlocs changes
    useEffect(() => {
        if (gameState.phase === 'Produce') {
            const newConfigs = new Map<number, BlocConfig>();
            playerBlocs.forEach((bloc, index) => {
                // Initialize with all tiles unchecked (player must check what they can afford)
                const allTileIds = new Set(bloc.tiles.map(t => coordsToString(t.q, t.r)));
                newConfigs.set(index, {
                    powered: false,
                    automated: false,
                    fedTiles: allTileIds
                });
            });
            setBlocConfigs(newConfigs);
        }
    }, [gameState.phase, playerBlocs]);

    // Helper to toggle bloc power
    const toggleBlocPower = (blocIndex: number, powered: boolean) => {
        setBlocConfigs(prev => {
            const newMap = new Map(prev);
            const config = newMap.get(blocIndex);
            if (config) {
                newMap.set(blocIndex, { ...config, powered });
            }
            return newMap;
        });
    };

    // Helper to toggle bloc automation
    const toggleBlocAutomation = (blocIndex: number, automated: boolean) => {
        setBlocConfigs(prev => {
            const newMap = new Map(prev);
            const config = newMap.get(blocIndex);
            if (config) {
                // When enabling automation, automatically feed all tiles in the bloc
                if (automated) {
                    const bloc = playerBlocs[blocIndex];
                    const allTileIds = new Set(bloc.tiles.map(t => coordsToString(t.q, t.r)));
                    newMap.set(blocIndex, { ...config, automated, fedTiles: allTileIds });
                } else {
                    // When disabling automation, clear the fed tiles
                    newMap.set(blocIndex, { ...config, automated, fedTiles: new Set() });
                }
            }
            return newMap;
        });
    };

    // Helper to toggle individual tile feeding
    const toggleTileFed = (blocIndex: number, tileId: string, fed: boolean) => {
        setBlocConfigs(prev => {
            const newMap = new Map(prev);
            const config = newMap.get(blocIndex);
            if (config) {
                const newFedTiles = new Set(config.fedTiles);
                if (fed) {
                    newFedTiles.add(tileId);
                } else {
                    newFedTiles.delete(tileId);
                }
                newMap.set(blocIndex, { ...config, fedTiles: newFedTiles });
            }
            return newMap;
        });
    };

    // Calculate per-bloc totals
    interface BlocTotals {
        costs: { Food: number; Energy: number; Labor: number; Ore: number };
        production: { commodity: CommodityType | 'Money'; amount: number } | null;
    }

    const calculateBlocTotals = (bloc: HexCell[], config: BlocConfig | undefined): BlocTotals => {
        const zeroCosts = { Food: 0, Energy: 0, Labor: 0, Ore: 0 };
        if (!config || !config.powered) {
            return { costs: zeroCosts, production: null };
        }

        const activeTileIds = new Set(
            bloc
                .map(t => coordsToString(t.q, t.r))
                .filter(id => config.fedTiles.has(id))
        );

        if (activeTileIds.size === 0) {
            return { costs: zeroCosts, production: null };
        }

        const activeTiles = bloc.filter(t => activeTileIds.has(coordsToString(t.q, t.r)));

        // Automation only applies if ALL tiles in the bloc are being fed
        const isFullyAutomated = config.automated && activeTiles.length === bloc.length;

        const costs = calculateBlocCosts(
            activeTiles,
            isFullyAutomated
        );

        const prod = calculateProduction(gameState.board, bloc[0], activeTileIds);

        return { costs, production: prod };
    };

    // Calculate overall production totals
    const productionTotals = useMemo(() => {
        let totalFoodCost = 0;
        let totalEnergyCost = 0;
        let totalOreCost = 0;
        const outputs: Record<string, number> = {};

        playerBlocs.forEach((bloc, index) => {
            const config = blocConfigs.get(index);
            const totals = calculateBlocTotals(bloc.tiles, config);

            totalFoodCost += totals.costs.Food;
            totalEnergyCost += totals.costs.Energy;
            totalOreCost += totals.costs.Ore;

            if (totals.production) {
                outputs[totals.production.commodity] = (outputs[totals.production.commodity] || 0) + totals.production.amount;
            }
        });
        return { totalFoodCost, totalEnergyCost, totalOreCost, outputs };
    }, [playerBlocs, blocConfigs, gameState.board]);

    const handleRunProduction = () => {
        // Build active tiles list from blocConfigs
        const activeTiles: string[] = [];
        playerBlocs.forEach((bloc, index) => {
            const config = blocConfigs.get(index);
            if (config?.powered) {
                bloc.tiles.forEach(tile => {
                    const id = coordsToString(tile.q, tile.r);
                    if (config.fedTiles.has(id)) {
                        activeTiles.push(id);
                    }
                });
            }
        });

        handleAction('confirmProduction', { activeTiles });
    };
    // ----------------------

    // Calculate which cells should be highlighted based on hover
    const hoverHighlightedCells = useMemo(() => {
        if (gameState.phase !== 'Produce') return undefined;

        // If hovering over a tile, highlight just that tile
        if (hoveredTileId) {
            return [hoveredTileId];
        }

        // If hovering over a bloc, highlight all tiles in that bloc
        if (hoveredBlocIndex !== null && playerBlocs[hoveredBlocIndex]) {
            return playerBlocs[hoveredBlocIndex].tiles.map(t => coordsToString(t.q, t.r));
        }

        return undefined;
    }, [hoveredTileId, hoveredBlocIndex, playerBlocs, gameState.phase]);

    const handleBuy = (type: CommodityType) => {
        if (gameState.phase !== 'Trade') return; // Enforce Phase
        const stock = gameState.markets[type].stock;
        if (stock <= 0) return; // Cannot buy from empty market

        // Check if player can afford the purchase
        const buyPrice = MARKET_STEPS[stock - 1].buy;
        if (player.money < buyPrice) {
            setMarketErrorMessage(`Insufficient funds: need $${buyPrice}`);
            setTimeout(() => setMarketErrorMessage(null), 3000);
            return;
        }

        setPendingMarketTransaction({
            action: 'buy',
            commodity: type,
            amount: 1
        });
    };

    const handleSell = (type: CommodityType) => {
        if (gameState.phase !== 'Trade') return;
        const stock = gameState.markets[type].stock;
        if (stock >= MARKET_STEPS.length) return; // Market full

        // Check if player has the commodity to sell
        if (player.resources[type] < 1) {
            setMarketErrorMessage(`You don't have any ${type} to sell`);
            setTimeout(() => setMarketErrorMessage(null), 3000);
            return;
        }

        setPendingMarketTransaction({
            action: 'sell',
            commodity: type,
            amount: 1
        });
    };

    const handleConfirmMarketTransaction = () => {
        if (!pendingMarketTransaction) return;

        handleAction(pendingMarketTransaction.action, pendingMarketTransaction.commodity);
        setPendingMarketTransaction(null);
    };

    const handleCancelMarketTransaction = () => {
        setPendingMarketTransaction(null);
    };

    const handleActionWrapper = (action: string, payload?: any) => {
        handleAction(action, payload);
    };

    const handleConfirmBuild = () => {
        if (pendingBuild) {
            handleAction('buildIndustry', {
                id: pendingBuild.id,
                type: pendingBuild.type,
                orientation: pendingBuild.orientation,
                force: forceMode,
                extraTurns
            });
            setPendingBuild(null);
            setInteractionMode('idle');
        }
    };

    const handleCancelBuild = () => {
        setPendingBuild(null); // Just clear pending
        setInteractionMode('idle');
    };

    const handleRotatePending = () => {
        if (pendingBuild && validPlacements && validPlacements[pendingBuild.id]) {
            const validOrients = validPlacements[pendingBuild.id];
            // Find current index in valid list
            const currentIdx = validOrients.indexOf(pendingBuild.orientation);
            // Next valid
            const nextIdx = (currentIdx + 1) % validOrients.length;
            setPendingBuild({ ...pendingBuild, orientation: validOrients[nextIdx] });
        } else if (pendingBuild) {
            // Fallback if no validation logic (or force placed where invalid?)
            setPendingBuild(prev => prev ? ({ ...prev, orientation: (prev.orientation + 1) % 6 }) : null);
        }
    };

    const handleCellClick = (cell: HexCell) => {
        if (interactionLocked) return;
        const id = coordsToString(cell.q, cell.r);

        // Setup Phase - special handling
        if (gameState.phase === 'Setup') {
            handleSetupCellClick(id);
            return;
        }

        // Don't allow selection in produce phase
        if (gameState.phase !== 'Produce') {
            setSelectedCellId(id);
        }

        // If we have a pending move target (after selecting destination), handle rotate/cancel
        if (pendingMoveTarget) {
            // Clicking elsewhere cancels the pending move
            setPendingMoveTarget(null);
            setMoveSourceId(null);
            return;
        }

        // If we are already in placing mode, maybe clicking another cell moves the ghost?
        if (interactionMode === 'placing' && pendingBuild) {
            // Check if valid target
            if (validPlacements && validPlacements[id]) {
                // Reset orientation to first valid for this new cell
                setPendingBuild({ ...pendingBuild, id, orientation: validPlacements[id][0] });
            } else {
                // If not valid but permitted to move ghost? 
                // Currently only allowing moving ghost to valid spots makes sense with strict UI.
                // But let's allow moving anywhere but maybe show 'Invalid' state?
                // Request says: "If I click generator indicate all potential tiles... If there are none put a message"
                // It doesn't strictly say I CANT click a bad one. 
                // But for "Smart Rotation", we need valid orientations.
                // If I click an invalid cell, I can't rotate smartly.
                // Logic: Just move potential ghost, but maybe don't allow Confirm if invalid?
                // Simplification for now: Only allow moving ghost to Valid spots if validation is Active.
                if (validPlacements && validPlacements[id]) {
                    setPendingBuild({ ...pendingBuild, id, orientation: validPlacements[id][0] });
                }
            }
            return;
        }

        // Tool Logic
        if (selectedTool === 'Move') {
            if (gameState.phase !== 'Develop') return;

            // If not in moving mode yet, start it (shouldn't happen with button click)
            if (!isMoving) {
                setIsMoving(true);
                setMoveSourceId(null);
                setMoveHistory([]);
                setMovesCompleted(0);
            }

            if (!moveSourceId) {
                // Select a tile to move
                if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                    setMoveSourceId(id);
                }
            } else {
                // Move the selected tile to this location
                if (moveSourceId === id) {
                    // Clicking the same tile deselects it
                    setMoveSourceId(null);
                } else {
                    // Validate the destination
                    const fromCell = gameState.board[moveSourceId];
                    const toCell = gameState.board[id];

                    // Basic validation
                    let isValidDest = false;
                    if (!toCell.occupant) {
                        isValidDest = true;
                    } else if (toCell.occupant.type === 'Flag' && toCell.occupant.playerId === player.id) {
                        isValidDest = true;
                    }

                    if (!isValidDest || id === '0,0') {
                        // Invalid destination - don't increment moves
                        setMoveSourceId(null);
                        return;
                    }

                    // Check for partial dot mismatches (unless force mode)
                    const movedTile = fromCell.occupant?.tile;
                    if (movedTile && !moveForceMode) {
                        const tileDef = TILE_DEFINITIONS[movedTile.type];
                        const coords = stringToCoords(id);
                        let hasMismatch = false;

                        // Check each edge for half-dots
                        for (let i = 0; i < 6; i++) {
                            const absoluteSide = (i + movedTile.orientation) % 6;
                            const edgeFeature = tileDef.features.find(f =>
                                f.type === 'Edge' && f.position === i && f.feature === 'HalfDot'
                            );

                            if (edgeFeature) {
                                const neighborCoords = getNeighbor(coords, absoluteSide);
                                const neighborId = coordsToString(neighborCoords.q, neighborCoords.r);
                                const neighborCell = gameState.board[neighborId];

                                if (neighborCell?.occupant?.type === 'Industry' && neighborCell.occupant.tile) {
                                    const neighborTile = neighborCell.occupant.tile;
                                    const neighborDef = TILE_DEFINITIONS[neighborTile.type];
                                    const oppositeSide = (absoluteSide + 3) % 6;
                                    const relativeOpposite = (oppositeSide - neighborTile.orientation + 6) % 6;
                                    const neighborEdge = neighborDef.features.find(f =>
                                        f.type === 'Edge' && f.position === relativeOpposite && f.feature === 'HalfDot'
                                    );

                                    if (neighborEdge && neighborEdge.commodity !== edgeFeature.commodity) {
                                        hasMismatch = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (hasMismatch) {
                            // Show pending move target with rotation option
                            setPendingMoveTarget({ from: moveSourceId, to: id, orientation: movedTile.orientation });
                            return;
                        }
                    }

                    // Execute the move
                    handleAction('moveIndustry', { fromId: moveSourceId, toId: id, extraTurns: true });

                    // Track the move
                    setMoveHistory(prev => [...prev, { from: moveSourceId, to: id }]);
                    setMovesCompleted(prev => prev + 1);
                    setMoveSourceId(null);

                    // If 3 moves completed, end move mode and deduct capital
                    if (movesCompleted + 1 >= 3) {
                        // Deduct capital
                        const updatedPlayer = {
                            ...player,
                            resources: {
                                ...player.resources,
                                Capital: player.resources.Capital - 1
                            }
                        };
                        handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? updatedPlayer : p) });

                        // Reset move state and advance turn
                        setIsMoving(false);
                        setMoveSourceId(null);
                        setMoveHistory([]);
                        setMovesCompleted(0);
                        setMoveForceMode(false);
                        handleAction('pass');
                    }
                }
            }
        }
        else if (selectedTool === 'Rotate') {
            // Immediate Rotate (Existing)
            if (cell.occupant?.type === 'Industry' && cell.occupant.tile) {
                // Actually, since we can't mutate state directly here, we need an action?
                // Or just Sandbox edit?
                // Sandbox edit:
                if (cell.occupant?.type === 'Industry' && cell.occupant.tile) {
                    const currentOrientation = cell.occupant.tile.orientation || 0;
                    handleAction('sandboxPlaceTile', {
                        id,
                        cell: {
                            ...cell,
                            occupant: {
                                ...cell.occupant,
                                tile: { ...cell.occupant.tile, orientation: (currentOrientation + 1) % 6 }
                            }
                        }
                    });
                }
            }
        }
        else if (selectedTool === 'Eraser') {
            const newCell = { ...cell, occupant: null };
            handleAction('sandboxPlaceTile', { id, cell: newCell });
        }
        else if (selectedTool === 'Flag') {
            if (gameState.phase === 'Develop') {
                handleAction('placeFlag', { id, extraTurns });
            } else {
                // Sandbox Force
                const newCell = { ...cell, occupant: { type: 'Flag', playerId: player.id } };
                handleAction('sandboxPlaceTile', { id, cell: newCell });
            }
        }
        else if (selectedTool === 'Automate') {
            if (cell.occupant?.type === 'Industry') {
                handleAction('automateBloc', { id, extraTurns });
            }
        }
        else if (TILE_DEFINITIONS[selectedTool as IndustryType]) {
            // Industry Tool Selected -> Enter Placing Mode
            console.log('[Develop Phase] Industry tool clicked:', {
                phase: gameState.phase,
                selectedTool,
                cellId: id,
                cellOccupant: cell.occupant,
                validPlacements: validPlacements ? Object.keys(validPlacements).length : 'null',
                isValidCell: validPlacements && validPlacements[id] ? 'YES' : 'NO'
            });

            // Check if cell is valid? valid checks happen in 'buildIndustry' action, 
            // but for UI feedback we can allow placing ghost anywhere.

            // Init ghost at click IF valid? Or just init.
            if (validPlacements && validPlacements[id]) {
                console.log('[Develop Phase] Starting placing mode at', id, 'with orientation', validPlacements[id][0]);
                setInteractionMode('placing');
                setPendingBuild({
                    id,
                    type: selectedTool as IndustryType,
                    orientation: validPlacements[id][0]
                });
            } else {
                console.log('[Develop Phase] Cell not valid for placement:', id);
                // Fallback: If clicked invalid cell, do we start ghost?
                // Probably better to auto-select first valid cell? Or Just wait for user to click valid one?
                // Let's require clicking a valid one to START placing.
            }
        }
    };

    // Calculate production for selected tile (Read-only debug)
    let productionDisplay = null;
    if (selectedCellId && gameState.board[selectedCellId]) {
        const cell = gameState.board[selectedCellId];
        const prod = calculateProduction(gameState.board, cell);
        if (prod) {
            productionDisplay = (
                <div style={{ marginTop: '10px' }}>
                    <strong>Potential Production:</strong> {prod.amount} {prod.commodity}
                    <ul style={{ fontSize: '0.8em', margin: '5px 0', paddingLeft: '20px' }}>
                        {prod.log.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                </div>
            );
        }
    }

    // Aggregation helper
    const aggregateGlobal = (results: Record<string, any>) => {
        const totals: Record<string, number> = { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0, Money: 0 };
        Object.values(results).forEach(res => {
            Object.entries(res.outputs).forEach(([k, v]) => {
                totals[k] = (totals[k] || 0) + (v as number);
            });
        });
        return totals;
    };

    const globalProduction = calculateGlobalProduction(gameState.board);
    // Filter to current player only
    const playerProduction = { [player.id]: globalProduction[player.id] || { outputs: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0, Money: 0 }, costs: { Food: 0, Energy: 0, Labor: 0, Ore: 0 }, logs: [] } };
    let globalStats = aggregateGlobal(playerProduction);
    let projectedStats = null;

    if (interactionMode === 'placing' && pendingBuild) {
        const projectedBoard = {
            ...gameState.board,
            [pendingBuild.id]: {
                ...gameState.board[pendingBuild.id],
                occupant: {
                    type: 'Industry',
                    playerId: player.id,
                    tile: { ...pendingBuild, ownerId: player.id, active: true } // active=true to project production
                } as any
            }
        };
        const projectedProduction = calculateGlobalProduction(projectedBoard);
        // Filter to current player only
        const playerProjected = { [player.id]: projectedProduction[player.id] || { outputs: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0, Money: 0 }, costs: { Food: 0, Energy: 0, Labor: 0, Ore: 0 }, logs: [] } };
        projectedStats = aggregateGlobal(playerProjected);
    }

    // Helper to render stat line
    const StatLine = ({ label, value, color, projected }: { label: string, value: number, color: string, projected?: number }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', color }}>
            <span>{label}:</span>
            <div>
                <span style={{ fontWeight: 'bold' }}>{value}</span>
                {projected !== undefined && projected !== value && (
                    <span style={{ marginLeft: '5px', fontSize: '11px', color: '#fff' }}>
                        &rarr; <span style={{ color: projected > value ? 'lime' : 'red' }}>{projected}</span>
                    </span>
                )}
            </div>
        </div>
    );


    // Check Affordability Helper
    const canAfford = (type: IndustryType, isForce: boolean) => {
        const def = TILE_DEFINITIONS[type];
        if (!def || !def.costStruct) return false;

        const cost: Record<string, number> = { ...def.costStruct };
        if (isForce) {
            cost['Capital'] = (cost['Capital'] || 0) + 1;
        }

        for (const [res, amt] of Object.entries(cost)) {
            if (player.resources[res as CommodityType] < amt!) return false;
        }
        return true;
    };

    // Trade Modal Handlers
    const handleProposeTrade = (targetPlayerId: string, giving: TradeOffer, receiving: TradeOffer) => {
        setPendingTrade({
            proposerId: player.id,
            targetId: targetPlayerId,
            giving,
            receiving
        });
        setShowTradeModal(false);
    };

    const handleAcceptTrade = () => {
        if (!pendingTrade) return;

        // Execute the trade
        handleAction('barter', {
            proposerId: pendingTrade.proposerId,
            targetId: pendingTrade.targetId,
            giving: pendingTrade.giving,
            receiving: pendingTrade.receiving
        });

        // Pass the turn after successful trade
        handleAction('pass');

        setPendingTrade(null);
    };

    const handleRejectTrade = () => {
        // Rejection doesn't pass the turn - proposer can try again
        setPendingTrade(null);
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', background: '#111' }}>
            {/* Victory Screen Overlay */}
            {gameState.gameEnded && (
                <VictoryScreen
                    players={gameState.players}
                    board={gameState.board}
                    onNewGame={mode === 'remote' ? requestRematch : startNewGame}
                />
            )}

            {/* Setup Phase Overlay */}
            {gameState.phase === 'Setup' && gameState.setupPhase && (
                <SetupPhase
                    gameState={gameState}
                    onSelectPackage={handleSelectPackage}
                    canAct={canAct}
                />
            )}

            {/* Last Round Warning */}
            {gameState.isLastRound && !gameState.gameEnded && (
                <div style={{
                    background: 'linear-gradient(to bottom, rgba(255, 165, 0, 0.9), rgba(255, 140, 0, 0.8))',
                    color: '#000',
                    padding: '12px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    borderBottom: '3px solid #ff8c00',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    textShadow: '1px 1px 2px rgba(255,255,255,0.3)'
                }}>
                    ⚠️ LAST ROUND! ⚠️
                </div>
            )}

            {/* Control Panel (Top Header - Phase/Round Info + Top Level Actions like Pass) */}
            <ControlPanel
                gameState={gameState}
                onAction={handleActionWrapper}
                canAct={canAct}
                lobbyCode={mode === 'remote' && lobby ? lobby.code : undefined}
                onLeave={mode === 'remote' ? leaveLobby : () => window.location.reload()}
            />

            {/* Main Layout - 4 Columns */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
                {interactionLocked && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 5,
                        background: 'rgba(15, 23, 42, 0.8)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: '#e2e8f0',
                        textAlign: 'center',
                        padding: '24px'
                    }}>
                        <span style={{ fontSize: '18px', fontWeight: 600 }}>
                            Waiting for {activePlayer ? activePlayer.name : 'other players'}
                        </span>
                        <span style={{ fontSize: '14px', color: '#c7d2fe' }}>
                            You are connected, but only the current player can act.
                        </span>
                    </div>
                )}

                {/* Col 1: Players */}
                <div style={{
                    width: '220px',
                    padding: '10px',
                    borderRight: '1px solid #333',
                    background: '#1a1a1a',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <PlayerRoster
                        players={gameState.players}
                        currentPlayerId={
                            gameState.phase === 'Setup' && gameState.setupPhase?.currentDrafterIndex !== undefined
                                ? gameState.players[gameState.setupPhase.currentDrafterIndex].id
                                : player.id
                        }
                        firstPlayerIndex={gameState.firstPlayerIndex}
                    />

                    {/* Tiles Remaining Display */}
                    <div style={{
                        background: '#222',
                        padding: '10px',
                        borderRadius: '5px',
                        marginTop: 'auto'
                    }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#fff', borderBottom: '1px solid #555', fontSize: '14px' }}>Tiles Remaining</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '11px' }}>
                            {Object.entries(gameState.tilesRemaining).map(([type, count]) => {
                                const tileType = type as IndustryType;
                                const def = TILE_DEFINITIONS[tileType];
                                const mainCommodity = def.features.find(f => f.commodity)?.commodity;

                                return (
                                    <div key={type} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: count === 0 ? '#666' : '#aaa'
                                    }}>
                                        {mainCommodity && mainCommodity !== 'Money' && (
                                            <ResourceIcon type={mainCommodity as CommodityType} size={12} />
                                        )}
                                        {mainCommodity === 'Money' && (
                                            <ResourceIcon type="Money" size={12} />
                                        )}
                                        <span>{type}</span>
                                        <span style={{
                                            fontWeight: 'bold',
                                            marginLeft: 'auto',
                                            color: count === 0 ? '#ef4444' : count <= 3 ? '#f59e0b' : '#4ade80'
                                        }}>
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Col 2: Actions & Output */}
                <div style={{
                    width: '240px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    borderRight: '1px solid #333',
                    background: '#1a1a1a',
                    overflowY: 'auto'
                }}>
                    {/* Build / Tools Section */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ color: 'white', margin: '0 0 10px 0', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Actions</h3>
                        {gameState.phase === 'Setup' && gameState.setupPhase?.step === 'placeTile' && gameState.setupPhase.pendingPlacement && (() => {
                            const { packageId, tilesRemaining } = gameState.setupPhase.pendingPlacement;
                            const pkg = [...getAvailablePackages(gameState.players.length, []), ...getAvailablePackages(gameState.players.length, gameState.setupPhase.takenPackageIds)]
                                .find(p => p.id === packageId);
                            const totalTiles = pkg?.tiles.length || 0;
                            const tilesPlaced = totalTiles - tilesRemaining.length;
                            const allTilesPlaced = tilesRemaining.length === 0;
                            return (
                                <div style={{ background: '#222', padding: '8px', borderRadius: '4px', marginBottom: '10px', border: '2px solid #fbbf24' }}>
                                    <div style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                                        {allTilesPlaced
                                            ? 'All tiles placed!'
                                            : `Click on map to place ${tilesRemaining[0]} tile`
                                        }
                                    </div>
                                    <div style={{ color: '#888', fontSize: '11px' }}>
                                        {tilesPlaced}/{totalTiles} placed
                                    </div>
                                </div>
                            );
                        })()}

                        {interactionMode === 'placing' && pendingBuild ? (
                            /* Tile Placement Confirmation */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                                <div style={{ background: '#222', padding: '10px', borderRadius: '4px', border: '2px solid #f59e0b' }}>
                                    <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                                        Placing Tile
                                    </div>
                                    <div style={{ color: '#fff', fontSize: '16px', textAlign: 'center', marginBottom: '4px' }}>
                                        <strong>{pendingBuild.type}</strong>
                                    </div>
                                    <div style={{ color: '#888', fontSize: '11px', textAlign: 'center' }}>
                                        Orientation: {pendingBuild.orientation}
                                    </div>
                                </div>

                                <button
                                    onClick={handleRotatePending}
                                    style={{
                                        padding: '10px',
                                        background: '#f59e0b',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ↻ Rotate
                                </button>

                                <button
                                    onClick={handleConfirmBuild}
                                    style={{
                                        padding: '12px',
                                        background: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        marginTop: 'auto'
                                    }}
                                >
                                    ✓ Confirm Placement
                                </button>

                                <button
                                    onClick={handleCancelBuild}
                                    style={{
                                        padding: '10px',
                                        background: '#6b7280',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✕ Cancel
                                </button>
                            </div>
                        ) : isMoving && selectedTool === 'Move' ? (
                            /* Move Operation UI */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                                {pendingMoveTarget ? (
                                    /* Pending Move Confirmation */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ background: '#222', padding: '10px', borderRadius: '4px', border: '2px solid #f59e0b' }}>
                                            <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                                                Confirm Move
                                            </div>
                                            <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center' }}>
                                                Partial dots don't match
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                const movedTile = gameState.board[pendingMoveTarget.from]?.occupant?.tile;
                                                if (!movedTile) return;

                                                const currentOrientation = movedTile.orientation;
                                                const newOrientation = (currentOrientation + 1) % 6;

                                                // Update the tile orientation in the board
                                                const cell = gameState.board[pendingMoveTarget.from];
                                                if (cell.occupant?.type === 'Industry' && cell.occupant.tile) {
                                                    const updatedTile = { ...cell.occupant.tile, orientation: newOrientation };
                                                    const updatedCell = {
                                                        ...cell,
                                                        occupant: {
                                                            ...cell.occupant,
                                                            tile: updatedTile
                                                        }
                                                    };
                                                    handleAction('sandboxPlaceTile', { id: pendingMoveTarget.from, cell: updatedCell });
                                                }

                                                setPendingMoveTarget({ ...pendingMoveTarget, orientation: newOrientation });
                                            }}
                                            style={{
                                                padding: '10px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ↻ Rotate
                                        </button>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#222', borderRadius: '4px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={moveForceMode}
                                                onChange={(e) => setMoveForceMode(e.target.checked)}
                                            />
                                            <span style={{ color: '#ccc', fontSize: '12px' }}>Force move (costs 1 Capital)</span>
                                        </label>

                                        <button
                                            onClick={() => {
                                                if (!moveForceMode) return;

                                                // Deduct extra capital for forcing
                                                if (player.resources.Capital < 1) return;

                                                // Execute the move
                                                handleAction('moveIndustry', { fromId: pendingMoveTarget.from, toId: pendingMoveTarget.to, extraTurns: true });

                                                // Deduct capital for force
                                                const updatedPlayer = {
                                                    ...player,
                                                    resources: {
                                                        ...player.resources,
                                                        Capital: player.resources.Capital - 1
                                                    }
                                                };
                                                handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? updatedPlayer : p) });

                                                // Track the move
                                                setMoveHistory(prev => [...prev, { from: pendingMoveTarget.from, to: pendingMoveTarget.to }]);
                                                setMovesCompleted(prev => prev + 1);
                                                setPendingMoveTarget(null);
                                                setMoveSourceId(null);
                                                setMoveForceMode(false);

                                                // If 3 moves completed, end move mode and deduct capital
                                                if (movesCompleted + 1 >= 3) {
                                                    const finalPlayer = {
                                                        ...updatedPlayer,
                                                        resources: {
                                                            ...updatedPlayer.resources,
                                                            Capital: updatedPlayer.resources.Capital - 1
                                                        }
                                                    };
                                                    handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? finalPlayer : p) });

                                                    setIsMoving(false);
                                                    setMoveHistory([]);
                                                    setMovesCompleted(0);
                                                    handleAction('pass');
                                                }
                                            }}
                                            disabled={!moveForceMode}
                                            style={{
                                                padding: '12px',
                                                background: moveForceMode ? '#059669' : '#333',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                cursor: moveForceMode ? 'pointer' : 'not-allowed'
                                            }}
                                        >
                                            ✓ Confirm Force Move
                                        </button>

                                        <button
                                            onClick={() => {
                                                setPendingMoveTarget(null);
                                                setMoveSourceId(null);
                                                setMoveForceMode(false);
                                            }}
                                            style={{
                                                padding: '10px',
                                                background: '#6b7280',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✕ Cancel
                                        </button>
                                    </div>
                                ) : (
                                    /* Normal Move UI */
                                    <>
                                        <div style={{ background: '#222', padding: '10px', borderRadius: '4px', border: '2px solid cyan' }}>
                                            <div style={{ color: 'cyan', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                                                Move Operation
                                            </div>
                                            <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>
                                                {moveSourceId ? 'Select destination' : 'Select tile to move'}
                                            </div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: 'white' }}>
                                                {movesCompleted} / 3
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', marginTop: '4px' }}>
                                                moves completed
                                            </div>
                                        </div>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#222', borderRadius: '4px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={moveForceMode}
                                                onChange={(e) => setMoveForceMode(e.target.checked)}
                                            />
                                            <span style={{ color: '#ccc', fontSize: '12px' }}>Allow mismatched dots (+1 Capital each)</span>
                                        </label>

                                        <button
                                            onClick={() => {
                                                if (moveHistory.length > 0) {
                                                    const lastMove = moveHistory[moveHistory.length - 1];
                                                    // Undo the last move
                                                    handleAction('moveIndustry', { fromId: lastMove.to, toId: lastMove.from, extraTurns: true });
                                                    setMoveHistory(prev => prev.slice(0, -1));
                                                    setMovesCompleted(prev => prev - 1);
                                                    setMoveSourceId(null);
                                                } else if (moveSourceId) {
                                                    // Just deselect if no moves made
                                                    setMoveSourceId(null);
                                                }
                                            }}
                                            disabled={moveHistory.length === 0 && !moveSourceId}
                                            style={{
                                                padding: '10px',
                                                background: (moveHistory.length > 0 || moveSourceId) ? '#dc2626' : '#333',
                                                color: (moveHistory.length > 0 || moveSourceId) ? 'white' : '#666',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                cursor: (moveHistory.length > 0 || moveSourceId) ? 'pointer' : 'not-allowed'
                                            }}
                                        >
                                            ⟲ Undo {moveSourceId && !moveHistory.length ? 'Selection' : 'Last Move'}
                                        </button>

                                        {moveHistory.length === 0 && (
                                            <button
                                                onClick={() => {
                                                    // Cancel move mode without deducting capital
                                                    setIsMoving(false);
                                                    setMoveSourceId(null);
                                                    setMoveHistory([]);
                                                    setMovesCompleted(0);
                                                    setMoveForceMode(false);
                                                }}
                                                style={{
                                                    padding: '10px',
                                                    background: '#6b7280',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✕ Cancel
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                // End move mode early and deduct capital
                                                const updatedPlayer = {
                                                    ...player,
                                                    resources: {
                                                        ...player.resources,
                                                        Capital: player.resources.Capital - 1
                                                    }
                                                };
                                                handleAction('debug', { players: gameState.players.map(p => p.id === player.id ? updatedPlayer : p) });

                                                // Reset move state and advance turn
                                                setIsMoving(false);
                                                setMoveSourceId(null);
                                                setMoveHistory([]);
                                                setMovesCompleted(0);
                                                setMoveForceMode(false);
                                                handleAction('pass');
                                            }}
                                            style={{
                                                padding: '12px',
                                                background: '#059669',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                marginTop: 'auto'
                                            }}
                                        >
                                            ✓ Done Moving
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : gameState.phase === 'Setup' && gameState.setupPhase?.step === 'placeTile' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={() => handleAction('undoSetupPlacement')}
                                    disabled={!gameState.setupPhase.pendingPlacement?.placementHistory?.length}
                                    style={{
                                        padding: '10px',
                                        background: gameState.setupPhase.pendingPlacement?.placementHistory?.length ? '#ef4444' : '#444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: gameState.setupPhase.pendingPlacement?.placementHistory?.length ? 'pointer' : 'not-allowed',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ↶ Undo Last Tile
                                </button>
                                <button
                                    onClick={() => handleAction('rotateSetupTile')}
                                    disabled={!gameState.setupPhase.pendingPlacement?.placementHistory?.length}
                                    style={{
                                        padding: '10px',
                                        background: gameState.setupPhase.pendingPlacement?.placementHistory?.length ? '#3b82f6' : '#444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: gameState.setupPhase.pendingPlacement?.placementHistory?.length ? 'pointer' : 'not-allowed',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ⟳ Rotate Last Tile
                                </button>
                                <button
                                    onClick={() => handleAction('pass')}
                                    disabled={gameState.setupPhase.pendingPlacement?.tilesRemaining?.length !== 0}
                                    style={{
                                        padding: '10px',
                                        background: gameState.setupPhase.pendingPlacement?.tilesRemaining?.length === 0 ? '#10b981' : '#444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: gameState.setupPhase.pendingPlacement?.tilesRemaining?.length === 0 ? 'pointer' : 'not-allowed',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    ✓ Pass (Continue)
                                </button>
                            </div>
                        ) : gameState.phase === 'Setup' ? (
                            /* During other setup steps, show placeholder */
                            <div style={{ color: '#666', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                                Follow the setup instructions above
                            </div>
                        ) : gameState.phase === 'Produce' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflow: 'auto' }}>
                                {/* Net Production at Top */}
                                <div style={{ background: '#222', padding: '10px', borderRadius: '4px', borderTop: '2px solid #facc15' }}>
                                    <h4 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '13px' }}>Net Production</h4>
                                    <div style={{ fontSize: '11px' }}>
                                        <div style={{ color: '#f87171', marginBottom: '2px' }}>
                                            Consuming:
                                            {productionTotals.totalFoodCost > 0 && ` ${productionTotals.totalFoodCost} Food`}
                                            {productionTotals.totalFoodCost > 0 && productionTotals.totalEnergyCost > 0 && ','}
                                            {productionTotals.totalEnergyCost > 0 && ` ${productionTotals.totalEnergyCost} Energy`}
                                            {productionTotals.totalOreCost > 0 && `, ${productionTotals.totalOreCost} Ore`}
                                            {!productionTotals.totalFoodCost && !productionTotals.totalEnergyCost && !productionTotals.totalOreCost && ' 0'}
                                        </div>
                                        <div style={{ color: '#4ade80' }}>
                                            Producing: {Object.entries(productionTotals.outputs).map(([commodity, amount]) => `${amount} ${commodity}`).join(', ') || '0'}
                                        </div>
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ marginRight: '2px' }}>Net Gain:</span>
                                            {(() => {
                                                // Calculate net for all commodities (both produced and consumed)
                                                const netGains: Record<string, number> = {
                                                    Food: (productionTotals.outputs['Food'] || 0) - productionTotals.totalFoodCost,
                                                    Energy: (productionTotals.outputs['Energy'] || 0) - productionTotals.totalEnergyCost,
                                                    Labor: (productionTotals.outputs['Labor'] || 0),
                                                    Ore: (productionTotals.outputs['Ore'] || 0) - productionTotals.totalOreCost,
                                                    Capital: (productionTotals.outputs['Capital'] || 0),
                                                    Money: (productionTotals.outputs['Money'] || 0)
                                                };

                                                const hasAnyChange = Object.values(netGains).some(v => v !== 0);
                                                if (!hasAnyChange) {
                                                    return <span style={{ color: '#888' }}>±0</span>;
                                                }

                                                return Object.entries(netGains).map(([commodity, netAmount]) => {
                                                    if (netAmount === 0) return null;
                                                    const sign = netAmount > 0 ? '+' : '';
                                                    const color = netAmount > 0 ? '#4ade80' : '#f87171';
                                                    return (
                                                        <span key={commodity} style={{ display: 'flex', alignItems: 'center', gap: '2px', color }}>
                                                            {sign}{netAmount}
                                                            <ResourceIcon type={commodity as CommodityType} size={12} />
                                                        </span>
                                                    );
                                                }).filter(Boolean);
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Blocs List */}
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {playerBlocs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No Industries</div>}
                                    {playerBlocs.map((bloc, blocIndex) => {
                                        const config = blocConfigs.get(blocIndex);
                                        const totals = calculateBlocTotals(bloc.tiles, config);
                                        const hasAutomation = bloc.tiles.some(t => t.occupant?.tile?.automated);

                                        return (
                                            <div
                                                key={blocIndex}
                                                style={{
                                                    background: '#333',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    border: hoveredBlocIndex === blocIndex ? '2px solid #facc15' : '2px solid transparent'
                                                }}
                                                onMouseEnter={() => setHoveredBlocIndex(blocIndex)}
                                                onMouseLeave={() => setHoveredBlocIndex(null)}
                                            >
                                                {/* Bloc Header with Power Checkbox */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={config?.powered || false}
                                                            onChange={(e) => toggleBlocPower(blocIndex, e.target.checked)}
                                                        />
                                                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#ddd' }}>
                                                            {bloc.type} Bloc
                                                        </span>
                                                    </label>
                                                </div>

                                                {/* Automation Checkbox (if applicable) */}
                                                {hasAutomation && config?.powered && (
                                                    <div style={{ marginLeft: '24px', marginBottom: '6px' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={config?.automated || false}
                                                                onChange={(e) => toggleBlocAutomation(blocIndex, e.target.checked)}
                                                            />
                                                            <span style={{ color: '#c084fc' }}>Run Automation</span>
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Tiles to Feed */}
                                                {config?.powered && bloc.type !== 'Farm' && (
                                                    <div style={{ marginLeft: '24px', marginTop: '6px' }}>
                                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Tiles to Feed:</div>
                                                        {bloc.tiles.map((tile) => {
                                                            const tileId = coordsToString(tile.q, tile.r);
                                                            const isFed = config?.fedTiles.has(tileId) || false;

                                                            return (
                                                                <div
                                                                    key={tileId}
                                                                    style={{
                                                                        marginLeft: '8px',
                                                                        marginBottom: '2px',
                                                                        background: hoveredTileId === tileId ? '#444' : 'transparent',
                                                                        padding: '2px 4px',
                                                                        borderRadius: '2px'
                                                                    }}
                                                                    onMouseEnter={() => setHoveredTileId(tileId)}
                                                                    onMouseLeave={() => setHoveredTileId(null)}
                                                                >
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: config?.automated ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: config?.automated ? 0.6 : 1 }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isFed}
                                                                            disabled={config?.automated}
                                                                            onChange={(e) => toggleTileFed(blocIndex, tileId, e.target.checked)}
                                                                        />
                                                                        <span style={{ color: '#bbb' }}>Tile at {tileId}</span>
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Bloc Consumption/Production Summary */}
                                                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #444', fontSize: '11px' }}>
                                                    <div style={{ color: '#aaa' }}>
                                                        Consuming: {totals.costs.Food > 0 && `${totals.costs.Food} Food`}
                                                        {totals.costs.Food > 0 && totals.costs.Energy > 0 && ', '}
                                                        {totals.costs.Energy > 0 && `${totals.costs.Energy} Energy`}
                                                        {totals.costs.Ore > 0 && `, ${totals.costs.Ore} Ore`}
                                                        {!totals.costs.Food && !totals.costs.Energy && !totals.costs.Ore && '0'}
                                                    </div>
                                                    <div style={{ color: '#4ade80' }}>
                                                        Producing: {totals.production ? `${totals.production.amount} ${totals.production.commodity}` : '0'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Run Production Button */}
                                <button
                                    onClick={handleRunProduction}
                                    disabled={player.resources.Food < productionTotals.totalFoodCost || player.resources.Energy < productionTotals.totalEnergyCost}
                                    style={{
                                        padding: '12px',
                                        background: (player.resources.Food >= productionTotals.totalFoodCost && player.resources.Energy >= productionTotals.totalEnergyCost) ? '#1c3320' : '#322',
                                        borderColor: (player.resources.Food >= productionTotals.totalFoodCost && player.resources.Energy >= productionTotals.totalEnergyCost) ? '#22c55e' : '#522',
                                        color: '#fff',
                                        cursor: (player.resources.Food >= productionTotals.totalFoodCost && player.resources.Energy >= productionTotals.totalEnergyCost) ? 'pointer' : 'not-allowed',
                                        fontWeight: 'bold',
                                        marginTop: 'auto'
                                    }}
                                >
                                    Run Production
                                </button>
                            </div>
                        ) : gameState.phase === 'Trade' ? (
                            /* Trade Phase Actions */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                                <button
                                    onClick={() => setShowTradeModal(true)}
                                    style={{
                                        padding: '12px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🤝 Propose Trade
                                </button>

                                {/* Promissory Notes Section */}
                                <div style={{
                                    background: '#222',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <div style={{
                                        color: '#aaa',
                                        fontSize: '11px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        marginBottom: '4px'
                                    }}>
                                        Promissory Notes
                                    </div>
                                    <button
                                        onClick={() => handleAction('takeLoan')}
                                        disabled={20 - player.loans <= 0}
                                        style={{
                                            padding: '8px',
                                            background: 20 - player.loans > 0 ? '#059669' : '#333',
                                            color: 20 - player.loans > 0 ? 'white' : '#666',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 20 - player.loans > 0 ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        💸 Take Loan (+${20 - player.loans})
                                    </button>
                                    <button
                                        onClick={() => handleAction('repayLoan')}
                                        disabled={player.loans === 0 || player.money < 25}
                                        style={{
                                            padding: '8px',
                                            background: player.loans > 0 && player.money >= 25 ? '#dc2626' : '#333',
                                            color: player.loans > 0 && player.money >= 25 ? 'white' : '#666',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: player.loans > 0 && player.money >= 25 ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        💰 Repay Loan (-$25)
                                    </button>
                                    {player.loans > 0 && (
                                        <div style={{
                                            color: '#ef4444',
                                            fontSize: '10px',
                                            textAlign: 'center'
                                        }}>
                                            {player.loans} note{player.loans > 1 ? 's' : ''} outstanding (-{player.loans * 3} VPs)
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    background: '#222',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    color: '#aaa',
                                    fontSize: '12px',
                                    textAlign: 'center'
                                }}>
                                    Click on the market to buy or sell commodities, or propose a trade with another player.
                                </div>

                                {/* Pass Button */}
                                <button
                                    onClick={() => handleAction('pass')}
                                    style={{
                                        padding: '12px',
                                        background: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        marginTop: 'auto'
                                    }}
                                >
                                    ✓ Pass
                                </button>
                            </div>
                        ) : (
                            /* Existing Build Menu */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                {/* Standard Tools */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <button
                                        onClick={() => {
                                            setSelectedTool('Move');
                                            setIsMoving(true);
                                            setMoveSourceId(null);
                                            setMoveHistory([]);
                                            setMovesCompleted(0);
                                        }}
                                        disabled={!Object.values(gameState.board).some(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) || player.resources.Capital < 1}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '8px',
                                            borderColor: selectedTool === 'Move' ? 'cyan' : '#444',
                                            background: selectedTool === 'Move' ? '#1c3332' : '#222',
                                            color: selectedTool === 'Move' ? 'cyan' : 'white',
                                            opacity: (!Object.values(gameState.board).some(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) || player.resources.Capital < 1) ? 0.4 : 1,
                                            cursor: (Object.values(gameState.board).some(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) && player.resources.Capital >= 1) ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        <span style={{ fontWeight: 'bold' }}>Move</span>
                                        <div style={{ display: 'flex', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '10px', color: '#aaa' }}>1</span>
                                            <ResourceIcon type="Capital" size={10} />
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>3 moves</div>
                                    </button>

                                    <button
                                        onClick={() => setSelectedTool('Flag')}
                                        disabled={player.resources.Labor < 1 || player.flags <= 0}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '8px',
                                            borderColor: selectedTool === 'Flag' ? 'yellow' : '#444',
                                            background: selectedTool === 'Flag' ? '#33321c' : '#222',
                                            color: selectedTool === 'Flag' ? 'yellow' : 'white',
                                            opacity: (player.resources.Labor < 1 || player.flags <= 0) ? 0.4 : 1,
                                            cursor: (player.resources.Labor >= 1 && player.flags > 0) ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        <span style={{ fontWeight: 'bold' }}>Flag</span>
                                        <div style={{ display: 'flex', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '10px', color: '#aaa' }}>1</span>
                                            <ResourceIcon type="Labor" size={10} />
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setSelectedTool('Automate')}
                                        disabled={player.resources.Energy < 1 || player.resources.Capital < 2 || !Object.values(gameState.board).some(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id && cell.occupant.tile && !cell.occupant.tile.automated)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '8px',
                                            borderColor: selectedTool === 'Automate' ? 'magenta' : '#444',
                                            background: selectedTool === 'Automate' ? '#331c33' : '#222',
                                            color: selectedTool === 'Automate' ? 'magenta' : 'white',
                                            opacity: (player.resources.Energy < 1 || player.resources.Capital < 2 || !Object.values(gameState.board).some(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id && cell.occupant.tile && !cell.occupant.tile.automated)) ? 0.4 : 1,
                                            cursor: (player.resources.Energy >= 1 && player.resources.Capital >= 2 && Object.values(gameState.board).some(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id && cell.occupant.tile && !cell.occupant.tile.automated)) ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        <span style={{ fontWeight: 'bold' }}>Auto</span>
                                        <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                                                <span style={{ fontSize: '10px', color: '#aaa' }}>1</span>
                                                <ResourceIcon type="Energy" size={10} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                                                <span style={{ fontSize: '10px', color: '#aaa' }}>2</span>
                                                <ResourceIcon type="Capital" size={10} />
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div style={{ height: '1px', background: '#333', margin: '5px 0' }} />

                                {/* Build List */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ color: '#fff', fontSize: '14px' }}>Build Industry</span>
                                    <label style={{ fontSize: '12px', color: forceMode ? 'magenta' : '#888', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={forceMode} onChange={(e) => setForceMode(e.target.checked)} />
                                        Force (+1 Cap)
                                    </label>
                                </div>

                                {/* Build List */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {Object.keys(TILE_DEFINITIONS).map(typeKey => {
                                        const type = typeKey as IndustryType;
                                        const def = TILE_DEFINITIONS[type];
                                        const isSelected = selectedTool === type;
                                        // Count costs using structured data
                                        const costComponents = Object.entries(def.costStruct || {}).map(([type, amount]) => ({ amount, type }));

                                        const affordable = canAfford(type, forceMode);

                                        return (
                                            <button
                                                key={type}
                                                onClick={() => affordable && setSelectedTool(type)}
                                                disabled={!affordable}
                                                style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                    padding: '8px',
                                                    borderColor: isSelected ? 'green' : '#444',
                                                    background: isSelected ? '#1c3320' : '#222',
                                                    opacity: affordable ? 1 : 0.4,
                                                    cursor: affordable ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                <span style={{ fontWeight: 'bold' }}>{type}</span>
                                                <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                                                    {costComponents.map((c, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                                                            <span style={{ fontSize: '10px', color: '#aaa' }}>{c.amount}</span>
                                                            <ResourceIcon type={c.type as any} size={10} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Pass Button for Develop Phase */}
                                <button
                                    onClick={() => handleAction('pass')}
                                    style={{
                                        padding: '12px',
                                        background: '#059669',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        marginTop: 'auto'
                                    }}
                                >
                                    ✓ Pass
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Global Output Stats/Trade Needs (Bottom of Action Col) */}
                    {gameState.phase === 'Develop' && (
                        <div style={{
                            background: '#222',
                            padding: '10px',
                            borderRadius: '5px',
                            marginTop: 'auto'
                        }}>
                            <h4 style={{ margin: '0 0 5px 0', color: '#fff', borderBottom: '1px solid #555' }}>Potential Output</h4>
                            <StatLine label="Food" value={globalStats.Food} projected={projectedStats?.Food} color="#facc15" />
                            <StatLine label="Energy" value={globalStats.Energy} projected={projectedStats?.Energy} color="#3b82f6" />
                            <StatLine label="Labor" value={globalStats.Labor} projected={projectedStats?.Labor} color="#ef4444" />
                            <StatLine label="Ore" value={globalStats.Ore} projected={projectedStats?.Ore} color="#9ca3af" />
                            <StatLine label="Capital" value={globalStats.Capital} projected={projectedStats?.Capital} color="#fff" />
                        </div>
                    )}

                    {gameState.phase === 'Trade' && (
                        <div style={{
                            background: '#222',
                            padding: '10px',
                            borderRadius: '5px',
                            marginTop: 'auto'
                        }}>
                            <h4 style={{ margin: '0 0 5px 0', color: '#fff', borderBottom: '1px solid #555' }}>Current Needs</h4>
                            <div style={{ fontSize: '12px', color: '#aaa' }}>
                                To run all your tiles:
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '5px', fontSize: '11px', flexWrap: 'wrap' }}>
                                {Object.values(gameState.board).filter(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id).length > 0 ? (
                                    <>
                                        {(() => {
                                            // Calculate what would be needed to run all tiles
                                            const visited = new Set<string>();
                                            let foodNeeded = 0;
                                            let energyNeeded = 0;
                                            let oreNeeded = 0;

                                            Object.values(gameState.board).forEach(cell => {
                                                if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                                                    const id = coordsToString(cell.q, cell.r);
                                                    if (visited.has(id)) return;

                                                    const bloc = identifyBloc(gameState.board, cell);
                                                    bloc.forEach(b => visited.add(coordsToString(b.q, b.r)));

                                                    // Check if this bloc has automation
                                                    const hasAutomation = bloc.some(t => t.occupant?.tile?.automated);
                                                    const costs = calculateBlocCosts(bloc, hasAutomation);
                                                    foodNeeded += costs.Food;
                                                    energyNeeded += costs.Energy;
                                                    oreNeeded += costs.Ore;
                                                }
                                            });

                                            return (
                                                <>
                                                    {foodNeeded > 0 && (
                                                        <span style={{ color: player.resources.Food >= foodNeeded ? '#4ade80' : '#f87171' }}>
                                                            Food: {foodNeeded} / {player.resources.Food}
                                                        </span>
                                                    )}
                                                    {energyNeeded > 0 && (
                                                        <span style={{ color: player.resources.Energy >= energyNeeded ? '#4ade80' : '#f87171' }}>
                                                            Energy: {energyNeeded} / {player.resources.Energy}
                                                        </span>
                                                    )}
                                                    {oreNeeded > 0 && (
                                                        <span style={{ color: player.resources.Ore >= oreNeeded ? '#4ade80' : '#f87171' }}>
                                                            Ore: {oreNeeded} / {player.resources.Ore}
                                                        </span>
                                                    )}
                                                    {foodNeeded === 0 && energyNeeded === 0 && oreNeeded === 0 && (
                                                        <span style={{ color: '#4ade80' }}>No costs!</span>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <span style={{ color: '#666', fontStyle: 'italic' }}>No industries</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Col 3: Map */}
                <div style={{ flex: 1, position: 'relative', background: '#000' }}>
                    {/* No Valid Placements Warning */}
                    {gameState.phase === 'Setup' && setupTileType && Object.keys(setupValidPlacements).length === 0 && (
                        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '5px 10px', borderRadius: '4px' }}>
                            No valid placements for {setupTileType}
                        </div>
                    )}
                    {gameState.phase !== 'Setup' && validPlacements && Object.keys(validPlacements).length === 0 && (
                        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '5px 10px', borderRadius: '4px' }}>
                            No valid placements for {selectedTool}
                        </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <Board
                            board={gameState.board}
                            players={gameState.players}
                            onCellClick={handleCellClick}
                            selectedCellId={moveSourceId || (gameState.phase === 'Setup' && gameState.setupPhase?.pendingPlacement?.placementHistory && gameState.setupPhase.pendingPlacement.placementHistory.length > 0
                                ? gameState.setupPhase.pendingPlacement.placementHistory[gameState.setupPhase.pendingPlacement.placementHistory.length - 1]
                                : undefined)}
                            ghostTile={gameState.phase === 'Setup' && setupTileType && selectedCellId && setupValidPlacements[selectedCellId] ?
                                { id: selectedCellId, type: setupTileType, orientation: setupValidPlacements[selectedCellId][0] } :
                                (interactionMode === 'placing' ? pendingBuild : null)}
                            highlightedCells={
                                moveSourceId && selectedTool === 'Move' ?
                                    // Show valid target cells in green when a tile is selected for moving (excluding center)
                                    Object.keys(gameState.board).filter(id => id !== '0,0' && (!gameState.board[id].occupant || gameState.board[id].occupant?.playerId === player.id)) :
                                    (gameState.phase === 'Setup' ?
                                        Object.keys(setupValidPlacements) :
                                        (validPlacements ? Object.keys(validPlacements) : undefined))
                            }
                            hoverHighlightedCells={hoverHighlightedCells}
                        />
                    </div>
                </div>

                {/* Col 4: Market + Cheat */}
                <div style={{
                    width: '380px',
                    background: '#1a1a1a',
                    borderLeft: '1px solid #333',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto'
                }}>
                    {/* Market Section */}
                    <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
                        <h3 style={{ color: 'white', margin: '0 0 10px 0', textAlign: 'center' }}>Market</h3>
                        {marketErrorMessage && (
                            <div style={{ background: 'rgba(255,0,0,0.8)', color: 'white', padding: '8px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', fontSize: '12px' }}>
                                {marketErrorMessage}
                            </div>
                        )}
                        <div style={{ overflowX: 'auto', paddingBottom: '5px' }}>
                            {pendingMarketTransaction ? (
                                <MarketTransactionModal
                                    action={pendingMarketTransaction.action}
                                    commodity={pendingMarketTransaction.commodity}
                                    amount={pendingMarketTransaction.amount}
                                    price={
                                        pendingMarketTransaction.action === 'buy'
                                            ? MARKET_STEPS[gameState.markets[pendingMarketTransaction.commodity].stock - 1].buy
                                            : MARKET_STEPS[gameState.markets[pendingMarketTransaction.commodity].stock].sell
                                    }
                                    onConfirm={handleConfirmMarketTransaction}
                                    onCancel={handleCancelMarketTransaction}
                                />
                            ) : (
                                <MarketBoard markets={gameState.markets} onBuy={handleBuy} onSell={handleSell} />
                            )}
                        </div>
                        <div style={{ padding: '5px', color: '#666', fontSize: '11px', textAlign: 'center' }}>
                            {gameState.phase === 'Trade' ? 'Market Active' : 'Market Closed'}
                        </div>
                    </div>

                    {/* Cheat Sheet / Debug */}
                    <div style={{ padding: '10px', background: '#111', flex: 1 }}>
                        <div style={{ marginBottom: '5px', color: '#666', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Cheat Sheet</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={extraTurns}
                                        onChange={(e) => setExtraTurns(e.target.checked)}
                                    />
                                    Extra Turns
                                </label>
                                <button
                                    onClick={() => setSelectedTool('Eraser')}
                                    style={{ fontSize: '10px', padding: '2px 6px', borderColor: selectedTool === 'Eraser' ? 'red' : '#444', color: selectedTool === 'Eraser' ? 'red' : '#666' }}
                                >
                                    Eraser
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            <button onClick={() => handleAction('debug', { field: 'resource', type: 'Food', amount: 1 })}>+F</button>
                            <button onClick={() => handleAction('debug', { field: 'resource', type: 'Energy', amount: 1 })}>+E</button>
                            <button onClick={() => handleAction('debug', { field: 'resource', type: 'Labor', amount: 1 })}>+L</button>
                            <button onClick={() => handleAction('debug', { field: 'resource', type: 'Ore', amount: 1 })}>+O</button>
                            <button onClick={() => handleAction('debug', { field: 'resource', type: 'Capital', amount: 1 })}>+C</button>
                            <button onClick={() => handleAction('debug', { field: 'money', amount: 10 })}>+$10</button>
                            <button onClick={() => handleAction('debug', { field: 'flags', amount: 1 })}>+Flag</button>
                            <button
                                onClick={() => {
                                    const demoState = { ...gameState };
                                    // P1 (Blue) - Farm bloc in center-left area
                                    demoState.board['-1,0'] = {
                                        ...demoState.board['-1,0'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p1',
                                            tile: { id: 'f1', type: 'Farm' as IndustryType, orientation: 0, ownerId: 'p1', active: true }
                                        }
                                    };
                                    demoState.board['-1,1'] = {
                                        ...demoState.board['-1,1'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p1',
                                            tile: { id: 'f2', type: 'Farm' as IndustryType, orientation: 3, ownerId: 'p1', active: true }
                                        }
                                    };
                                    // P1 Generator
                                    demoState.board['0,1'] = {
                                        ...demoState.board['0,1'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p1',
                                            tile: { id: 'g1', type: 'Generator' as IndustryType, orientation: 0, ownerId: 'p1', active: true, automated: true }
                                        }
                                    };
                                    // P1 Factory
                                    demoState.board['-2,1'] = {
                                        ...demoState.board['-2,1'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p1',
                                            tile: { id: 'fc1', type: 'Factory' as IndustryType, orientation: 1, ownerId: 'p1', active: true }
                                        }
                                    };
                                    // P1 Flags for expansion
                                    demoState.board['-2,2'] = { ...demoState.board['-2,2'], occupant: { type: 'Flag', playerId: 'p1' } };
                                    demoState.board['0,0'] = { ...demoState.board['0,0'], occupant: { type: 'Flag', playerId: 'p1' } };

                                    // P2 (Red) - Mine bloc in right area
                                    demoState.board['2,-1'] = {
                                        ...demoState.board['2,-1'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p2',
                                            tile: { id: 'm1', type: 'Mine' as IndustryType, orientation: 0, ownerId: 'p2', active: true }
                                        }
                                    };
                                    demoState.board['2,0'] = {
                                        ...demoState.board['2,0'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p2',
                                            tile: { id: 'm2', type: 'Mine' as IndustryType, orientation: 3, ownerId: 'p2', active: true }
                                        }
                                    };
                                    // P2 Academy
                                    demoState.board['1,0'] = {
                                        ...demoState.board['1,0'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p2',
                                            tile: { id: 'a1', type: 'Academy' as IndustryType, orientation: 2, ownerId: 'p2', active: true }
                                        }
                                    };
                                    // P2 Bank
                                    demoState.board['3,-1'] = {
                                        ...demoState.board['3,-1'],
                                        occupant: {
                                            type: 'Industry', playerId: 'p2',
                                            tile: { id: 'b1', type: 'Bank' as IndustryType, orientation: 4, ownerId: 'p2', active: true }
                                        }
                                    };
                                    // P2 Flags
                                    demoState.board['1,-1'] = { ...demoState.board['1,-1'], occupant: { type: 'Flag', playerId: 'p2' } };
                                    demoState.board['3,0'] = { ...demoState.board['3,0'], occupant: { type: 'Flag', playerId: 'p2' } };

                                    handleAction('loadState', demoState);
                                }}
                                style={{ fontSize: '10px', padding: '2px 6px', background: '#332244', color: '#fff', borderColor: '#664488' }}
                            >
                                Load Demo Board
                            </button>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                            {selectedCellId ? `Selected: ${selectedCellId} ` : 'No selection'}
                            {productionDisplay}
                        </div>
                    </div>
                </div>
            </div>

            {/* Trade Modals */}
            {showTradeModal && (
                <TradeModal
                    currentPlayer={player}
                    allPlayers={gameState.players}
                    onPropose={handleProposeTrade}
                    onCancel={() => setShowTradeModal(false)}
                />
            )}

            {pendingTrade && (
                <AcceptTradeModal
                    proposingPlayer={gameState.players.find(p => p.id === pendingTrade.proposerId)!}
                    receivingPlayer={gameState.players.find(p => p.id === pendingTrade.targetId)!}
                    giving={pendingTrade.giving}
                    receiving={pendingTrade.receiving}
                    onAccept={handleAcceptTrade}
                    onReject={handleRejectTrade}
                />
            )}
        </div>
    );
};
