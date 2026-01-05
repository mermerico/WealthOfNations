import { randomUUID } from 'crypto';
import { applyGameAction, createInitialGameState, getDefaultPlayers } from '../../src/shared/gameEngine';
import type { ActionResult } from '../../src/utils/gameReducer';
import type { GameState, Player } from '../../src/types/gameState';
import type {
    LobbyCode,
    LobbyConfig,
    LobbyLifecycle,
    LobbyRecord,
    LobbySeat,
    LobbySnapshot
} from '../../src/shared/networkTypes';

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
        const defaultPlayers = getDefaultPlayers().slice(0, this.config.requiredSeats);

        if (defaultPlayers.length < this.config.requiredSeats) {
            throw new Error('Insufficient default player templates');
        }

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
            state: null
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

        const defaultPlayers = getDefaultPlayers().slice(0, this.config.requiredSeats);

        if (defaultPlayers.length < this.config.requiredSeats) {
            throw new Error('Insufficient default player templates');
        }

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

        if (lobby.players.length >= this.config.requiredSeats) {
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

    leaveLobby(clientId: string): void {
        const lookup = this.lookupByClient(clientId);
        if (!lookup) return;

        const { lobby, seat } = lookup;

        lobby.players = lobby.players.filter(p => p !== seat);
        this.clientToLobby.delete(clientId);
        this.clientToSeat.delete(clientId);

        if (lobby.players.length === 0) {
            this.lobbies.delete(lobby.code);
            return;
        }

        if (lobby.hostClientId === clientId) {
            const nextHost = orderSeats(lobby.players)[0];
            lobby.hostClientId = nextHost.clientId;
        }

        if (lobby.phase === 'inGame') {
            lobby.phase = 'forming';
            lobby.state = null;
            lobby.players.forEach(player => {
                player.ready = false;
            });
        }
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

    startGame(clientId: string): GameState {
        const { lobby } = this.requireLookup(clientId);
        if (lobby.hostClientId !== clientId) {
            throw new Error('Only the host can start the game');
        }
        if (lobby.phase === 'inGame') {
            throw new Error('Game already running');
        }
        if (lobby.players.length !== this.config.requiredSeats) {
            throw new Error('Need exactly three players to start');
        }
        const allReady = lobby.players.every(player => player.ready);
        if (!allReady) {
            throw new Error('All players must be ready');
        }

        const defaultPlayers = getDefaultPlayers().slice(0, this.config.requiredSeats);
        const orderedSeats = orderSeats(lobby.players);

        const customPlayers = orderedSeats.map((seat, index) => {
            const template = defaultPlayers[index];
            const player = clonePlayer(template);
            player.name = seat.name;
            return player;
        });

        const state = createInitialGameState({ players: customPlayers });

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
        return {
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
            requiredSeats: this.config.requiredSeats
        };
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
        for (let i = 0; i < this.config.requiredSeats; i++) {
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

        if (action === 'barter') {
            if (!payload || typeof payload !== 'object') return false;
            const proposerId = (payload as { proposerId?: string }).proposerId;
            return proposerId === seat.playerId;
        }

        if (action === 'loadState' || action === 'debug' || action === 'sandboxPlaceTile') {
            return false;
        }

        return activePlayerId === seat.playerId;
    }
}

export const lobbyManager = new LobbyManager({ requiredSeats: 3, codeLength: 5 });
