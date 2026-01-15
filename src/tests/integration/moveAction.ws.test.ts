import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MultiClientTestHarness } from './multiClientTestHarness';
import { ServerTestHarness } from './serverTestHarness';
import { GameState } from '../../types/gameState';

describe('Move Industry WebSocket Integration Tests', () => {
    let serverHarness: ServerTestHarness;
    let port: number;

    beforeAll(async () => {
        serverHarness = new ServerTestHarness();
        port = await serverHarness.start();
    });

    afterAll(async () => {
        if (serverHarness) await serverHarness.stop();
    });

    it('should reach Develop phase and perform a move action with orientation and flag refund', async () => {
        const harness = new MultiClientTestHarness();
        try {
            // Set up game and progress through Setup
            let state = await harness.setupGame(port, 3);
            state = await harness.progressToPhase('Develop');

            const activePlayerId = state.players[state.currentTurnPlayerIndex].id;
            const activePlayerIdx = state.currentTurnPlayerIndex;
            const turnsToPass = state.players.length - 1;

            // 1. Inject resources
            let activeClient = harness.getActiveClient(state);
            const commodities: import('../../types/gameState').CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];
            for (const type of commodities) {
                await harness.gameActionWithSync(activeClient, 'debug', { field: 'resource', type, amount: 20 }, 150);
            }
            state = harness.getLatestState();

            const pStart = state.players[activePlayerIdx];
            const startCapital = pStart.resources.Capital;
            const initialFlags = pStart.flags;

            // Adjacency helper
            const findAdjacentEmpty = (currentState: GameState, playerId: string) => {
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
            const flagCell1 = findAdjacentEmpty(state, activePlayerId)!;
            state = await harness.gameActionWithSync(activeClient, 'placeFlag', { id: flagCell1 }, 150);

            // Pass turns
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();

            // 3. Build a Farm on flagCell1 (Farms cost 1 Ore, 1 Capital)
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'buildIndustry', {
                id: flagCell1,
                type: 'Farm',
                orientation: 0,
                force: true
            }, 150);

            const pAfterBuild = state.players.find(p => p.id === activePlayerId)!;
            expect(pAfterBuild.flags).toBe(initialFlags - 1);
            // Capital should be startCapital - 1 (for Farm build)
            expect(pAfterBuild.resources.Capital).toBe(startCapital - 1);

            // Pass turns
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();

            // 4. Move industry with orientation change
            const targetCell1 = findAdjacentEmpty(state, activePlayerId)!;
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'moveIndustrySequence', {
                moves: [{
                    fromId: flagCell1,
                    toId: targetCell1,
                    orientation: 2
                }]
            }, 150);

            // Verify orientation and Capital cost
            expect(state.board[targetCell1].occupant!.tile!.orientation).toBe(2);
            const pAfterMove = state.players.find(p => p.id === activePlayerId)!;
            // Should be startCapital - 2 (1 for build, 1 for move)
            expect(pAfterMove.resources.Capital).toBe(startCapital - 2);

            // Cycle turns back to active player
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);

            // 5. Move industry to a cell with another flag (refunds second flag)
            // Note: We need a new flag first.
            const flagCell2 = findAdjacentEmpty(state, activePlayerId)!;
            state = await harness.gameActionWithSync(activeClient, 'placeFlag', { id: flagCell2 }, 150);
            expect(state.players.find(p => p.id === activePlayerId)!.flags).toBe(initialFlags - 2);

            // Pass to get back
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);

            // Move targetCell1 (Industry) to flagCell2 (Flag)
            state = await harness.gameActionWithSync(activeClient, 'moveIndustrySequence', {
                moves: [{
                    fromId: targetCell1,
                    toId: flagCell2,
                    orientation: 4,
                    skipBaseCost: true
                }]
            }, 150);

            // Verify flag refund
            const pFinal = state.players.find(p => p.id === activePlayerId)!;
            expect(pFinal.flags).toBe(initialFlags - 1);
            expect(pFinal.resources.Capital).toBe(startCapital - 2);
        } finally {
            harness.close();
        }
    }, 120000);

    it('should enforce dot adjacency including corners during move', async () => {
        const harness = new MultiClientTestHarness();
        try {
            let state = await harness.setupGame(port, 3);
            state = await harness.progressToPhase('Develop');

            const activePlayerId = state.players[state.currentTurnPlayerIndex].id;
            const turnsToPass = state.players.length - 1;

            // Inject resources
            let activeClient = harness.getActiveClient(state);
            for (const type of ['Labor', 'Capital', 'Ore', 'Energy'] as const) {
                await harness.gameActionWithSync(activeClient, 'debug', { field: 'resource', type, amount: 20 }, 150);
            }
            state = harness.getLatestState();

            const findAdjacentEmpty = (currentState: GameState, playerId: string, exclude: string[] = []) => {
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
                        if (currentState.board[neighborId] && currentState.board[neighborId].occupant === null && neighborId !== '0,0' && !exclude.includes(neighborId)) {
                            return neighborId;
                        }
                    }
                }
                return null;
            };

            // Build a Generator (dots on 0, 2, 4)
            const cell1 = findAdjacentEmpty(state, activePlayerId)!;
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'placeFlag', { id: cell1 }, 150);
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'buildIndustry', { id: cell1, type: 'Generator', orientation: 0, force: true }, 150);

            // Move another tile adjacent to it that mismatches
            const [q, r] = cell1.split(',').map(Number);
            const potentialNeighbors = [
                `${q},${r - 1}`, `${q + 1},${r - 1}`, `${q + 1},${r}`,
                `${q},${r + 1}`, `${q - 1},${r + 1}`, `${q - 1},${r}`
            ];

            let northId = null;
            for (const nId of potentialNeighbors) {
                if (state.board[nId] && state.board[nId].occupant === null && nId !== '0,0') {
                    northId = nId;
                    break;
                }
            }

            if (!northId) throw new Error('Could not find empty neighbor for mismatch test');

            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'placeFlag', { id: northId }, 150);

            const farCell = findAdjacentEmpty(state, activePlayerId, [northId])!;
            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            await harness.gameActionWithSync(activeClient, 'placeFlag', { id: farCell }, 150);

            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);
            state = await harness.gameActionWithSync(activeClient, 'buildIndustry', { id: farCell, type: 'Farm', orientation: 0, force: true }, 150);

            for (let i = 0; i < turnsToPass; i++) {
                activeClient = harness.getActiveClient(harness.getLatestState());
                await harness.gameActionWithSync(activeClient, 'pass', {}, 150);
            }
            state = harness.getLatestState();
            activeClient = harness.getActiveClient(state);

            // Negative test: Manually handle send/wait to avoid syncing other clients (who won't get state update on error)
            activeClient.send({
                type: 'gameAction',
                clientId: activeClient.clientId,
                action: 'moveIndustrySequence',
                payload: {
                    moves: [{
                        fromId: farCell,
                        toId: northId,
                        orientation: 0
                    }]
                }
            });

            const msg = await activeClient.waitFor((m) => m.type === 'error' || m.type === 'state', 2000);

            if (msg.type === 'state') {
                throw new Error('Should have failed due to mismatch, but got success state');
            }
            expect(msg.message).toContain('mismatch');
        } finally {
            harness.close();
        }
    }, 120000);
    it('should support simplified move scenarios using fixtures', async () => {
        const harness = new MultiClientTestHarness();
        try {
            // Setup game to establish connections and player IDs
            let setupState = await harness.setupGame(port, 3);

            // Map IDs by name to ensure we have the correct ID for Client 0 (Host)
            const hostPlayer = setupState.players.find(p => p.name === 'Host');
            const p2Player = setupState.players.find(p => p.name === 'Player2');
            const p3Player = setupState.players.find(p => p.name === 'Player3');

            if (!hostPlayer || !p2Player || !p3Player) {
                console.error('Players not found in setup state:', setupState.players.map(p => p.name));
                throw new Error('Failed to find expected players');
            }

            const p0Id = hostPlayer.id;
            const p1Id = p2Player.id;
            const p2Id = p3Player.id;

            console.log(`[Test] IDs mapped: Host=${p0Id}, P2=${p1Id}, P3=${p2Id}`);

            // Define a fixture state: 3 players, Develop phase, Player 0 (Client 0) active
            const fixtureState: GameState = {
                phase: 'Develop',
                currentTurnPlayerIndex: 0,
                players: [
                    { id: p0Id, name: 'Host', resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 20 }, money: 100, loans: 0, flags: 5, color: 'red', ready: true },
                    { id: p1Id, name: 'Player2', resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 20 }, money: 100, loans: 0, flags: 8, color: 'blue', ready: true },
                    { id: p2Id, name: 'Player3', resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 20 }, money: 100, loans: 0, flags: 8, color: 'green', ready: true }
                ],
                board: {
                    '0,0': { q: 0, r: 0, occupant: null }, // Center empty
                    // Player 0 tiles
                    '1,0': { q: 1, r: 0, occupant: { type: 'Industry', playerId: p0Id, tile: { id: 'tile-1', type: 'Farm', orientation: 0, ownerId: p0Id, active: true } } },
                    '2,0': { q: 2, r: 0, occupant: { type: 'Flag', playerId: p0Id } }, // Valid move target
                    '-1,0': { q: -1, r: 0, occupant: { type: 'Flag', playerId: p0Id } }, // Another target
                },
                markets: {
                    Food: { stock: 4, priceIndex: 4 },
                    Energy: { stock: 4, priceIndex: 4 },
                    Labor: { stock: 4, priceIndex: 4 },
                    Ore: { stock: 4, priceIndex: 4 },
                    Capital: { stock: 4, priceIndex: 4 },
                },
                round: 1,
                firstPlayerIndex: 0,
                consecutivePasses: 0,
                tilesRemaining: { Farm: 9, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
                isLastRound: false,
                gameEnded: false,

                logs: [],
                setupPhase: undefined,
                initialFlagsPerPlayer: 8,
                initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
                settings: {
                    promissoryNoteInterestFees: false
                }
            };

            // Load the fixture
            let state = await harness.loadStateFixture(port, fixtureState);
            const activeClient = harness.getClientByPlayerIndex(0)!; // Player 0 is Alice

            // 1. Test Rotate in Place (Move 1 - Cost 1)
            // '1,0' Farm -> Rotate to 1
            state = await harness.gameActionWithSync(activeClient, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '1,0',
                    orientation: 1, // distinct from 0
                    skipBaseCost: false
                }]
            }, 150);

            // Verify
            expect(state.board['1,0'].occupant!.tile!.orientation).toBe(1);
            expect(state.players[0].resources.Capital).toBe(19); // 20 - 1

            // 2. Test Chained Move (Move 2 - Cost 0 if simplified, but here we submit as new sequence)
            // Note: The 'moveIndustrySequence' action submits the fully resolved sequence.
            // If the UI sends [A->A (rot), A->B], backend sees it as one atomic operation?
            // Wait, the backend processes 'moveIndustrySequence' as a batch.
            // Let's test sending a generic valid sequence: [Rotate, Move]
            // This simulates "I rotated, then I moved".

            // Refund capital for clean slate testing? Or just track it.
            // Reset state
            // Reset state to ensure turn is back to Player 0
            state = await harness.loadStateFixture(port, fixtureState);

            // Logic Test: Move A -> B
            state = await harness.gameActionWithSync(activeClient, 'moveIndustrySequence', {
                moves: [{
                    fromId: '1,0',
                    toId: '2,0',
                    orientation: 0,
                    skipBaseCost: false
                }]
            }, 150);

            expect(state.board['1,0'].occupant).toBeNull();
            expect(state.board['2,0'].occupant!.tile!.type).toBe('Farm');
            expect(state.players[0].resources.Capital).toBe(19); // Cost 1
        } finally {
            harness.close();
        }
    }, 120000);
});
