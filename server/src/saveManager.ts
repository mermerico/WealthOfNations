import { promises as fs } from 'fs';
import path from 'path';
import type { GameState } from '../../src/types/gameState';
import type { SavedGame, SaveFileInfo } from '../../src/shared/saveTypes';
import { SAVE_VERSION } from '../../src/shared/saveTypes';

const SAVES_DIR = path.join(process.cwd(), 'saves');

/**
 * Ensures the saves directory exists.
 */
async function ensureSavesDir(): Promise<void> {
    try {
        await fs.mkdir(SAVES_DIR, { recursive: true });
    } catch (error) {
        // Directory already exists or other error
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Gets the file path for a save file based on lobby code.
 */
function getSavePath(lobbyCode: string): string {
    return path.join(SAVES_DIR, `${lobbyCode}.json`);
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
 * Saves the current game state to a file.
 * Overwrites any existing save for the same lobby code.
 */
export async function saveGame(lobbyCode: string, state: GameState): Promise<string> {
    await ensureSavesDir();

    const savedGame: SavedGame = {
        version: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        lobbyCode,
        gameState: state
    };

    const filePath = getSavePath(lobbyCode);
    await fs.writeFile(filePath, JSON.stringify(savedGame, null, 2), 'utf-8');

    console.log(`[SaveManager] Saved game ${lobbyCode} to ${filePath}`);
    return filePath;
}

/**
 * Loads a saved game from file.
 * Returns null if the save file doesn't exist.
 */
export async function loadSave(lobbyCode: string): Promise<SavedGame | null> {
    const filePath = getSavePath(lobbyCode);

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const savedGame = JSON.parse(content) as SavedGame;

        // Basic validation
        if (!savedGame.version || !savedGame.gameState || !savedGame.lobbyCode) {
            console.error(`[SaveManager] Invalid save file format: ${filePath}`);
            return null;
        }

        console.log(`[SaveManager] Loaded game ${lobbyCode} from ${filePath}`);
        return savedGame;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null; // File doesn't exist
        }
        throw error;
    }
}

/**
 * Checks if a save file exists for the given lobby code.
 */
export async function hasSave(lobbyCode: string): Promise<boolean> {
    const filePath = getSavePath(lobbyCode);
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Gets summary info about a save file without loading the full state.
 */
export async function getSaveInfo(lobbyCode: string): Promise<SaveFileInfo | null> {
    const savedGame = await loadSave(lobbyCode);
    if (!savedGame) return null;

    const { gameState } = savedGame;
    const industryCounts = countIndustries(gameState);

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
 * Deletes a save file.
 */
export async function deleteSave(lobbyCode: string): Promise<boolean> {
    const filePath = getSavePath(lobbyCode);
    try {
        await fs.unlink(filePath);
        console.log(`[SaveManager] Deleted save ${lobbyCode}`);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return false; // File didn't exist
        }
        throw error;
    }
}

/**
 * Lists all available save files.
 */
export async function listSaves(): Promise<SaveFileInfo[]> {
    await ensureSavesDir();

    try {
        const files = await fs.readdir(SAVES_DIR);
        const saveFiles = files.filter(f => f.endsWith('.json'));

        const infos: SaveFileInfo[] = [];
        for (const file of saveFiles) {
            const lobbyCode = file.replace('.json', '');
            const info = await getSaveInfo(lobbyCode);
            if (info) {
                infos.push(info);
            }
        }

        // Sort by savedAt descending (newest first)
        infos.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        return infos;
    } catch {
        return [];
    }
}
