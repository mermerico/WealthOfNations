import { randomUUID } from 'crypto';
import { applyGameAction, createInitialGameState, getDefaultPlayers } from '../../src/shared/gameEngine';
import type { ActionResult } from '../../src/utils/gameReducer';
import type { GameState, GameSettings, Player } from '../../src/types/gameState';
import type {
    LobbyCode,
    LobbyConfig,
    LobbyLifecycle,
    LobbyRecord,
    LobbySeat,
    LobbySnapshot,
    RestoringSeat
} from '../../src/shared/networkTypes';
import { saveGame as saveGameToFile, loadSave, hasSave } from './saveManager';

interface LobbyLookup {
    lobby: LobbyRecord;
    seat: LobbySeat;
}

const DEFAULT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function clonePlayer(player: Player): Player {
    return {
        ...player,
        resources: { ...player.resources }
    };
}

function orderSeats(players: LobbySeat[]): LobbySeat[] {
    return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

export class LobbyManager {
    private readonly config: LobbyConfig;
    private readonly lobbies = new Map<LobbyCode, LobbyRecord>();
    private readonly clientToLobby = new Map<string, LobbyCode>();
    private readonly clientToSeat = new Map<string, LobbySeat>();
    private readonly alphabet: string;

    constructor(config: LobbyConfig, alphabet: string = DEFAULT_CODE_ALPHABET) {
        this.config = config;
        this.alphabet = alphabet;
    }

    createLobby(clientId: string, name: string): LobbyLifecycle {
        const existingLobby = this.clientToLobby.get(clientId);
        if (existingLobby) {
            this.leaveLobby(clientId);
        }

        const code = this.generateUniqueCode();
        const defaultPlayers = getDefaultPlayers().slice(0, this.config.maxSeats);

        const seats: LobbySeat[] = [
            {
                clientId,
                playerId: defaultPlayers[0].id,
                seatIndex: 0,
                name: name.trim() || defaultPlayers[0].name,
                ready: false,
                connected: true,
                socketId: randomUUID()
            }
        ];

        const lobby: LobbyRecord = {
            code,
            phase: 'forming',
            hostClientId: clientId,
            players: seats,
            state: null,
            settings: { promissoryNoteInterestFees: false }
        };

        this.lobbies.set(code, lobby);
        this.clientToLobby.set(clientId, code);
        this.clientToSeat.set(clientId, seats[0]);

        return { lobby, players: defaultPlayers.map(clonePlayer) };
    }

    joinLobby(clientId: string, code: LobbyCode, name: string): LobbyLifecycle {
        const lobby = this.requireLobby(code);

        const existingLobbyCode = this.clientToLobby.get(clientId);
        if (existingLobbyCode && existingLobbyCode !== code) {
            this.leaveLobby(clientId);
        }

        const defaultPlayers = getDefaultPlayers().slice(0, this.config.maxSeats);

        // Rejoin existing seat if present
        const existingSeat = lobby.players.find(seat => seat.clientId === clientId);
        if (existingSeat) {
            existingSeat.connected = true;
            existingSeat.socketId = randomUUID();
            existingSeat.name = name.trim() || existingSeat.name;
            this.clientToLobby.set(clientId, lobby.code);
            this.clientToSeat.set(clientId, existingSeat);
            return { lobby, players: defaultPlayers.map(clonePlayer) };
        }

        if (lobby.phase === 'inGame') {
            throw new Error('Game already in progress');
        }

        if (lobby.players.length >= this.config.maxSeats) {
            throw new Error('Lobby is full');
        }

        const nextSeatIndex = this.nextSeatIndex(lobby);
        const template = defaultPlayers[nextSeatIndex];

        const seat: LobbySeat = {
            clientId,
            playerId: template.id,
            seatIndex: nextSeatIndex,
            name: name.trim() || template.name,
            ready: false,
            connected: true,
            socketId: randomUUID()
        };

        lobby.players.push(seat);
        this.clientToLobby.set(clientId, lobby.code);
        this.clientToSeat.set(clientId, seat);

        return { lobby, players: defaultPlayers.map(clonePlayer) };
    }

    /**
     * Result of leaving a lobby.
     */
    leaveLobby(clientId: string): { disbanded: boolean; reason?: string; lobbyCode?: string; remainingPlayers?: LobbySeat[] } {
        const lookup = this.lookupByClient(clientId);
        if (!lookup) return { disbanded: false };

        const { lobby, seat } = lookup;
        const lobbyCode = lobby.code;
        const wasInGame = lobby.phase === 'inGame';
        const leavingPlayerName = seat.name;

        lobby.players = lobby.players.filter(p => p !== seat);
        this.clientToLobby.delete(clientId);
        this.clientToSeat.delete(clientId);

        // If lobby is now empty, delete it
        if (lobby.players.length === 0) {
            this.lobbies.delete(lobby.code);
            return { disbanded: true, reason: 'All players left', lobbyCode };
        }

        // If game was in progress, disband the lobby and kick everyone
        if (wasInGame) {
            const remainingPlayers = [...lobby.players];
            // Remove all remaining players
            for (const player of remainingPlayers) {
                this.clientToLobby.delete(player.clientId);
                this.clientToSeat.delete(player.clientId);
            }
            this.lobbies.delete(lobby.code);
            return {
                disbanded: true,
                reason: `${leavingPlayerName} left the game`,
                lobbyCode,
                remainingPlayers
            };
        }

        // For forming/restoring phase, just update host if needed
        if (lobby.hostClientId === clientId) {
            const nextHost = orderSeats(lobby.players)[0];
            lobby.hostClientId = nextHost.clientId;
        }

        return { disbanded: false, lobbyCode };
    }

    renamePlayer(clientId: string, name: string): LobbyRecord {
        const { lobby, seat } = this.requireLookup(clientId);
        if (lobby.phase !== 'forming') {
            throw new Error('Cannot rename during a game');
        }
        const trimmed = name.trim();
        if (!trimmed) {
            throw new Error('Name cannot be empty');
        }

        seat.name = trimmed;
        return lobby;
    }

    setReady(clientId: string, ready: boolean): LobbyRecord {
        const { lobby, seat } = this.requireLookup(clientId);
        if (lobby.phase !== 'forming') {
            throw new Error('Cannot change ready state during a game');
        }

        seat.ready = ready;
        return lobby;
    }

    markConnection(clientId: string, connected: boolean, socketId?: string): LobbyRecord | null {
        const lookup = this.lookupByClient(clientId);
        if (!lookup) return null;
        const { lobby, seat } = lookup;
        seat.connected = connected;
        if (connected && socketId) {
            seat.socketId = socketId;
        }
        return lobby;
    }

    updateSettings(clientId: string, settings: Partial<GameSettings>): LobbyRecord {
        const { lobby } = this.requireLookup(clientId);
        if (lobby.hostClientId !== clientId) {
            throw new Error('Only the host can change settings');
        }
        if (lobby.phase !== 'forming') {
            throw new Error('Cannot change settings during a game');
        }

        lobby.settings = {
            ...lobby.settings,
            promissoryNoteInterestFees: lobby.settings?.promissoryNoteInterestFees ?? false,
            ...settings
        };
        return lobby;
    }

    startGame(clientId: string): GameState {
        const { lobby } = this.requireLookup(clientId);
        if (lobby.hostClientId !== clientId) {
            throw new Error('Only the host can start the game');
        }
        if (lobby.phase === 'inGame') {
            throw new Error('Game already running');
        }

        const readyPlayers = lobby.players.filter(p => p.ready);
        if (readyPlayers.length < this.config.minSeats || readyPlayers.length > this.config.maxSeats) {
            throw new Error(`Need ${this.config.minSeats}-${this.config.maxSeats} ready players to start`);
        }

        const defaultPlayers = getDefaultPlayers().slice(0, readyPlayers.length);
        const orderedSeats = orderSeats(readyPlayers);

        const customPlayers = orderedSeats.map((seat, index) => {
            const template = defaultPlayers[index];
            const player = clonePlayer(template);
            player.name = seat.name;
            return player;
        });

        const state = createInitialGameState({ players: customPlayers, settings: lobby.settings });

        lobby.state = state;
        lobby.phase = 'inGame';
        lobby.players.forEach(player => {
            player.ready = false;
        });

        return state;
    }

    rematch(clientId: string): LobbyRecord {
        const { lobby } = this.requireLookup(clientId);
        if (lobby.phase !== 'inGame') {
            throw new Error('No active game to reset');
        }

        lobby.phase = 'forming';
        lobby.state = null;
        lobby.players.forEach(player => {
            player.ready = false;
        });
        return lobby;
    }

    applyAction(clientId: string, action: string, payload: unknown): ActionResult {
        const { lobby, seat } = this.requireLookup(clientId);
        if (lobby.phase !== 'inGame' || !lobby.state) {
            return { success: false, message: 'No active game' } as ActionResult;
        }

        if (!this.isActionAllowed(lobby.state, seat, action, payload)) {
            return { success: false, message: 'Action not permitted for this player' } as ActionResult;
        }

        const result = applyGameAction(lobby.state, action, payload);
        if (result.success && result.newState) {
            lobby.state = result.newState;
        }
        return result;
    }

    getLobbySnapshot(code: LobbyCode): LobbySnapshot {
        const lobby = this.requireLobby(code);
        const snapshot: LobbySnapshot = {
            code: lobby.code,
            phase: lobby.phase,
            hostClientId: lobby.hostClientId,
            players: orderSeats(lobby.players).map(player => ({
                clientId: player.clientId,
                playerId: player.playerId,
                seatIndex: player.seatIndex,
                name: player.name,
                ready: player.ready,
                isHost: player.clientId === lobby.hostClientId,
                connected: player.connected
            })),
            minSeats: this.config.minSeats,
            maxSeats: this.config.maxSeats,
            settings: lobby.settings
        };

        // Add restoring info if in restoring phase
        if (lobby.phase === 'restoring' && lobby.restoringSeats && lobby.state) {
            snapshot.restoringSeats = lobby.restoringSeats;
            snapshot.savedRound = lobby.state.round;
            snapshot.savedPhase = lobby.state.phase;
        }

        return snapshot;
    }

    getSeatForClient(clientId: string): LobbySeat | undefined {
        return this.clientToSeat.get(clientId);
    }

    getLobbyCodeForClient(clientId: string): LobbyCode | undefined {
        return this.clientToLobby.get(clientId);
    }

    getLobbyState(code: LobbyCode): GameState | null {
        const lobby = this.requireLobby(code);
        return lobby.state;
    }

    hasLobby(code: LobbyCode): boolean {
        return this.lobbies.has(code);
    }

    getLobbyPhase(code: LobbyCode): 'forming' | 'restoring' | 'inGame' | null {
        const lobby = this.lobbies.get(code);
        return lobby ? lobby.phase : null;
    }

    /**
     * Check if a client is part of a specific lobby.
     */
    isClientInLobby(clientId: string, code: LobbyCode): boolean {
        const lobbyCode = this.clientToLobby.get(clientId);
        return lobbyCode === code;
    }

    /**
     * Saves the current game to a file. Only the host can save.
     */
    async saveGame(clientId: string): Promise<string> {
        const { lobby } = this.requireLookup(clientId);
        if (lobby.hostClientId !== clientId) {
            throw new Error('Only the host can save the game');
        }
        if (lobby.phase !== 'inGame' || !lobby.state) {
            throw new Error('No active game to save');
        }

        await saveGameToFile(lobby.code, lobby.state);
        return lobby.code;
    }

    /**
     * Check if a save file exists for a lobby code.
     */
    async checkSaveExists(code: LobbyCode): Promise<boolean> {
        return await hasSave(code);
    }

    /**
     * Creates a restoring lobby from a saved game.
     * The first client to join becomes the host.
     */
    async restoreFromSave(clientId: string, code: LobbyCode, name: string): Promise<LobbyLifecycle> {
        // Check if there's already an active lobby with this code
        if (this.lobbies.has(code)) {
            throw new Error('A lobby with this code is already active');
        }

        const savedGame = await loadSave(code);
        if (!savedGame) {
            throw new Error('No saved game found for this code');
        }

        const { gameState } = savedGame;
        const defaultPlayers = getDefaultPlayers().slice(0, this.config.maxSeats);

        // Count industries for each player
        const industryCounts = new Map<string, number>();
        for (const cell of Object.values(gameState.board)) {
            if (cell.occupant?.type === 'Industry' && cell.occupant.playerId) {
                const current = industryCounts.get(cell.occupant.playerId) || 0;
                industryCounts.set(cell.occupant.playerId, current + 1);
            }
        }

        // Create restoring seats from saved players
        const restoringSeats: RestoringSeat[] = gameState.players.map((player, index) => ({
            seatIndex: index,
            savedName: player.name,
            savedMoney: player.money,
            savedIndustryCount: industryCounts.get(player.id) || 0,
            claimedByClientId: null
        }));

        // Create lobby seat for the first joiner (becomes host)
        const seat: LobbySeat = {
            clientId,
            playerId: defaultPlayers[0].id,
            seatIndex: -1, // Not assigned yet
            name: name.trim() || 'Player',
            ready: false,
            connected: true,
            socketId: randomUUID()
        };

        const lobby: LobbyRecord = {
            code,
            phase: 'restoring',
            hostClientId: clientId,
            players: [seat],
            state: gameState,
            restoringSeats
        };

        this.lobbies.set(code, lobby);
        this.clientToLobby.set(clientId, code);
        this.clientToSeat.set(clientId, seat);

        return { lobby, players: defaultPlayers.map(clonePlayer) };
    }

    /**
     * Join a restoring lobby (saved game restoration).
     */
    joinRestoringLobby(clientId: string, code: LobbyCode, name: string): LobbyLifecycle {
        const lobby = this.requireLobby(code);
        if (lobby.phase !== 'restoring') {
            throw new Error('Lobby is not in restoring state');
        }

        const defaultPlayers = getDefaultPlayers().slice(0, this.config.maxSeats);

        // Check if already in this lobby
        const existingSeat = lobby.players.find(s => s.clientId === clientId);
        if (existingSeat) {
            existingSeat.connected = true;
            existingSeat.socketId = randomUUID();
            this.clientToLobby.set(clientId, code);
            this.clientToSeat.set(clientId, existingSeat);
            return { lobby, players: defaultPlayers.map(clonePlayer) };
        }

        // Create new seat for joiner
        const seat: LobbySeat = {
            clientId,
            playerId: '',
            seatIndex: -1,
            name: name.trim() || 'Player',
            ready: false,
            connected: true,
            socketId: randomUUID()
        };

        lobby.players.push(seat);
        this.clientToLobby.set(clientId, code);
        this.clientToSeat.set(clientId, seat);

        return { lobby, players: defaultPlayers.map(clonePlayer) };
    }

    /**
     * Claim a seat in a restoring lobby.
     */
    claimSeat(clientId: string, seatIndex: number): LobbyRecord {
        const { lobby, seat } = this.requireLookup(clientId);
        if (lobby.phase !== 'restoring') {
            throw new Error('Can only claim seats during restoration');
        }
        if (!lobby.restoringSeats) {
            throw new Error('No restoring seats available');
        }

        const restoringSeat = lobby.restoringSeats.find(s => s.seatIndex === seatIndex);
        if (!restoringSeat) {
            throw new Error('Invalid seat index');
        }
        if (restoringSeat.claimedByClientId && restoringSeat.claimedByClientId !== clientId) {
            throw new Error('This seat has already been claimed');
        }

        // Unclaim any previously claimed seat
        const previouslyClaimed = lobby.restoringSeats.find(s => s.claimedByClientId === clientId);
        if (previouslyClaimed) {
            previouslyClaimed.claimedByClientId = null;
        }

        // Claim the new seat
        restoringSeat.claimedByClientId = clientId;
        seat.seatIndex = seatIndex;
        seat.name = restoringSeat.savedName;

        // Check if all seats are claimed and start game
        this.checkAndStartRestoredGame(lobby);

        return lobby;
    }

    /**
     * Unclaim a seat in a restoring lobby.
     */
    unclaimSeat(clientId: string): LobbyRecord {
        const { lobby, seat } = this.requireLookup(clientId);
        if (lobby.phase !== 'restoring') {
            throw new Error('Can only unclaim seats during restoration');
        }
        if (!lobby.restoringSeats) {
            throw new Error('No restoring seats available');
        }

        const claimedSeat = lobby.restoringSeats.find(s => s.claimedByClientId === clientId);
        if (claimedSeat) {
            claimedSeat.claimedByClientId = null;
            seat.seatIndex = -1;
        }

        return lobby;
    }

    /**
     * Check if all seats are claimed and transition to inGame.
     */
    private checkAndStartRestoredGame(lobby: LobbyRecord): void {
        if (!lobby.restoringSeats || !lobby.state) return;

        const allClaimed = lobby.restoringSeats.every(s => s.claimedByClientId !== null);
        if (!allClaimed) return;

        // Map clients to player IDs based on claimed seats
        for (const restoringSeat of lobby.restoringSeats) {
            const clientSeat = lobby.players.find(p => p.clientId === restoringSeat.claimedByClientId);
            if (clientSeat) {
                const savedPlayer = lobby.state.players[restoringSeat.seatIndex];
                clientSeat.playerId = savedPlayer.id;
                clientSeat.seatIndex = restoringSeat.seatIndex;
                clientSeat.name = savedPlayer.name;
            }
        }

        // Transition to inGame
        lobby.phase = 'inGame';
        delete lobby.restoringSeats;
    }

    private lookupByClient(clientId: string): LobbyLookup | null {
        const lobbyCode = this.clientToLobby.get(clientId);
        if (!lobbyCode) return null;
        const lobby = this.lobbies.get(lobbyCode);
        const seat = this.clientToSeat.get(clientId);
        if (!lobby || !seat) return null;
        return { lobby, seat };
    }

    private requireLookup(clientId: string): LobbyLookup {
        const lookup = this.lookupByClient(clientId);
        if (!lookup) {
            throw new Error('Client is not part of a lobby');
        }
        return lookup;
    }

    private requireLobby(code: LobbyCode): LobbyRecord {
        const lobby = this.lobbies.get(code);
        if (!lobby) {
            throw new Error('Lobby not found');
        }
        return lobby;
    }

    private nextSeatIndex(lobby: LobbyRecord): number {
        const used = new Set(lobby.players.map(seat => seat.seatIndex));
        for (let i = 0; i < this.config.maxSeats; i++) {
            if (!used.has(i)) {
                return i;
            }
        }
        throw new Error('No seat available');
    }

    private generateUniqueCode(): LobbyCode {
        let attempt = '';
        do {
            attempt = this.generateCode();
        } while (this.lobbies.has(attempt));
        return attempt;
    }

    private generateCode(): LobbyCode {
        let result = '';
        for (let i = 0; i < this.config.codeLength; i++) {
            const index = Math.floor(Math.random() * this.alphabet.length);
            result += this.alphabet[index];
        }
        return result;
    }

    private isActionAllowed(state: GameState, seat: LobbySeat, action: string, payload: unknown): boolean {
        // In Setup phase, use the currentDrafterIndex
        let activePlayerIndex: number;
        if (state.phase === 'Setup' && state.setupPhase) {
            activePlayerIndex = state.setupPhase.currentDrafterIndex;
        } else {
            activePlayerIndex = state.currentTurnPlayerIndex;
        }

        const activePlayerId = state.players[activePlayerIndex]?.id;
        if (!activePlayerId) return false;

        if (action === 'barter' || action === 'proposeTrade') {
            if (!payload || typeof payload !== 'object') return false;
            const proposerId = (payload as { proposerId?: string }).proposerId;
            return proposerId === seat.playerId;
        }

        if (action === 'acceptTrade' || action === 'rejectTrade') {
            if (!state.pendingTrade) return false;
            return state.pendingTrade.targetId === seat.playerId;
        }

        if (state.phase === 'Produce') {
            if (action === 'confirmProduction') {
                return (payload as { playerId?: string })?.playerId === seat.playerId;
            }
        }

        if (action === 'loadState' || action === 'debug' || action === 'sandboxPlaceTile') {
            return false;
        }

        return activePlayerId === seat.playerId;
    }
}

export const lobbyManager = new LobbyManager({ minSeats: 3, maxSeats: 6, codeLength: 5 });
