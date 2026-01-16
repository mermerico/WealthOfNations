import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Board } from '../components/game/Board';
import type { HexCell, IndustryType, CommodityType, TradeOffer } from '../types/gameState';
import { TILE_DEFINITIONS } from '../utils/tileDefinitions';
import { coordsToString, stringToCoords, getNeighbors } from '../utils/hexUtils';
import { calculateProduction, calculateGlobalProduction, identifyBloc, calculateBlocCosts } from '../utils/production';
import { MarketBoard } from '../components/game/MarketBoard';
import { PlayerRoster } from '../components/game/PlayerRoster';
import { ControlPanel } from '../components/game/ControlPanel';
import { useGameEngineContext } from '../hooks/GameEngineProvider';
import { ResourceIcon } from '../components/ui/ResourceIcon';
import SetupPhase from '../components/game/SetupPhase';
import { getValidSetupPlacements } from '../utils/setupPlacementLogic';
import { getValidPlacements, getValidMoveTargets, validateTileDots } from '../utils/placementLogic';
import { TradeModal, AcceptTradeModal } from '../components/game/TradeModal';
import MarketTransactionModal from '../components/game/MarketTransactionModal';
import { MARKET_STEPS } from '../utils/marketDefinitions';
import { VictoryScreen } from '../components/game/VictoryScreen';
import { getAvailablePackages } from '../utils/packageDefinitions';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { TradeActionPanel } from '../components/game/TradeActionPanel';
import { PlacingTilePanel } from '../components/game/PlacingTilePanel';
import { MoveOperationPanel } from '../components/game/MoveOperationPanel';
import { SetupActionsPanel } from '../components/game/SetupActionsPanel';
import { ProduceActionsPanel } from '../components/game/ProduceActionsPanel';
import { ActionLog } from '../components/game/ActionLog';
import { DevelopBuildMenu } from '../components/game/DevelopBuildMenu';

