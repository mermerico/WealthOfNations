
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiClientTestHarness } from './multiClientTestHarness';
import { startTestServer, stopTestServer } from './serverTestHarness';
import type { GameState } from '../../types/gameState';

describe('End Game Sequence Trigger (WebSocket)', () => {
    let harness: MultiClientTestHarness;
    let port: number;

    beforeEach(async () => {
        port = await startTestServer();
        harness = new MultiClientTestHarness();
    });

    afterEach(async () => {
        harness.close();
        stopTestServer();
    });

    it('should trigger end game sequence when all players pass in last round trade phase', async () => {
        // Create a fixture state where we are in the last round, Trade phase
        const fixtureState: GameState = {
            board: {},
            players: [
                { id: 'p1', name: 'Alice', color: '#f00', resources: { Food: 10, Energy: 0, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 0, hasProduced: false, ready: true, flag: 'anglica.svg', hasPassed: false },
                { id: 'p2', name: 'Bob', color: '#00f', resources: { Food: 5, Energy: 5, Labor: 0, Ore: 0, Capital: 0 }, money: 100, loans: 0, flags: 0, hasProduced: false, ready: true, flag: 'bolshevica.svg', hasPassed: false },
                { id: 'p3', name: 'Charlie', color: '#0f0', resources: { Food: 0, Energy: 0, Labor: 5, Ore: 5, Capital: 0 }, money: 100, loans: 0, flags: 0, hasProduced: false, ready: true, flag: 'bharat.svg', hasPassed: false }
            ],
            currentTurnPlayerIndex: 0,
            firstPlayerIndex: 0,
            phase: 'Trade',
            round: 4,
            markets: {
                Food: { stock: 4, priceIndex: 4 },
                Energy: { stock: 4, priceIndex: 4 },
                Labor: { stock: 4, priceIndex: 4 },
                Ore: { stock: 4, priceIndex: 4 },
                Capital: { stock: 4, priceIndex: 4 }
            },
            pendingTrade: null,
            tilesRemaining: { Farm: 5, Generator: 5, Academy: 5, Mine: 5, Factory: 5, Bank: 5 },
            isLastRound: true, // TRIGGER CONDITION
            gameEnded: false,
            consecutivePasses: 0,
            initialFlagsPerPlayer: 0,
            initialTiles: { Farm: 5, Generator: 5, Academy: 5, Mine: 5, Factory: 5, Bank: 5 },
            settings: {
                promissoryNoteInterestFees: true,
                multiBuySell: true,
                automatedFinalTrade: true // V2 FEATURE ENABLED
            },
            logs: [],
            setupPhase: undefined // Ensure setupPhase is undefined to avoid setup logic
        };

        // Load this state into the server (and connect clients)
        console.log('Loading state fixture...');
        let state;
        try {
            state = await harness.loadStateFixture(port, fixtureState);
        } catch (e: any) {
            console.error('FAILED TO LOAD STATE FIXTURE:', e.message);
            throw e;
        }

        // Verify loaded state
        expect(state.phase).toBe('Trade');
        expect(state.isLastRound).toBe(true);
        expect(state.settings.automatedFinalTrade).toBe(true);

        // Pass turns for all 3 players
        // Player 0 (Alice)
        let activeClient = harness.getActiveClient(state);
        state = await harness.gameActionWithSync(activeClient, 'pass');
        expect(state.consecutivePasses).toBe(1);

        // Player 1 (Bob)
        activeClient = harness.getActiveClient(state);
        state = await harness.gameActionWithSync(activeClient, 'pass');
        expect(state.consecutivePasses).toBe(2);

        // Player 2 (Charlie) - This should trigger game end sequence!
        activeClient = harness.getActiveClient(state);
        state = await harness.gameActionWithSync(activeClient, 'pass');

        // VERIFY: End Game Sequence should be active
        console.log('Final State after passes:', {
            gameEnded: state.gameEnded,
            endGameSequence: state.endGameSequence
        });

        // The exact assertion we care about:
        // gameEnded should NOT be true yet (because sequence starts first)
        expect(state.gameEnded).toBe(false);
        expect(state.endGameSequence).toBeDefined();
        expect(state.endGameSequence?.isActive).toBe(true);
        expect(state.endGameSequence?.currentStep).toBe(0); // Summary step

        // Bonus: Validate we can advance the step via the Host (Alice, index 0)
        const hostClient = harness.getClientByPlayerIndex(0); // Alice
        if (!hostClient) throw new Error('Host client not found');

        state = await harness.gameActionWithSync(hostClient, 'nextEndGameStep');
        expect(state.endGameSequence?.currentStep).toBe(1); // Interest step
    });
});
