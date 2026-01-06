import type { GameState } from '../types/gameState';

/**
 * Schema version for saved games. Increment when making breaking changes
 * to the save format that require migration logic.
 */
export const SAVE_VERSION = 1;

/**
 * Represents a saved game that can be persisted to disk and restored later.
 */
export interface SavedGame {
    version: number;
    savedAt: string;
    lobbyCode: string;
    gameState: GameState;
}

/**
 * Summary info about a save file (for listing without loading full state).
 */
export interface SaveFileInfo {
    filename: string;
    lobbyCode: string;
    savedAt: string;
    playerCount: number;
    round: number;
    phase: string;
}
