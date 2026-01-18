import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MultiClientTestHarness } from './multiClientTestHarness';
import { ServerTestHarness } from './serverTestHarness';
import { GameState } from '../../types/gameState';

describe('Trade Counterproposal WebSocket Integration Tests', () => {
    let serverHarness: ServerTestHarness;
    let port: number;

    beforeAll(async () => {
        serverHarness = new ServerTestHarness();
        port = await serverHarness.start();
    });

    afterAll(async () => {
        if (serverHarness) await serverHarness.stop();
    });

    it('should handle a full trade counterproposal cycle', async () => {
        const harness = new MultiClientTestHarness();
        try {
            // Setup game to establish connections and player IDs
            let setupState = await harness.setupGame(port, 3);

            // Map IDs by name
            const hostPlayer = setupState.players.find(p => p.name === 'Host')!;
            const p2Player = setupState.players.find(p => p.name === 'Player2')!;
            const p3Player = setupState.players.find(p => p.name === 'Player3')!;

            const p0Id = hostPlayer.id;
            const p1Id = p2Player.id;
            const p2Id = p3Player.id;

            // Define a fixture state: 3 players, Trade phase, Player 0 (Host) active
            const fixtureState: GameState = {
                phase: 'Trade',
                currentTurnPlayerIndex: 0,
                players: [
                    { id: p0Id, name: 'Host', resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }, money: 100, loans: 0, flags: 8, color: 'red', ready: false },
                    { id: p1Id, name: 'Player2', resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }, money: 100, loans: 0, flags: 8, color: 'blue', ready: false },
                    { id: p2Id, name: 'Player3', resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }, money: 100, loans: 0, flags: 8, color: 'green', ready: false }
                ],
                board: {},
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
                tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
                isLastRound: false,
                gameEnded: false,
                logs: [],
                setupPhase: undefined,
                initialFlagsPerPlayer: 8,
                initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
                settings: {
                    promissoryNoteInterestFees: false
                },
                tradeIntents: {}
            };

            // Load the fixture
            let state = await harness.loadStateFixture(port, fixtureState);
            const client0 = harness.getClientByPlayerIndex(0)!;
            const client1 = harness.getClientByPlayerIndex(1)!;

            // 1. Player 0 proposes a trade to Player 1
            const pushOffer = { commodities: { Food: 1 }, money: 0, loans: 0 };
            const pullOffer = { commodities: { Ore: 1 }, money: 0, loans: 0 };

            state = await harness.gameActionWithSync(client0, 'proposeTrade', {
                proposerId: p0Id,
                targetId: p1Id,
                giving: pushOffer,
                receiving: pullOffer
            });

            expect(state.pendingTrade).toBeDefined();
            expect(state.pendingTrade?.proposerId).toBe(p0Id);
            expect(state.pendingTrade?.targetId).toBe(p1Id);

            // 2. Verify Player 0 is blocked from taking next turn actions
            client0.send({
                type: 'gameAction',
                clientId: client0.clientId,
                action: 'buy',
                payload: { commodity: 'Food' }
            });
            const errorMsg = await client0.waitFor((m) => m.type === 'error', 2000);
            expect(errorMsg.message).toContain('Waiting for trade response');

            // 3. Player 1 rejects the trade (to initiate counter-proposal)
            state = await harness.gameActionWithSync(client1, 'rejectTrade');
            expect(state.pendingTrade).toBeNull();

            // 4. Player 1 (target) proposes a counter-trade back to Player 0 (original proposer)
            // This happens after B clicked "Counter" and filled out their new offer.
            const counterPush = { commodities: { Ore: 1 }, money: 10, loans: 0 }; // B gives Ore and $10
            const counterPull = { commodities: { Food: 2 }, money: 0, loans: 0 }; // B wants 2 Food

            state = await harness.gameActionWithSync(client1, 'proposeTrade', {
                proposerId: p1Id,
                targetId: p0Id,
                giving: counterPush,
                receiving: counterPull
            });

            // Verify both see the same pending trade where P1 is proposer and P0 is target
            // If Client 0 (A) didn't receive this state, harness.gameActionWithSync would have timed out.
            expect(state.pendingTrade).toBeDefined();
            expect(state.pendingTrade?.proposerId).toBe(p1Id);
            expect(state.pendingTrade?.targetId).toBe(p0Id);
            expect(state.pendingTrade?.giving.money).toBe(10);

            // 5. Player 0 accepts the counter-proposal
            state = await harness.gameActionWithSync(client0, 'acceptTrade');
            expect(state.pendingTrade).toBeNull();

            // 6. Verify resource swap
            const p0Final = state.players.find(p => p.id === p0Id)!;
            const p1Final = state.players.find(p => p.id === p1Id)!;

            // P0 gave 2 Food, received 1 Ore + $10
            expect(p0Final.resources.Food).toBe(8); // 10 - 2
            expect(p0Final.resources.Ore).toBe(11); // 10 + 1
            expect(p0Final.money).toBe(110); // 100 + 10

            // P1 gave 1 Ore + $10, received 2 Food
            expect(p1Final.resources.Food).toBe(12); // 10 + 2
            expect(p1Final.resources.Ore).toBe(9); // 10 - 1
            expect(p1Final.money).toBe(90); // 100 - 10

        } finally {
            harness.close();
        }
    }, 120000);
});
