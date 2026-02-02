import { Redis } from '@upstash/redis';
import type { GameState } from '../../src/types/gameState';
import type { SavedGame, SaveFileInfo } from '../../src/shared/saveTypes';
import { SAVE_VERSION } from '../../src/shared/saveTypes';

// Initialize Redis client from environment variables
// Upstash provides UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
});

const SAVE_KEY_PREFIX = 'won:save:';
const SAVE_INDEX_KEY = 'won:saves';

function getSaveKey(lobbyCode: string): string {
    return `${SAVE_KEY_PREFIX}${lobbyCode.toUpperCase()}`;
}

/**
 * Counts industries owned by each player on the board.
 */
function countIndustries(state: GameState): Map<string, number> {
    const counts = new Map<string, number>();
    for (const cell of Object.values(state.board)) {
        if (cell.occupant?.type === 'Industry' && cell.occupant.playerId) {
            const current = counts.get(cell.occupant.playerId) || 0;
            counts.set(cell.occupant.playerId, current + 1);
        }
    }
    return counts;
}

/**
 * Saves the current game state to Redis.
 * Overwrites any existing save for the same lobby code.
 */
export async function saveGame(lobbyCode: string, state: GameState): Promise<string> {
    const normalizedCode = lobbyCode.toUpperCase();

    const savedGame: SavedGame = {
        version: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        lobbyCode: normalizedCode,
        gameState: state
    };

    const key = getSaveKey(normalizedCode);

    // Store the save and add to index
    await redis.set(key, JSON.stringify(savedGame));
    await redis.sadd(SAVE_INDEX_KEY, normalizedCode);

    console.log(`[SaveManager] Saved game ${normalizedCode} to Redis`);
    return normalizedCode;
}

/**
 * Loads a saved game from Redis.
 * Returns null if the save doesn't exist.
 */
export async function loadSave(lobbyCode: string): Promise<SavedGame | null> {
    const key = getSaveKey(lobbyCode);

    try {
        const data = await redis.get<string>(key);
        if (!data) {
            return null;
        }

        // Upstash may return parsed object or string depending on how it was stored
        const savedGame: SavedGame = typeof data === 'string' ? JSON.parse(data) : data;

        // Basic validation
        if (!savedGame.version || !savedGame.gameState || !savedGame.lobbyCode) {
            console.error(`[SaveManager] Invalid save format for ${lobbyCode}`);
            return null;
        }

        console.log(`[SaveManager] Loaded game ${lobbyCode} from Redis`);
        return savedGame;
    } catch (error) {
        console.error(`[SaveManager] Error loading ${lobbyCode}:`, error);
        return null;
    }
}

/**
 * Checks if a save exists for the given lobby code.
 */
export async function hasSave(lobbyCode: string): Promise<boolean> {
    const key = getSaveKey(lobbyCode);
    const exists = await redis.exists(key);
    return exists === 1;
}

/**
 * Gets summary info about a save without loading the full state.
 */
export async function getSaveInfo(lobbyCode: string): Promise<SaveFileInfo | null> {
    const savedGame = await loadSave(lobbyCode);
    if (!savedGame) return null;

    const { gameState } = savedGame;

    return {
        filename: `${lobbyCode}.json`,
        lobbyCode: savedGame.lobbyCode,
        savedAt: savedGame.savedAt,
        playerCount: gameState.players.length,
        round: gameState.round,
        phase: gameState.phase
    };
}

/**
 * Deletes a save.
 */
export async function deleteSave(lobbyCode: string): Promise<boolean> {
    const normalizedCode = lobbyCode.toUpperCase();
    const key = getSaveKey(normalizedCode);

    const deleted = await redis.del(key);
    await redis.srem(SAVE_INDEX_KEY, normalizedCode);

    if (deleted > 0) {
        console.log(`[SaveManager] Deleted save ${normalizedCode}`);
        return true;
    }
    return false;
}

/**
 * Lists all available saves.
 */
export async function listSaves(): Promise<SaveFileInfo[]> {
    try {
        const codes = await redis.smembers(SAVE_INDEX_KEY);
        if (!codes || codes.length === 0) {
            return [];
        }

        const infos: SaveFileInfo[] = [];
        for (const code of codes) {
            const info = await getSaveInfo(code);
            if (info) {
                infos.push(info);
            }
        }

        // Sort by savedAt descending (newest first)
        infos.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        return infos;
    } catch (error) {
        console.error('[SaveManager] Error listing saves:', error);
        return [];
    }
}
