import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MultiClientTestHarness } from './multiClientTestHarness';
import { ServerTestHarness } from './serverTestHarness';

describe('Production with Automation WebSocket Integration Tests', () => {
    let serverHarness: ServerTestHarness;
    let port: number;

    beforeAll(async () => {
        serverHarness = new ServerTestHarness();
        port = await serverHarness.start();
    });

    afterAll(async () => {
        if (serverHarness) await serverHarness.stop();
    });

    it('should charge Ore instead of Food when producing with automated bloc', async () => {
        const harness = new MultiClientTestHarness();
        try {
            // Set up game and progress through Setup
            let state = await harness.setupGame(port, 3);
            state = await harness.progressToPhase('Develop');

            const activePlayerId = state.players[state.currentTurnPlayerIndex].id;
            const activePlayerIdx = state.currentTurnPlayerIndex;
            const turnsToPass = state.players.length - 1;

            // 1. Inject resources for building, automating, and producing
            let activeClient = harness.getActiveClient(state);
            const commodities: import('../../types/gameState').CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];
            for (const type of commodities) {
                await harness.gameActionWithSync(activeClient, 'debug', { field: 'resource', type, amount: 20 }, 150);
            }
            state = harness.getLatestState();

            const pStart = state.players[activePlayerIdx];
            const startOre = pStart.resources.Ore;
            const startFood = pStart.resources.Food;
            const startEnergy = pStart.resources.Energy;

            // Helper to find adjacent empty cell
            const findAdjacentEmpty = (currentState: typeof state, playerId: string) => {
                const playerTiles = Object.entries(currentState.board)
                    .filter(([_, cell]) => cell.occupant && cell.occupant.playerId === playerId)
                    .map(([id]) => id);
                for (const tileId of playerTiles) {
                    const [q, r] = tileId.split(',').map(Number);
                    const neighbors = [
                        `${q + 1},${r}`, `${q - 1},${r}`, `${q},${r + 1}`,
                        `${q},${r - 1}`, `${q + 1},${r - 1}`, `${q - 1},${r + 1}`
                    ];
                    for (const neighborId of neighbors) {
                        if (currentState.board[neighborId] && currentState.board[neighborId].occupant === null && neighborId !== '0,0') {
                            return neighborId;
                        }
                    }
                }
                return null;
            };

            // 2. Place a flag (costs 1 Labor)
            const flagCell = findAdjacentEmpty(state, activePlayerId)!;
            expect(flagCell).toBeTruthy();
            state = await harness.gameActionWithSync(activeClient, 'placeFlag', { id: flagCell }, 150);

            // Pass turns to get back to active player
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();

            // 3. Build a Mine on flagCell (Mines cost 1 Ore, 1 Capital)
            // Mines produce Ore (1 per center dot)
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'buildIndustry', {
                id: flagCell,
                type: 'Mine',
                orientation: 0,
                force: true
            }, 150);

            // Verify tile was built
            expect(state.board[flagCell].occupant?.type).toBe('Industry');
            expect(state.board[flagCell].occupant?.tile?.type).toBe('Mine');

            // Pass turns
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();

            // 4. Automate the Mine bloc (costs 1 Energy, 2 Capital)
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'automateBloc', {
                id: flagCell
            }, 150);

            // Verify automation was applied
            const pAfterAutomation = state.players.find(p => p.id === activePlayerId)!;
            expect(state.board[flagCell].occupant?.tile?.automated).toBe(true);
            expect(pAfterAutomation.resources.Capital).toBeLessThan(20); // Spent on building and automation

            // Pass turns
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();

            // 5. Pass to end Develop phase and enter Produce phase
            // All players need to pass for phase to change
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'pass', {}, 150);

            // Continue passing until Produce phase
            while (harness.getLatestState().phase === 'Develop') {
                state = harness.getLatestState();
                activeClient = harness.getActiveClient(state);
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }

            state = harness.getLatestState();
            expect(state.phase).toBe('Produce');

            // 6. Verify resource levels before production
            const pBeforeProduce = state.players.find(p => p.id === activePlayerId)!;
            const oreBeforeProduce = pBeforeProduce.resources.Ore;
            const foodBeforeProduce = pBeforeProduce.resources.Food;
            const energyBeforeProduce = pBeforeProduce.resources.Energy;

            // 7. Confirm production for the automated Mine
            // Automated Mine should cost: 1 Ore (for automation) + 1 Energy (bloc cost)
            // Should produce: 1 Ore (from center dot)
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'confirmProduction', {
                playerId: activePlayerId,
                activeTiles: [flagCell]
            }, 150);

            // 8. Verify costs and production
            const pAfterProduce = state.players.find(p => p.id === activePlayerId)!;

            // CRITICAL: With automation, should charge Ore instead of Food
            expect(pAfterProduce.resources.Ore).toBe(oreBeforeProduce - 1 + 1); // -1 Ore cost, +1 Ore produced = net 0
            expect(pAfterProduce.resources.Food).toBe(foodBeforeProduce); // Food should NOT decrease
            expect(pAfterProduce.resources.Energy).toBe(energyBeforeProduce - 1); // -1 Energy bloc cost

        } finally {
            harness.close();
        }
    }, 120000);

    it('should handle both automated and non-automated blocs correctly', async () => {
        const harness = new MultiClientTestHarness();
        try {
            let state = await harness.setupGame(port, 3);
            state = await harness.progressToPhase('Develop');

            const activePlayerId = state.players[state.currentTurnPlayerIndex].id;
            const turnsToPass = state.players.length - 1;

            // Inject resources
            let activeClient = harness.getActiveClient(state);
            for (const type of ['Food', 'Energy', 'Labor', 'Ore', 'Capital'] as const) {
                await harness.gameActionWithSync(activeClient, 'debug', { field: 'resource', type, amount: 30 }, 150);
            }
            state = harness.getLatestState();

            // Simpler approach: Build factories adjacent to existing tiles,
            // then move one away to create two separate blocs
            const findAdjacentEmpty = (currentState: typeof state, playerId: string) => {
                const playerTiles = Object.entries(currentState.board)
                    .filter(([_, cell]) => cell.occupant && cell.occupant.playerId === playerId)
                    .map(([id]) => id);
                for (const tileId of playerTiles) {
                    const [q, r] = tileId.split(',').map(Number);
                    const neighbors = [
                        `${q + 1},${r}`, `${q - 1},${r}`, `${q},${r + 1}`,
                        `${q},${r - 1}`, `${q + 1},${r - 1}`, `${q - 1},${r + 1}`
                    ];
                    for (const neighborId of neighbors) {
                        if (currentState.board[neighborId] &&
                            currentState.board[neighborId].occupant === null &&
                            neighborId !== '0,0') {
                            return neighborId;
                        }
                    }
                }
                return null;
            };

            // Build first Factory adjacent to setup tiles
            const cell1 = findAdjacentEmpty(state, activePlayerId)!;
            await harness.gameActionWithSync(activeClient, 'placeFlag', { id: cell1 }, 150);
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'buildIndustry', { id: cell1, type: 'Factory', orientation: 0, force: true }, 150);

            // Build second Factory (might connect to first or setup, that's OK)
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            const cell2 = findAdjacentEmpty(state, activePlayerId)!;
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'placeFlag', { id: cell2 }, 150);
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'buildIndustry', { id: cell2, type: 'Factory', orientation: 0, force: true }, 150);

            // Move cell2 to a location far from cell1 to ensure separate blocs
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);

            // Find a far empty cell for the move destination
            const farEmptyCell = Object.entries(state.board)
                .filter(([id, c]) => c.occupant === null && id !== '0,0')
                .map(([id]) => id)
                .find(id => {
                    const [q, r] = id.split(',').map(Number);
                    // Far from origin
                    return Math.abs(q) >= 3 || Math.abs(r) >= 3;
                })!;

            await harness.gameActionWithSync(activeClient, 'moveIndustrySequence', {
                moves: [{ fromId: cell2, toId: farEmptyCell, orientation: 0 }]
            }, 150);

            // Update cell2 to the new position
            const cell2Final = farEmptyCell;

            // Automate only the first Factory
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'automateBloc', { id: cell1 }, 150);

            expect(state.board[cell1].occupant?.tile?.automated).toBe(true);
            expect(state.board[cell2Final].occupant?.tile?.automated).toBeFalsy();

            // Pass to Produce phase
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'pass', {}, 150);

            while (harness.getLatestState().phase === 'Develop') {
                state = harness.getLatestState();
                activeClient = harness.getActiveClient(state);
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }

            state = harness.getLatestState();
            expect(state.phase).toBe('Produce');


            const pBefore = state.players.find(p => p.id === activePlayerId)!;
            const oreBefore = pBefore.resources.Ore;
            const foodBefore = pBefore.resources.Food;
            const energyBefore = pBefore.resources.Energy;
            const capitalBefore = pBefore.resources.Capital;

            // Run production for both tiles
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'confirmProduction', {
                playerId: activePlayerId,
                activeTiles: [cell1, cell2Final]
            }, 150);

            const pAfter = state.players.find(p => p.id === activePlayerId)!;



            // Automated Factory (cell1): Costs 1 Ore + 1 Energy, produces 1 Capital
            // Non-automated Factory (cell2): Costs 1 Food + 1 Energy, produces 1 Capital
            // Total: 1 Ore + 1 Food + 2 Energy, produces 2 Capital

            // Note: Food/Ore may have changed during setup phase, so check deltas
            const oreDelta = pAfter.resources.Ore - oreBefore;
            const foodDelta = pAfter.resources.Food - foodBefore;
            const energyDelta = pAfter.resources.Energy - energyBefore;
            const capitalDelta = pAfter.resources.Capital - capitalBefore;

            expect(oreDelta).toBe(-1); // -1 Ore for automated bloc
            expect(foodDelta).toBe(-1); // -1 Food for non-automated bloc
            expect(energyDelta).toBe(-2); // -2 Energy (1 per bloc)
            expect(capitalDelta).toBe(2); // +2 Capital produced

        } finally {
            harness.close();
        }
    }, 120000);
});