export const Game: React.FC = () => {
    // Game Engine State
    const {
        gameState,
        handleAction: dispatchAction,
        startNewGame,
        mode,
        selfPlayer,
        requestRematch,
        lobby,
        leaveLobby,
        saveGame,
        saveSuccess,
        lastError,
        clearLastError
    } = useGameEngineContext();

    // UI State
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<IndustryType | 'Flag' | 'Eraser' | 'Rotate' | 'Move' | 'Automate' | null>(null);
    const [forceMode, setForceMode] = useState(false);
    const [moveSourceId, setMoveSourceId] = useState<string | null>(null);
    const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

    // Move operation state
    const [moveHistory, setMoveHistory] = useState<Array<{ from: string; to: string; cost: number; orientation?: number; force?: boolean; skipBaseCost?: boolean }>>([]);
    const [movesCompleted, setMovesCompleted] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [moveForceMode, setMoveForceMode] = useState(false);
    const [pendingMoveTarget, setPendingMoveTarget] = useState<{ from: string, to: string, orientation: number } | null>(null);

    // Turn Notification Sound Logic Moved Below activePlayerId Definition



    // Interaction State
    const [interactionMode, setInteractionMode] = useState<'idle' | 'placing'>('idle');
    const [pendingBuild, setPendingBuild] = useState<{ id: string, type: IndustryType, orientation: number } | null>(null);
    const [validPlacements, setValidPlacements] = useState<Record<string, number[]> | null>(null);

    // Trade Modal State
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [prefilledTrade, setPrefilledTrade] = useState<{
        targetId: string;
        giving: TradeOffer;
        receiving: TradeOffer;
    } | null>(null);
    // Selected player for operating costs display (local hotseat only)
    const [selectedCostsPlayerId, setSelectedCostsPlayerId] = useState<string | null>(null);

    // Removed local pendingTrade state in favor of gameState.pendingTrade

    // Market Transaction Modal State
    const [pendingMarketTransaction, setPendingMarketTransaction] = useState<{
        action: 'buy' | 'sell';
        commodity: CommodityType;
        amount: number;
    } | null>(null);
    const [marketErrorMessage, setMarketErrorMessage] = useState<string | null>(null);
    const [tradeAcceptedToast, setTradeAcceptedToast] = useState(false);
    const [showProductionConfirmation, setShowProductionConfirmation] = useState(false);
    const [showCoordinates] = useState(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        return navigator.webdriver || params.has('debug') || params.has('coordinates');
    });

    const prevPendingTradeRef = useRef<any>(null);
    const prevTurnIndexRef = useRef<number>(gameState.currentTurnPlayerIndex);

    // Helper to get active player (the player whose turn it is, or the local player during simultaneous phases)
    const player = useMemo(() => {
        if (mode === 'remote' && selfPlayer && (gameState.phase === 'Produce' || gameState.phase === 'Trade')) {
            return gameState.players.find(p => p.id === selfPlayer.playerId) || gameState.players[gameState.currentTurnPlayerIndex];
        }
        return gameState.players[gameState.currentTurnPlayerIndex];
    }, [gameState.players, gameState.currentTurnPlayerIndex, gameState.phase, mode, selfPlayer]);

    // Setup Phase State
    const [setupValidPlacements, setSetupValidPlacements] = useState<Record<string, number[]>>({});

    // Auto-determine tile type from pendingPlacement
    const setupTileType = gameState.setupPhase?.pendingPlacement?.tilesRemaining[0] || null;

    // Derived State for Move Preview
    const previewGameState = useMemo(() => {
        if (!moveHistory || moveHistory.length === 0) return gameState;

        const newBoard = { ...gameState.board };
        moveHistory.forEach(move => {
            const { from, to, orientation } = move;
            const fromCell = newBoard[from];
            const toCell = newBoard[to];

            if (fromCell && fromCell.occupant && toCell) {
                const movedOccupant = { ...fromCell.occupant };
                if (movedOccupant.tile) {
                    movedOccupant.tile = {
                        ...movedOccupant.tile,
                        orientation: orientation !== undefined ? orientation : (movedOccupant.tile.orientation || 0)
                    };
                }

                newBoard[from] = { ...fromCell, occupant: null };
                newBoard[to] = { ...toCell, occupant: movedOccupant };
            }
        });

        return {
            ...gameState,
            board: newBoard
        };
    }, [gameState, moveHistory]);

    const activePlayerId = useMemo(() => {
        if (gameState.phase === 'Setup' && gameState.setupPhase?.currentDrafterIndex !== undefined) {
            const drafter = gameState.players[gameState.setupPhase.currentDrafterIndex];
            return drafter ? drafter.id : null;
        }
        if (gameState.phase === 'Produce') {
            // In Produce phase, there isn't a single active player if remote
            return mode === 'remote' ? (selfPlayer?.playerId || null) : gameState.players[gameState.currentTurnPlayerIndex].id;
        }
        const current = gameState.players[gameState.currentTurnPlayerIndex];
        return current ? current.id : null;
    }, [gameState, mode, selfPlayer]);

    // Turn Notification Sound
    const turnSound = useMemo(() => new Audio('/sounds/turn-start.wav'), []);
    const prevTurnKey = React.useRef(`${gameState.phase} -${gameState.currentTurnPlayerIndex} `);

    useEffect(() => {
        const currentKey = `${gameState.phase} -${gameState.currentTurnPlayerIndex} `;
        if (currentKey !== prevTurnKey.current && !gameState.gameEnded) {
            prevTurnKey.current = currentKey;

            // Skip sound in test environments
            if (navigator.webdriver) return;

            // In remote mode, only play sound for the active player
            if (mode === 'remote' && activePlayerId !== selfPlayer?.playerId) {
                return;
            }

            turnSound.currentTime = 0;
            turnSound.play().catch(e => {
                // Ignore autoplay errors (user interaction required first)
                console.log('Turn notification sound blocked:', e);
            });
        }
    }, [gameState.phase, gameState.currentTurnPlayerIndex, gameState.gameEnded, turnSound, mode, activePlayerId, selfPlayer?.playerId]);


    const activePlayer = useMemo(() => {
        if (!activePlayerId) return null;
        return gameState.players.find(p => p.id === activePlayerId) ?? null;
    }, [gameState.players, activePlayerId]);

    const canAct = useMemo(() => {
        if (mode !== 'remote') return true;
        if (!selfPlayer) return false;

        // Simultaneous production in remote mode
        if (gameState.phase === 'Produce') {
            const myPlayer = gameState.players.find(p => p.id === selfPlayer.playerId);
            return !!myPlayer && !myPlayer.hasProduced;
        }

        if (!activePlayerId) return false;
        return selfPlayer.playerId === activePlayerId;
    }, [mode, selfPlayer, activePlayerId, gameState.phase, gameState.players]);

    const interactionLocked = mode === 'remote' && !canAct && !gameState.gameEnded;

    const handleAction = useCallback((action: string, payload?: any) => {
        if (mode === 'remote') {
            if (!selfPlayer) {
                console.warn(`Blocked action ${action} because client has no assigned seat.`);
                return;
            }

            // Exceptions for actions that can be taken out of turn
            const isTradeResponse = (action === 'acceptTrade' || action === 'rejectTrade');
            const isSetIntent = action === 'setTradeIntent';
            const isTargetOfTrade = gameState.pendingTrade?.targetId === selfPlayer.playerId;

            if (!canAct && !(isTradeResponse && isTargetOfTrade) && !isSetIntent) {
                console.warn(`Blocked action ${action} because it is not this player's turn.`);
                return;
            }
        }
        dispatchAction(action, payload);
    }, [dispatchAction, mode, selfPlayer, canAct, gameState.pendingTrade]);

    // Trade Acceptance Notification
    useEffect(() => {
        if (prevPendingTradeRef.current && !gameState.pendingTrade) {
            // Trade vanished. Was it accepted?
            // In acceptTrade, the turn always advances. In rejectTrade, it doesn't.
            const turnChanged = gameState.currentTurnPlayerIndex !== prevTurnIndexRef.current;
            const wasLocalProposer = prevPendingTradeRef.current.proposerId === player.id;

            if (turnChanged && wasLocalProposer) {
                setTradeAcceptedToast(true);
                setTimeout(() => setTradeAcceptedToast(false), 3000);
            }
        }
        prevPendingTradeRef.current = gameState.pendingTrade;
        prevTurnIndexRef.current = gameState.currentTurnPlayerIndex;
    }, [gameState.pendingTrade, gameState.currentTurnPlayerIndex, player.id]);

    // Reset selected tool when turn changes
    useEffect(() => {
        setSelectedTool(null);
    }, [gameState.currentTurnPlayerIndex]);

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
                // Highlight player's own industry tiles when selecting which tile to move
                // Use previewGameState to show tiles at their new positions after moves
                const valids: Record<string, number[]> = {};
                if (!isMoving || !moveSourceId) {
                    // Show all player's industry tiles as valid sources
                    Object.entries(previewGameState.board).forEach(([id, cell]) => {
                        if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id) {
                            valids[id] = [0]; // Dummy orientation, not used for highlighting source tiles
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
    }, [gameState.phase, gameState.board, selectedTool, player.id, player.resources, player.flags, forceMode, isMoving, moveSourceId, moveHistory, previewGameState.board]);

    // Setup Handlers
    const handleSelectPackage = (packageId: string) => {
        // Log for E2E test recording
        console.log(`[E2E_RECORD] selectPackage: player=${player.id}, packageId=${packageId}`);
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
        // Log for E2E test recording
        console.log(`[E2E_RECORD] placeSetupTile: player=${player.id}, cellId=${cellId}, tileType=${setupTileType}, orientation=${orientation}`);
        console.log('Placing tile:', { cellId, tileType: setupTileType, orientation });
        handleAction('placeSetupTile', { cellId, tileType: setupTileType, orientation });
        setSelectedCellId(null); // Clear selection after placement
    };

    // Trade Handlers
    const handleProposeTrade = (targetPlayerId: string, giving: TradeOffer, receiving: TradeOffer) => {
        handleAction('proposeTrade', {
            proposerId: player.id,
            targetId: targetPlayerId,
            giving,
            receiving
        });
        setShowTradeModal(false);
        setPrefilledTrade(null);
    };

    const handleOpenTradeWithPlayer = (targetId: string, giving: TradeOffer, receiving: TradeOffer) => {
        setPrefilledTrade({ targetId, giving, receiving });
        setShowTradeModal(true);
    };

    const handleAcceptTrade = () => {
        handleAction('acceptTrade');
    };

    const handleRejectTrade = () => {
        handleAction('rejectTrade');
    };

    // Determine if we should show the AcceptTradeModal
    // For local play (hotseat), show if there is a pending trade.
    // For remote play, show only if selfPlayer is the target.
    const shouldShowAcceptModal = useMemo(() => {
        if (!gameState.pendingTrade) return false;
        if (mode === 'remote') {
            return selfPlayer?.playerId === gameState.pendingTrade.targetId;
        }
        return true; // Hotseat: always show (turns enforce current player, but trade popup is for target)
    }, [gameState.pendingTrade, mode, selfPlayer]);

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
    const lastInitializedPlayerId = useRef<string | null>(null);

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
            // Only re-initialize if the player has changed or we haven't initialized for this player yet
            if (lastInitializedPlayerId.current === player.id && blocConfigs.size > 0) {
                return;
            }

            const newConfigs = new Map<number, BlocConfig>();
            playerBlocs.forEach((bloc, index) => {
                // Initialize with all tiles unchecked (player must check what they can afford)
                const allTileIds = new Set(bloc.tiles.map(t => coordsToString(t.q, t.r)));
                const hasAutomation = bloc.tiles.some(t => t.occupant?.tile?.automated);
                newConfigs.set(index, {
                    powered: false,
                    automated: hasAutomation,
                    fedTiles: allTileIds
                });
            });
            setBlocConfigs(newConfigs);
            lastInitializedPlayerId.current = player.id;
        } else {
            // Clear initialized player when not in Produce phase
            lastInitializedPlayerId.current = null;
        }
    }, [gameState.phase, playerBlocs, player.id]);

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

        handleAction('confirmProduction', { activeTiles, playerId: player.id });
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

        // Allow buy from empty (buying from supply)
        // Check if player can afford the purchase
        const priceIndex = Math.max(0, stock - 1);
        const buyPrice = MARKET_STEPS[type][priceIndex].buy;

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
        // Allow sell to full (selling to supply)

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
                force: forceMode
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
                    // Check if move limit reached (unless we are just editing? No, clicking new dest is new move)
                    if (movesCompleted >= 3) {
                        return;
                    }

                    // Validate the destination
                    const fromCell = previewGameState.board[moveSourceId];
                    const toCell = previewGameState.board[id];

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

                    // Otherwise, we are selecting a new destination (or updating pending)
                    // Logic to find valid orientation
                    const movedTile = fromCell.occupant?.tile;
                    if (!movedTile) {
                        setMoveSourceId(null);
                        return;
                    }

                    // Logic: If already pending at this location? (Covered by block above).
                    // So this is a NEW location.

                    let finalOrientation = movedTile.orientation || 0;

                    // If we have a pending target (at a DIFF location), maybe use its orientation as valid start?
                    // No, stick to source or default.

                    // Try to find valid orientation if not forcing
                    if (!moveForceMode) {
                        const dotValidation = validateTileDots(previewGameState.board, id, movedTile.type, finalOrientation, moveSourceId);
                        if (!dotValidation.isValid) {
                            let foundValid = false;
                            for (let o = 0; o < 6; o++) {
                                if (o === finalOrientation) continue;
                                const check = validateTileDots(previewGameState.board, id, movedTile.type, o, moveSourceId);
                                if (check.isValid) {
                                    finalOrientation = o;
                                    foundValid = true;
                                    break;
                                }
                            }
                            if (!foundValid) {
                                // If no valid orientation found, trigger Force dialog (via pending target with force implication? Or just set pending and let validation UI show error?)
                                // The UI displays validation error if pending target is invalid?
                                // MoveOperationPanel shows "Confirm Force Move" if pendingMoveTarget is set. 
                                // So setting pendingMoveTarget IS how we trigger strict force dialog.
                            }
                        }
                    }

                    // Set as pending target
                    setPendingMoveTarget({ from: moveSourceId, to: id, orientation: finalOrientation });
                    return;
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
                handleAction('placeFlag', { id });
            } else {
                // Sandbox Force
                const newCell = { ...cell, occupant: { type: 'Flag', playerId: player.id } };
                handleAction('sandboxPlaceTile', { id, cell: newCell });
            }
        }
        else if (selectedTool === 'Automate') {
            if (cell.occupant?.type === 'Industry') {
                handleAction('automateBloc', { id });
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

    // Helper to get descriptive error message when no valid placements exist
    const getDescriptiveErrorMessage = () => {
        if (selectedTool === 'Flag') {
            if (player.flags <= 0) return 'No flags remaining';
            return 'No valid locations adjacent to your territory';
        }

        if (TILE_DEFINITIONS[selectedTool as IndustryType]) {
            const hasFlagsOnBoard = Object.values(gameState.board).some(
                cell => cell.occupant?.type === 'Flag' && cell.occupant.playerId === player.id
            );

            if (!hasFlagsOnBoard) {
                if (player.flags > 0) return 'Place a flag first to claim territory';
                return 'No flags left to claim new territory';
            }
            return `No valid locations for ${selectedTool}`;
        }

        return `No valid locations for ${selectedTool}`;
    };

    // Render the appropriate action panel content based on game state
    const renderActionContent = () => {
        // Tile placement confirmation (Develop phase)
        if (interactionMode === 'placing' && pendingBuild) {
            return (
                <PlacingTilePanel
                    pendingBuild={pendingBuild}
                    onRotate={handleRotatePending}
                    onConfirm={handleConfirmBuild}
                    onCancel={handleCancelBuild}
                />
            );
        }

        // Move tool operation (Develop phase)
        if (isMoving && selectedTool === 'Move') {
            return (
                <MoveOperationPanel
                    movesCompleted={movesCompleted}
                    moveSourceId={moveSourceId}
                    moveHistory={moveHistory}
                    setMoveHistory={setMoveHistory}
                    setMovesCompleted={setMovesCompleted}
                    moveForceMode={moveForceMode}
                    setMoveForceMode={setMoveForceMode}
                    pendingMoveTarget={pendingMoveTarget}
                    setPendingMoveTarget={setPendingMoveTarget}
                    onPass={() => handleAction('pass')}
                    player={player}
                    gameState={gameState}
                    setMoveSourceId={setMoveSourceId}
                    setIsMoving={setIsMoving}
                    handleAction={handleAction}
                />
            );
        }

        // Setup phase - tile placement step
        if (gameState.phase === 'Setup' && gameState.setupPhase?.step === 'placeTile') {
            return (
                <SetupActionsPanel
                    gameState={gameState}
                    handleAction={handleAction}
                />
            );
        }

        // Setup phase - other steps
        if (gameState.phase === 'Setup') {
            return (
                <div style={{ color: '#666', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                    Follow the setup instructions above
                </div>
            );
        }

        // Produce phase
        if (gameState.phase === 'Produce') {
            if (player.hasProduced) {
                return (
                    <div
                        data-testid="production-confirmed-indicator"
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '16px',
                            color: '#ccc'
                        }}>
                        <div style={{ fontSize: '48px' }}>⏳</div>
                        <h3 style={{ margin: 0 }}>Production Complete</h3>
                        <p style={{ margin: 0, opacity: 0.7 }}>Waiting for other players to finish...</p>
                    </div>
                );
            }
            return (
                <ProduceActionsPanel
                    player={player}
                    playerBlocs={playerBlocs}
                    blocConfigs={blocConfigs}
                    productionTotals={productionTotals}
                    hoveredBlocIndex={hoveredBlocIndex}
                    hoveredTileId={hoveredTileId}
                    toggleBlocPower={toggleBlocPower}
                    toggleBlocAutomation={toggleBlocAutomation}
                    toggleTileFed={toggleTileFed}
                    setHoveredBlocIndex={setHoveredBlocIndex}
                    setHoveredTileId={setHoveredTileId}
                    calculateBlocTotals={calculateBlocTotals}
                    handleRunProduction={handleRunProduction}
                    showProductionConfirmation={showProductionConfirmation}
                    setShowProductionConfirmation={setShowProductionConfirmation}
                />
            );
        }

        // Trade phase
        if (gameState.phase === 'Trade') {
            return (
                <TradeActionPanel
                    gameState={gameState}
                    player={player}
                    mode={mode}
                    onAction={handleAction}
                    onOpenTradeWithPlayer={handleOpenTradeWithPlayer}
                    onSelectedPlayerChange={setSelectedCostsPlayerId}
                    canAct={canAct}
                />
            );
        }

        // Develop phase - default build menu
        return (
            <DevelopBuildMenu
                player={player}
                gameState={gameState}
                selectedTool={selectedTool}
                forceMode={forceMode}
                interactionLocked={interactionLocked}
                setSelectedTool={setSelectedTool}
                setForceMode={setForceMode}
                setIsMoving={setIsMoving}
                setMoveSourceId={setMoveSourceId}
                setMoveHistory={setMoveHistory}
                setMovesCompleted={setMovesCompleted}
                handleAction={handleAction}
                canAfford={canAfford}
            />
        );
    };

    const handleOpenPlayerAid = () => {
        window.open('/#player-aid', 'PlayerAid', 'width=1050,height=900,menubar=no,toolbar=no,location=no,status=no');
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
                onLeave={() => setShowLeaveConfirmation(true)}
                onSave={mode === 'remote' && lobby?.phase === 'inGame' ? saveGame : undefined}
                onOpenPlayerAid={handleOpenPlayerAid}
            />

            {/* Main Layout - 4 Columns */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
                {/* Global Status Messages */}
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    {lastError && (
                        <div style={{
                            background: '#991b1b',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            pointerEvents: 'auto',
                            border: '1px solid #ef4444'
                        }}>
                            <span style={{ fontSize: '14px', flex: 1 }}>{lastError}</span>
                            <button
                                onClick={clearLastError}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    padding: '0 4px',
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}
                    {saveSuccess && (
                        <div style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            pointerEvents: 'auto'
                        }}>
                            ✅ {saveSuccess}
                        </div>
                    )}
                </div>

                {tradeAcceptedToast && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1c3320',
                        color: '#22c55e',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        zIndex: 100,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                        border: '2px solid #22c55e',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '18px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        🤝 Trade Accepted!
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
                        currentPlayerId={activePlayerId || ''}
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
                        {/* Waiting message overlay for other phases (e.g. game ended or other non-actionable states) */}
                        {interactionLocked && !['Produce', 'Trade', 'Develop'].includes(gameState.phase) ? (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '16px',
                                color: '#ccc'
                            }}>
                                <div style={{ fontSize: '48px' }}>⏳</div>
                                <h3 style={{ margin: 0 }}>Waiting for {activePlayer ? activePlayer.name : 'other players'}</h3>
                                <p style={{ margin: 0, opacity: 0.7 }}>You are connected, but only the current player can act.</p>
                            </div>
                        ) : (
                            <>
                                {/* Centralized Waiting Banner for Trade and Develop phases */}
                                {interactionLocked && ['Trade', 'Develop'].includes(gameState.phase) && (
                                    <div style={{
                                        background: '#222',
                                        border: '1px solid #444',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        textAlign: 'center',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        color: '#ccc',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{ fontSize: '24px' }}>⏳</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'white' }}>
                                            Waiting for {activePlayer ? activePlayer.name : 'other players'}
                                        </div>
                                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                            You are connected, but only the current player can act.
                                        </div>
                                    </div>
                                )}

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

                                {renderActionContent()}

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
                                        {((globalStats.Money || 0) > 0 || (projectedStats?.Money || 0) > 0) && (
                                            <StatLine
                                                label="Money"
                                                value={globalStats.Money * 30}
                                                projected={projectedStats?.Money !== undefined ? projectedStats.Money * 30 : undefined}
                                                color="#a855f7"
                                            />
                                        )}
                                    </div>
                                )}

                                {gameState.phase === 'Trade' && (() => {
                                    // Use selected player from dropdown in local mode, otherwise current turn player
                                    const costsPlayer = mode === 'local' && selectedCostsPlayerId
                                        ? gameState.players.find(p => p.id === selectedCostsPlayerId) || player
                                        : player;

                                    return (
                                        <div style={{
                                            background: '#222',
                                            padding: '10px',
                                            borderRadius: '5px',
                                            marginTop: 'auto'
                                        }}>
                                            <h4 style={{ margin: '0 0 5px 0', color: '#fff', borderBottom: '1px solid #555' }}>Operating Costs</h4>
                                            <div style={{ fontSize: '12px', color: '#aaa' }}>
                                                To run {mode === 'local' && selectedCostsPlayerId ? `${costsPlayer.name}'s` : 'all your'} tiles (Stock / Required):
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '5px', fontSize: '11px', flexWrap: 'wrap' }}>
                                                {Object.values(gameState.board).filter(cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === costsPlayer.id).length > 0 ? (
                                                    <>
                                                        {(() => {
                                                            // Calculate what would be needed to run all tiles
                                                            const visited = new Set<string>();
                                                            let foodNeeded = 0;
                                                            let energyNeeded = 0;
                                                            let oreNeeded = 0;

                                                            Object.values(gameState.board).forEach(cell => {
                                                                if (cell.occupant?.type === 'Industry' && cell.occupant.playerId === costsPlayer.id) {
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
                                                                        <span style={{ color: costsPlayer.resources.Food >= foodNeeded ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <ResourceIcon type="Food" size={12} />: {costsPlayer.resources.Food} / {foodNeeded}
                                                                        </span>
                                                                    )}
                                                                    {energyNeeded > 0 && (
                                                                        <span style={{ color: costsPlayer.resources.Energy >= energyNeeded ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <ResourceIcon type="Energy" size={12} />: {costsPlayer.resources.Energy} / {energyNeeded}
                                                                        </span>
                                                                    )}
                                                                    {oreNeeded > 0 && (
                                                                        <span style={{ color: costsPlayer.resources.Ore >= oreNeeded ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <ResourceIcon type="Ore" size={12} />: {costsPlayer.resources.Ore} / {oreNeeded}
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
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </div>

                {/* Action Log Overlay */}
                <ActionLog logs={gameState.logs || []} players={gameState.players} />

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
                            {getDescriptiveErrorMessage()}
                        </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <Board
                            board={previewGameState.board}
                            players={gameState.players}
                            onCellClick={handleCellClick}
                            selectedCellId={moveSourceId || (gameState.phase === 'Setup' && gameState.setupPhase?.pendingPlacement?.placementHistory && gameState.setupPhase.pendingPlacement.placementHistory.length > 0
                                ? gameState.setupPhase.pendingPlacement.placementHistory[gameState.setupPhase.pendingPlacement.placementHistory.length - 1]
                                : undefined)}
                            ghostTile={
                                gameState.phase === 'Setup' && setupTileType && selectedCellId && setupValidPlacements[selectedCellId]
                                    ? { id: selectedCellId, type: setupTileType, orientation: setupValidPlacements[selectedCellId][0] }
                                    : (interactionMode === 'placing' ? pendingBuild : (
                                        pendingMoveTarget && pendingMoveTarget.to
                                            ? {
                                                id: pendingMoveTarget.to,
                                                type: previewGameState.board[pendingMoveTarget.from]?.occupant?.tile?.type || 'Farm', // Fallback safest
                                                orientation: pendingMoveTarget.orientation
                                            }
                                            : null
                                    ))
                            }
                            highlightedCells={
                                (interactionMode === 'placing' && pendingBuild) ? [pendingBuild.id] :
                                    (pendingMoveTarget && pendingMoveTarget.to) ? [pendingMoveTarget.to] :
                                        (moveSourceId && selectedTool === 'Move' ?
                                            // Show valid target cells in green when a tile is selected for moving
                                            (moveForceMode
                                                ? Object.keys(gameState.board).filter(id =>
                                                    id !== '0,0' &&
                                                    id !== moveSourceId &&
                                                    (!gameState.board[id].occupant ||
                                                        (gameState.board[id].occupant?.type === 'Flag' &&
                                                            gameState.board[id].occupant?.playerId === player.id)))
                                                : getValidMoveTargets(previewGameState.board, moveSourceId, player.id))
                                            : (previewGameState.phase === 'Setup' ?
                                                Object.keys(setupValidPlacements) :
                                                (validPlacements ? Object.keys(validPlacements) : undefined)))
                            }
                            hoverHighlightedCells={hoverHighlightedCells}
                            showCoordinates={showCoordinates}
                        />
                    </div>
                </div>

                {/* Col 4: Market + Cheat */}
                <div style={{
                    width: '450px',
                    background: '#1a1a1a',
                    borderLeft: '1px solid #333',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto'
                }}>
                    {/* Market Section */}
                    <div style={{
                        padding: '6px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0
                    }}>
                        <h3 style={{ color: 'white', margin: '0 0 10px 0', textAlign: 'center' }}>Market</h3>
                        {marketErrorMessage && (
                            <div style={{ background: 'rgba(255,0,0,0.8)', color: 'white', padding: '8px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', fontSize: '12px' }}>
                                {marketErrorMessage}
                            </div>
                        )}
                        <div style={{
                            overflowX: 'auto',
                            paddingBottom: '5px',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0
                        }}>
                            {pendingMarketTransaction ? (
                                <MarketTransactionModal
                                    action={pendingMarketTransaction.action}
                                    commodity={pendingMarketTransaction.commodity}
                                    amount={pendingMarketTransaction.amount}
                                    price={
                                        pendingMarketTransaction.action === 'buy'
                                            ? MARKET_STEPS[pendingMarketTransaction.commodity][gameState.markets[pendingMarketTransaction.commodity].stock - 1].buy
                                            : MARKET_STEPS[pendingMarketTransaction.commodity][gameState.markets[pendingMarketTransaction.commodity].stock].sell
                                    }
                                    onConfirm={handleConfirmMarketTransaction}
                                    onCancel={handleCancelMarketTransaction}
                                />
                            ) : (
                                <MarketBoard markets={gameState.markets} onBuy={handleBuy} onSell={handleSell} disabled={interactionLocked || gameState.phase !== 'Trade'} />
                            )}
                        </div>
                        <div style={{ padding: '5px', color: '#666', fontSize: '11px', textAlign: 'center', flexShrink: 0 }}>
                            {gameState.phase === 'Trade' ? 'Market Active' : 'Market Closed'}
                        </div>
                    </div>

                </div>
            </div>

            {/* Trade Modals */}
            {
                showTradeModal && (
                    <TradeModal
                        currentPlayer={player}
                        allPlayers={gameState.players}
                        markets={gameState.markets}
                        onPropose={handleProposeTrade}
                        onCancel={() => {
                            setShowTradeModal(false);
                            setPrefilledTrade(null);
                        }}
                        initialSelectedPlayerId={prefilledTrade?.targetId}
                        initialGiving={prefilledTrade?.giving}
                        initialReceiving={prefilledTrade?.receiving}
                    />
                )
            }

            {
                shouldShowAcceptModal && gameState.pendingTrade && (
                    <AcceptTradeModal
                        proposingPlayer={gameState.players.find(p => p.id === gameState.pendingTrade!.proposerId)!}
                        receivingPlayer={gameState.players.find(p => p.id === gameState.pendingTrade!.targetId)!}
                        giving={gameState.pendingTrade.giving}
                        receiving={gameState.pendingTrade.receiving}
                        markets={gameState.markets}
                        onAccept={handleAcceptTrade}
                        onReject={handleRejectTrade}
                    />
                )
            }



            <ConfirmationModal
                isOpen={showLeaveConfirmation}
                message="Are you sure you want to quit the game?"
                actions={[
                    ...(!gameState.gameEnded ? [{
                        label: 'Save and Quit',
                        onClick: () => {
                            if (mode === 'local') {
                                if (saveGame) saveGame();
                                window.location.reload();
                            } else {
                                if (saveGame) saveGame();
                                leaveLobby();
                            }
                            setShowLeaveConfirmation(false);
                        },
                        variant: 'primary' as const
                    }] : []),
                    {
                        label: 'Quit',
                        onClick: () => {
                            const leaveAction = mode === 'remote' ? leaveLobby : () => window.location.reload();
                            leaveAction();
                            setShowLeaveConfirmation(false);
                        },
                        variant: 'danger' as const
                    },
                    {
                        label: 'Cancel',
                        onClick: () => setShowLeaveConfirmation(false),
                        variant: 'secondary' as const
                    }
                ]}
            />
        </div>
    );
};
