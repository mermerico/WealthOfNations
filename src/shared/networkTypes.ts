import type { GameState, GameSettings, Player } from '../types/gameState';

export type LobbyCode = string;

export interface LobbyPlayer {
    clientId: string;
    playerId: string;
    seatIndex: number;
    name: string;
    ready: boolean;
    isHost: boolean;
    connected: boolean;
}

export type LobbyPhase = 'forming' | 'restoring' | 'inGame';

export interface LobbySnapshot {
    code: LobbyCode;
    phase: LobbyPhase;
    hostClientId: string;
    players: LobbyPlayer[];
    minSeats: number;
    maxSeats: number;
    // Present when phase is 'restoring'
    restoringSeats?: RestoringSeat[];
    savedRound?: number;
    savedPhase?: string;
    settings?: GameSettings;
}

export interface CreateLobbyMessage {
    type: 'createLobby';
    clientId: string;
    name: string;
}

export interface JoinLobbyMessage {
    type: 'joinLobby';
    clientId: string;
    code: LobbyCode;
    name: string;
}

export interface LeaveLobbyMessage {
    type: 'leaveLobby';
    clientId: string;
}

export interface RenamePlayerMessage {
    type: 'renamePlayer';
    clientId: string;
    name: string;
}

export interface ReadyToggleMessage {
    type: 'setReady';
    clientId: string;
    ready: boolean;
}

export interface StartGameMessage {
    type: 'startGame';
    clientId: string;
}

export interface RematchMessage {
    type: 'rematch';
    clientId: string;
}

export interface GameActionMessage {
    type: 'gameAction';
    clientId: string;
    action: string;
    payload?: unknown;
}

export interface PingMessage {
    type: 'ping';
}

export interface SaveGameMessage {
    type: 'saveGame';
    clientId: string;
}

export interface ClaimSeatMessage {
    type: 'claimSeat';
    clientId: string;
    seatIndex: number;
}

export interface UnclaimSeatMessage {
    type: 'unclaimSeat';
    clientId: string;
}

export interface UpdateSettingsMessage {
    type: 'updateSettings';
    clientId: string;
    settings: Partial<GameSettings>;
}

export type ClientMessage =
    | CreateLobbyMessage
    | JoinLobbyMessage
    | LeaveLobbyMessage
    | RenamePlayerMessage
    | ReadyToggleMessage
    | StartGameMessage
    | RematchMessage
    | GameActionMessage
    | PingMessage
    | SaveGameMessage
    | ClaimSeatMessage
    | UnclaimSeatMessage
    | UpdateSettingsMessage;

export interface LobbyUpdateEnvelope {
    type: 'lobbyUpdate';
    lobby: LobbySnapshot;
    self?: LobbyPlayer;
}

export interface GameStateEnvelope {
    type: 'state';
    state: GameState;
}

export interface ErrorEnvelope {
    type: 'error';
    message: string;
}

export interface AckEnvelope {
    type: 'ack';
    message: string;
}

export interface SessionRestoreEnvelope {
    type: 'session';
    clientId: string;
    lobby?: LobbySnapshot;
    state?: GameState;
}

export interface GameSavedEnvelope {
    type: 'gameSaved';
    lobbyCode: string;
}

export interface LobbyDisbandedEnvelope {
    type: 'lobbyDisbanded';
    reason: string;
}

export type ServerMessage =
    | LobbyUpdateEnvelope
    | GameStateEnvelope
    | ErrorEnvelope
    | AckEnvelope
    | SessionRestoreEnvelope
    | GameSavedEnvelope
    | LobbyDisbandedEnvelope;

/**
 * Represents a seat being restored from a saved game.
 * Contains info about the saved player state for display during seat selection.
 */
export interface RestoringSeat {
    seatIndex: number;
    savedName: string;
    savedMoney: number;
    savedIndustryCount: number;
    claimedByClientId: string | null;
}

export interface LobbyRecord {
    code: LobbyCode;
    phase: LobbyPhase;
    hostClientId: string;
    players: LobbySeat[];
    state: GameState | null;
    restoringSeats?: RestoringSeat[];  // Present when phase is 'restoring'
    settings?: GameSettings;  // Game settings configured in lobby
}

export interface LobbySeat {
    clientId: string;
    playerId: string;
    socketId: string;
    name: string;
    ready: boolean;
    connected: boolean;
    seatIndex: number;
}

export interface LobbyConfig {
    minSeats: number;
    maxSeats: number;
    codeLength: number;
}

export interface LobbyLifecycle {
    lobby: LobbyRecord;
    players: Player[];
}
