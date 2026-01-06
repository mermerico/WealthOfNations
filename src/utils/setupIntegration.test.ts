import { describe, it, expect } from 'vitest';
import type { GameState } from '../types/gameState';
import { gameReducer } from './gameReducer';
import { getValidSetupPlacements } from './setupPlacementLogic';
import { MARKET_STARTING_QUANTITIES } from './marketPrices';

describe('Setup Phase Integration', () => {
    const createGameStateInSetup = (): GameState => {
        // Start with initial state
        const initialState: GameState = {
            players: [
                {
                    id: 'p1',
                    name: 'Player 1',
                    color: '#3b82f6',
                    resources: { Food: 5, Energy: 5, Labor: 5, Ore: 5, Capital: 5 },
                    money: 100,
                    loans: 0,
                    flags: 18,
                    ready: true,
                    flag: 'anglica.svg'
                },
                {
                    id: 'p2',
                    name: 'Player 2',
                    color: '#ef4444',
                    resources: { Food: 5, Energy: 5, Labor: 5, Ore: 5, Capital: 5 },
                    money: 100,
                    loans: 0,
                    flags: 18,
                    ready: true,
                    flag: 'bolshevica.svg'
                },
                {
                    id: 'p3',
                    name: 'Player 3',
                    color: '#10b981',
                    resources: { Food: 5, Energy: 5, Labor: 5, Ore: 5, Capital: 5 },
                    money: 100,
                    loans: 0,
                    flags: 18,
                    ready: true,
                    flag: 'bharat.svg'
                }
            ],
            board: {},
            markets: {
                Food: { stock: MARKET_STARTING_QUANTITIES.Food, priceIndex: MARKET_STARTING_QUANTITIES.Food },
                Energy: { stock: MARKET_STARTING_QUANTITIES.Energy, priceIndex: MARKET_STARTING_QUANTITIES.Energy },
                Labor: { stock: MARKET_STARTING_QUANTITIES.Labor, priceIndex: MARKET_STARTING_QUANTITIES.Labor },
                Ore: { stock: MARKET_STARTING_QUANTITIES.Ore, priceIndex: MARKET_STARTING_QUANTITIES.Ore },
                Capital: { stock: MARKET_STARTING_QUANTITIES.Capital, priceIndex: MARKET_STARTING_QUANTITIES.Capital }
            },
            phase: 'Trade',
            currentTurnPlayerIndex: 0,
            firstPlayerIndex: 0,
            round: 1,
            consecutivePasses: 0,
            tilesRemaining: {
                Farm: 15,
                Generator: 9,
                Academy: 9,
                Mine: 9,
                Factory: 9,
                Bank: 9
            },
            isLastRound: false,
            gameEnded: false,
            initialFlagsPerPlayer: 18,
            initialTiles: {
                Farm: 15,
                Generator: 9,
                Academy: 9,
                Mine: 9,
                Factory: 9,
                Bank: 9
            }
        };

        // Use gameReducer to properly enter Setup phase (now automatically selects first player)
        let result = gameReducer(initialState, 'startSetup');
        if (!result.success || !result.newState) throw new Error('Failed to start setup');
        let state = result.newState;

        // Select a package with Farm tiles (I1 has 3 Farm tiles)
        result = gameReducer(state, 'selectPackage', { packageId: 'I1' });
        if (!result.success || !result.newState) throw new Error('Failed to select package');

        return result.newState;
    };

    it('should calculate valid placements when user has Farm tiles to place', () => {
        const gameState = createGameStateInSetup();
        const setupTileType = 'Farm';
        const currentPlayer = gameState.players[gameState.setupPhase!.currentDrafterIndex];

        // Get list of tiles already placed by current player during setup
        const setupTileCells = Object.entries(gameState.board)
            .filter(([_, cell]) => cell.occupant?.type === 'Industry' && cell.occupant.playerId === currentPlayer.id)
            .map(([id, _]) => id);

        console.log('Current player:', currentPlayer.id);
        console.log('Setup tiles already placed:', setupTileCells);

        const validPlacements = getValidSetupPlacements(gameState.board, setupTileType, setupTileCells, currentPlayer.id);

        console.log('Number of valid placements:', Object.keys(validPlacements).length);
        console.log('Sample valid cells:', Object.keys(validPlacements).slice(0, 10));

        expect(Object.keys(validPlacements).length).toBeGreaterThan(0);
    });

    it('should handle clicking a valid cell when setupTileType is set', () => {
        const gameState = createGameStateInSetup();
        const setupTileType = 'Farm';
        const cellId = '1,0';

        const currentPlayer = gameState.players[gameState.setupPhase!.currentDrafterIndex];
        const setupTileCells = Object.entries(gameState.board)
            .filter(([_, cell]) => cell.occupant?.type === 'Industry' && cell.occupant.playerId === currentPlayer.id)
            .map(([id, _]) => id);

        const validPlacements = getValidSetupPlacements(gameState.board, setupTileType, setupTileCells, currentPlayer.id);

        console.log('Clicking cell:', cellId);
        console.log('Valid placements for this cell:', validPlacements[cellId]);

        expect(validPlacements[cellId]).toBeDefined();
        expect(validPlacements[cellId].length).toBeGreaterThan(0);

        // Simulate what handleSetupCellClick does
        const validOrientations = validPlacements[cellId];
        if (!validOrientations || validOrientations.length === 0) {
            console.log('ERROR: No valid orientations!');
        } else {
            const orientation = validOrientations[0];
            console.log('Would place Farm at', cellId, 'with orientation', orientation);
        }
    });

    it('should update validPlacements when setupTileType changes', () => {
        const gameState = createGameStateInSetup();
        const currentPlayer = gameState.players[gameState.setupPhase!.currentDrafterIndex];
        const setupTileCells: string[] = [];

        // Test changing tile type
        const tileTypes = ['Farm', 'Generator', 'Mine'];

        tileTypes.forEach(tileType => {
            const validPlacements = getValidSetupPlacements(
                gameState.board,
                tileType as any,
                setupTileCells,
                currentPlayer.id
            );

            console.log(`Valid placements for ${tileType}:`, Object.keys(validPlacements).length);
            expect(Object.keys(validPlacements).length).toBeGreaterThan(0);
        });
    });

    it('should handle the exact UI flow: select tile, then click map', () => {
        const gameState = createGameStateInSetup();

        // Step 1: User clicks "Farm" button -> setSetupTileType('Farm')
        const setupTileType = 'Farm';
        console.log('\n=== User clicks Farm button ===');
        console.log('setupTileType set to:', setupTileType);

        // Step 2: useEffect runs to calculate validPlacements
        const currentPlayer = gameState.players[gameState.setupPhase!.currentDrafterIndex];
        const setupTileCells = Object.entries(gameState.board)
            .filter(([_, cell]) => cell.occupant?.type === 'Industry' && cell.occupant.playerId === currentPlayer.id)
            .map(([id, _]) => id);

        const validPlacements = getValidSetupPlacements(
            gameState.board,
            setupTileType,
            setupTileCells,
            currentPlayer.id
        );

        console.log('validPlacements calculated:', Object.keys(validPlacements).length, 'cells');

        // Step 3: User clicks on the map at cell '1,0'
        const cellId = '1,0';
        console.log('\n=== User clicks on map at', cellId, '===');

        // Step 4: handleSetupCellClick executes
        const validOrientations = validPlacements[cellId];
        console.log('validOrientations for clicked cell:', validOrientations);

        if (!validOrientations || validOrientations.length === 0) {
            console.log('❌ PROBLEM: No valid orientations, click would be ignored!');
            expect(validOrientations).toBeDefined();
            expect(validOrientations.length).toBeGreaterThan(0);
        } else {
            const orientation = validOrientations[0];
            console.log('✓ Would call handleAction("placeSetupTile", { cellId:', cellId, ', tileType:', setupTileType, ', orientation:', orientation, '})');
        }
    });
});
