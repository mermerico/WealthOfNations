import { WsTestClient } from './wsTestClient';
import type { GameState } from '../../types/gameState';

/**
 * Multi-client test harness that manages state synchronization across all connected clients.
 * 
 * The key insight: when ANY client performs a game action, the server broadcasts
 * the new state to ALL clients. This harness ensures all clients consume those
 * broadcasts so their message queues stay synchronized.
 */
export class MultiClientTestHarness {
    private clients: WsTestClient[] = [];
    private clientPlayerIndexMap: Map<WsTestClient, number> = new Map();
    private latestState: GameState | null = null;

    /**
     * Set up a game with the specified number of players.
     * Creates clients, forms lobby, and starts the game.
     */
    async setupGame(port: number, playerCount: number = 3): Promise<GameState> {
        if (playerCount < 3 || playerCount > 6) {
            throw new Error('Game requires 3-6 players');
        }

        // Create clients with unique IDs
        const timestamp = Date.now();
        for (let i = 0; i < playerCount; i++) {
            const client = new WsTestClient(`player-${i}-${timestamp}`);
            await client.connect(port);
            this.clients.push(client);
        }

        const host = this.clients[0];
        const lobbyCode = await host.createLobby('Host');

        // Other players join - they each get a session and lobbyUpdate
        for (let i = 1; i < this.clients.length; i++) {
            await this.clients[i].joinLobby(lobbyCode, `Player${i + 1}`);
        }

        // Small delay to let any pending broadcasts arrive
        await this.delay(200);

        // Clear all lobby updates that accumulated
        for (const client of this.clients) {
            client.consumeAll('lobbyUpdate');
        }

        // All players set ready - each triggers a lobbyUpdate to all clients
        for (let i = 0; i < this.clients.length; i++) {
            const client = this.clients[i];
            await client.setReady(true);
            // Clear broadcasts from all clients after each ready
            await this.delay(100);
            for (const c of this.clients) {
                c.consumeAll('lobbyUpdate');
            }
        }

        // Host starts the game - this triggers lobbyUpdate AND state broadcast to all
        host.send({ type: 'startGame', clientId: host.clientId });

        // Small delay to let messages arrive
        await this.delay(300);

        // Consume any lobbyUpdate messages from all clients
        for (const client of this.clients) {
            client.consumeAll('lobbyUpdate');
        }

        // Now wait for state from each client
        console.log('[MultiClientTestHarness] Waiting for state from all clients...');
        const statePromises = this.clients.map(async (client, index) => {
            try {
                console.log(`[MultiClientTestHarness] Client ${index} waiting for state...`);
                const result = await client.waitForState(8000);
                console.log(`[MultiClientTestHarness] Client ${index} received state!`);
                return result;
            } catch (e) {
                console.log(`[MultiClientTestHarness] Client ${index} TIMEOUT!`);
                throw new Error(`Client ${index} failed to receive state: ${e}`);
            }
        });

        const results = await Promise.all(statePromises);
        this.latestState = results[0].state;

        // Build the client-to-player-index mapping based on player order
        // The order players joined determines their index in state.players
        for (let i = 0; i < this.clients.length; i++) {
            this.clientPlayerIndexMap.set(this.clients[i], i);
        }

        return this.latestState;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Load a specific game state fixture directly.
     * Bypasses normal setup and phase progression.
     */
    async loadStateFixture(port: number, fixtureState: GameState): Promise<GameState> {
        // Ensure clients exist and are connected
        const playerCount = fixtureState.players.length;
        if (this.clients.length === 0) {
            // If no clients, perform basic setup to get connections
            await this.setupGame(port, playerCount);
        }

        // Send loadState debug action via host
        const host = this.clients[0];
        console.log('[Harness] Loading state fixture...');

        // Use gameActionWithSync to broadcast the new state to all clients
        this.latestState = await this.gameActionWithSync(host, 'loadState', fixtureState);

        // Re-build player mapping in case structure changed (simplification: assume 1:1 map)
        this.clientPlayerIndexMap.clear();
        for (let i = 0; i < this.clients.length; i++) {
            this.clientPlayerIndexMap.set(this.clients[i], i);
        }

        return this.latestState;
    }

    /**
     * Get the latest synchronized game state.
     */
    getLatestState(): GameState {
        if (!this.latestState) {
            throw new Error('No game state available. Has the game started?');
        }
        return this.latestState;
    }

    /**
     * Get the client that should act for the current turn.
     * Handles both Setup phase (currentDrafterIndex) and other phases (currentTurnPlayerIndex).
     */
    getActiveClient(state: GameState): WsTestClient {
        let activeIndex: number;
        if (state.phase === 'Setup' && state.setupPhase) {
            activeIndex = state.setupPhase.currentDrafterIndex;
            console.log(`[Harness] Setup phase, drafter index: ${activeIndex}`);
        } else {
            activeIndex = state.currentTurnPlayerIndex;
            console.log(`[Harness] ${state.phase} phase, turn index: ${activeIndex}`);
        }

        for (const [client, playerIndex] of this.clientPlayerIndexMap) {
            if (playerIndex === activeIndex) {
                const clientIndex = this.clients.indexOf(client);
                console.log(`[Harness] Active client: ${clientIndex} (maps to player ${playerIndex})`);
                return client;
            }
        }
        throw new Error(`No client found for player index ${activeIndex}`);
    }

    /**
     * Perform a game action and synchronize state across all clients.
     * Returns the new game state.
     */
    async gameActionWithSync(
        client: WsTestClient,
        action: string,
        payload?: unknown,
        timeoutMs: number = 5000
    ): Promise<GameState> {
        const clientIndex = this.clients.indexOf(client);
        console.log(`[Harness] Client ${clientIndex} sending action: ${action}`);

        // Send the action
        client.send({
            type: 'gameAction',
            clientId: client.clientId,
            action,
            payload
        });

        // Sync all clients - each should receive the state broadcast
        // The active client might also receive an error if the action is invalid
        console.log(`[Harness] Syncing all clients after ${action}...`);
        this.latestState = await this.syncAllWithActive(client, action, timeoutMs);
        console.log(`[Harness] Sync complete, phase: ${this.latestState.phase}`);
        return this.latestState;
    }

    /**
     * Consume state broadcasts from all clients.
     * Returns the state (should be identical across all clients).
     */
    async syncAllClients(timeoutMs: number = 5000): Promise<GameState> {
        return this.syncAllWithActive(null, 'unknown', timeoutMs);
    }

    async syncAllWithActive(activeClient: WsTestClient | null, action: string, timeoutMs: number = 5000): Promise<GameState> {
        const statePromises = this.clients.map(async (client, index) => {
            try {
                if (client === activeClient) {
                    // Active client might get an error instead of state
                    const msg = await client.waitFor((m) => m.type === 'state' || m.type === 'error', timeoutMs);
                    if (msg.type === 'error') {
                        throw new Error(`Server rejected action "${action}": ${msg.message}`);
                    }
                    console.log(`[Harness] Client ${index} (active) synced`);
                    return msg.state;
                } else {
                    const result = await client.waitForState(timeoutMs);
                    console.log(`[Harness] Client ${index} synced`);
                    return result.state;
                }
            } catch (e) {
                console.log(`[Harness] Client ${index} sync TIMEOUT or ERROR: ${e instanceof Error ? e.message : String(e)}`);
                throw e;
            }
        });

        const results = await Promise.all(statePromises);

        // All states should be identical - return the first one
        this.latestState = results[0];
        return this.latestState;
    }

    /**
     * Progress through setup phase by selecting packages and placing tiles.
     * Returns when Trade phase is reached.
     * 
     * Uses hard-coded coordinates from E2E tests, and getValidSetupPlacements
     * to find a valid orientation for each.
     */
    private async progressThroughSetup(maxActions: number = 100): Promise<GameState> {
        if (!this.latestState) throw new Error('No state');

        const { getValidSetupPlacements } = await import('../../utils/setupPlacementLogic');

        // Valid tile placements (same as E2E tests - proven to work!)
        const validCoordinates = [
            '1,0', '0,1', '1,-1',       // Package 1 (Farm)
            '-1,1', '-2,1', '-2,2',     // Package 2 (Farm)
            '1,-2', '0,-1',             // Package 3 (Generator)
            '0,-2', '-1,-1',            // Package 4 (Academy)
            '-3,1', '-3,2',             // Package 5 (Mine)
            '2,0', '0,2',               // Package 6 (Factory)
        ];
        let actionCount = 0;

        while (this.latestState.phase === 'Setup' && actionCount < maxActions) {
            const state = this.latestState;
            const activeClient = this.getActiveClient(state);

            if (state.setupPhase?.step === 'selectPackage') {
                // Select packages, preferring INDUSTRY packages (not commodity) to match E2E test behavior
                const { getAvailablePackages, INDUSTRY_PACKAGES } = await import('../../utils/packageDefinitions');
                const available = getAvailablePackages(
                    state.players.length,
                    state.setupPhase.takenPackageIds
                );
                if (available.length > 0) {
                    // Prefer industry packages (I1-I6) to match E2E test's predefined coordinates
                    const industryPackage = available.find(pkg => INDUSTRY_PACKAGES.some(ip => ip.id === pkg.id));
                    const pkg = industryPackage || available[0];
                    await this.gameActionWithSync(activeClient, 'selectPackage', { packageId: pkg.id });
                    actionCount++;
                } else {
                    throw new Error('No packages available');
                }
            } else if (state.setupPhase?.step === 'placeTile' && state.setupPhase.pendingPlacement) {
                const { tilesRemaining, placementHistory } = state.setupPhase.pendingPlacement;

                console.log(`[Setup] Player ${state.setupPhase.currentDrafterIndex} placing tiles:`);
                console.log(`  Tiles remaining: ${tilesRemaining.join(', ')}`);
                console.log(`  Already placed at: ${placementHistory.join(', ')}`);

                if (tilesRemaining.length > 0) {
                    const tileType = tilesRemaining[0] as import('../../types/gameState').IndustryType;
                    const currentPlayerId = state.players[state.setupPhase.currentDrafterIndex].id;

                    // Get list of ALL tiles already placed by this player (including previous draft turns)
                    const playerTileCells = Object.entries(state.board)
                        .filter(([_, cell]) => cell.occupant?.type === 'Industry' && cell.occupant.playerId === currentPlayerId)
                        .map(([id]) => id);

                    console.log(`[Setup] Player ${state.setupPhase.currentDrafterIndex} total tiles: ${playerTileCells.length}`);

                    // Get all valid placements with their orientations
                    const allValidPlacements = getValidSetupPlacements(
                        state.board,
                        tileType,
                        playerTileCells,
                        currentPlayerId
                    );

                    // Find first hard-coded coordinate that has valid orientations
                    let placed = false;
                    for (const cellId of validCoordinates) {
                        const orientations = allValidPlacements[cellId];
                        if (orientations && orientations.length > 0) {
                            const orientation = orientations[0];
                            console.log(`[Setup] Placing ${tileType} at ${cellId} with orientation ${orientation}`);
                            await this.gameActionWithSync(activeClient, 'placeSetupTile', {
                                cellId,
                                tileType,
                                orientation
                            });
                            actionCount++;
                            placed = true;
                            console.log(`[Setup] ✓ Successfully placed ${tileType} at ${cellId}`);
                            break;
                        }
                    }

                    if (!placed) {
                        console.log(`[Setup] ERROR: No valid placement found for ${tileType}!`);
                        console.log(`  Placement history: ${placementHistory.join(', ')}`);
                        console.log(`  All valid placements: ${Object.keys(allValidPlacements).join(', ')}`);
                        throw new Error(`No valid placement found for ${tileType}`);
                    }
                } else {
                    // All tiles placed, pass to continue
                    console.log(`[Setup] All tiles placed for player ${state.setupPhase.currentDrafterIndex}, passing...`);
                    await this.gameActionWithSync(activeClient, 'pass');
                    actionCount++;
                }
            } else {
                throw new Error(`Unknown setup step: ${state.setupPhase?.step}`);
            }

            // Safety check
            if (actionCount >= maxActions) {
                throw new Error(`Setup phase did not complete after ${maxActions} actions`);
            }
        }

        if (this.latestState.phase !== 'Trade') {
            throw new Error(`Setup did not reach Trade phase, stuck in ${this.latestState.phase}`);
        }

        return this.latestState;
    }


    /**
     * Progress to target phase. Handles Setup phase specially, otherwise passes turns.
     */
    async progressToPhase(targetPhase: string, maxPasses: number = 50): Promise<GameState> {
        if (!this.latestState) {
            throw new Error('No game state - call setupGame first');
        }

        // If currently in Setup and target is Trade or later, progress through setup
        if (this.latestState.phase === 'Setup') {
            await this.progressThroughSetup();
        }

        // If still not at target phase, pass turns
        let state = this.latestState;
        let passes = 0;

        while (state.phase !== targetPhase && passes < maxPasses) {
            const activeClient = this.getActiveClient(state);
            state = await this.gameActionWithSync(activeClient, 'pass');
            passes++;
        }

        if (state.phase !== targetPhase) {
            throw new Error(`Failed to reach ${targetPhase} after ${maxPasses} passes`);
        }

        return state;
    }

    /**
     * Get current known state.
     */
    getState(): GameState | null {
        return this.latestState;
    }

    /**
     * Get all clients.
     */
    getClients(): WsTestClient[] {
        return [...this.clients];
    }

    /**
     * Get client at specific player index.
     */
    getClientByPlayerIndex(index: number): WsTestClient | undefined {
        for (const [client, playerIndex] of this.clientPlayerIndexMap) {
            if (playerIndex === index) {
                return client;
            }
        }
        return undefined;
    }


    /**
     * Close all client connections.
     */
    close(): void {
        for (const client of this.clients) {
            client.close();
        }
        this.clients = [];
        this.clientPlayerIndexMap.clear();
        this.latestState = null;
    }
}
