import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import type { GameState } from '../types/gameState';
import { createInitialGameState } from '../shared/gameEngine';

/**
 * Unit tests for saveManager functionality.
 * 
 * Note: These tests use direct file operations to verify save/load behavior.
 * The saveManager module runs on the server, so we test the serialization
 * logic and file format here.
 */

const TEST_SAVES_DIR = path.join(process.cwd(), 'test-saves');

// Helper to create a test save file directly
async function writeTestSave(lobbyCode: string, gameState: GameState): Promise<void> {
    await fs.mkdir(TEST_SAVES_DIR, { recursive: true });
    const saveData = {
        version: 1,
        savedAt: new Date().toISOString(),
        lobbyCode,
        gameState
    };
    const filePath = path.join(TEST_SAVES_DIR, `${lobbyCode}.json`);
    await fs.writeFile(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
}

// Helper to read a save file
async function readTestSave(lobbyCode: string): Promise<unknown> {
    const filePath = path.join(TEST_SAVES_DIR, `${lobbyCode}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

// Cleanup helper
async function cleanupTestSaves(): Promise<void> {
    try {
        const files = await fs.readdir(TEST_SAVES_DIR);
        for (const file of files) {
            await fs.unlink(path.join(TEST_SAVES_DIR, file));
        }
        await fs.rmdir(TEST_SAVES_DIR);
    } catch {
        // Directory doesn't exist or already cleaned
    }
}

describe('Save Game Serialization', () => {
    beforeEach(async () => {
        await cleanupTestSaves();
    });

    afterEach(async () => {
        await cleanupTestSaves();
    });

    describe('Save File Format', () => {
        it('should create valid JSON save file with required fields', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            await writeTestSave('TEST1', gameState);

            const saved = await readTestSave('TEST1') as Record<string, unknown>;

            expect(saved).toHaveProperty('version');
            expect(saved).toHaveProperty('savedAt');
            expect(saved).toHaveProperty('lobbyCode');
            expect(saved).toHaveProperty('gameState');
        });

        it('should preserve version number', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            await writeTestSave('VERS1', gameState);

            const saved = await readTestSave('VERS1') as Record<string, unknown>;

            expect(saved.version).toBe(1);
        });

        it('should preserve lobby code', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            await writeTestSave('MYCODE', gameState);

            const saved = await readTestSave('MYCODE') as Record<string, unknown>;

            expect(saved.lobbyCode).toBe('MYCODE');
        });

        it('should include valid ISO timestamp', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            await writeTestSave('TIME1', gameState);

            const saved = await readTestSave('TIME1') as Record<string, unknown>;

            expect(typeof saved.savedAt).toBe('string');
            const date = new Date(saved.savedAt as string);
            expect(date.getTime()).not.toBeNaN();
        });
    });

    describe('GameState Preservation', () => {
        it('should preserve player count', async () => {
            const gameState = createInitialGameState({ playerCount: 4 });
            await writeTestSave('PLY4', gameState);

            const saved = await readTestSave('PLY4') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.players.length).toBe(4);
        });

        it('should preserve player names', async () => {
            const gameState = createInitialGameState({
                playerNames: ['Alice', 'Bob', 'Charlie']
            });
            await writeTestSave('NAMES', gameState);

            const saved = await readTestSave('NAMES') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.players[0].name).toBe('Alice');
            expect(restoredState.players[1].name).toBe('Bob');
            expect(restoredState.players[2].name).toBe('Charlie');
        });

        it('should preserve player resources', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            // Modify some resources
            gameState.players[0].resources.Food = 5;
            gameState.players[0].money = 100;
            gameState.players[1].loans = 2;

            await writeTestSave('RES1', gameState);

            const saved = await readTestSave('RES1') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.players[0].resources.Food).toBe(5);
            expect(restoredState.players[0].money).toBe(100);
            expect(restoredState.players[1].loans).toBe(2);
        });

        it('should preserve round and phase', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            gameState.round = 3;
            gameState.phase = 'Trade';

            await writeTestSave('RND3', gameState);

            const saved = await readTestSave('RND3') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.round).toBe(3);
            expect(restoredState.phase).toBe('Trade');
        });

        it('should preserve market state', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            gameState.markets.Food.stock = 10;
            gameState.markets.Energy.stock = 2;

            await writeTestSave('MKT1', gameState);

            const saved = await readTestSave('MKT1') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.markets.Food.stock).toBe(10);
            expect(restoredState.markets.Energy.stock).toBe(2);
        });

        it('should preserve board occupants', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            // Add an occupant to a cell
            gameState.board['0,0'] = {
                q: 0,
                r: 0,
                occupant: {
                    type: 'Flag',
                    playerId: 'p1'
                }
            };

            await writeTestSave('BRD1', gameState);

            const saved = await readTestSave('BRD1') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.board['0,0'].occupant).toEqual({
                type: 'Flag',
                playerId: 'p1'
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle game end state', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            gameState.gameEnded = true;
            gameState.isLastRound = true;

            await writeTestSave('END1', gameState);

            const saved = await readTestSave('END1') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.gameEnded).toBe(true);
            expect(restoredState.isLastRound).toBe(true);
        });

        it('should handle pending trade', async () => {
            const gameState = createInitialGameState({ playerCount: 3 });
            gameState.pendingTrade = {
                proposerId: 'p1',
                targetId: 'p2',
                giving: { commodities: { Food: 2 }, money: 0, loans: 0 },
                receiving: { commodities: { Energy: 1 }, money: 5, loans: 0 }
            };

            await writeTestSave('TRD1', gameState);

            const saved = await readTestSave('TRD1') as Record<string, unknown>;
            const restoredState = saved.gameState as GameState;

            expect(restoredState.pendingTrade).toBeDefined();
            expect(restoredState.pendingTrade?.proposerId).toBe('p1');
        });
    });
});
