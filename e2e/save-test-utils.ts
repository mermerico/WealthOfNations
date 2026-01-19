import * as fs from 'fs';
import * as path from 'path';
import { expect, type Page } from '@playwright/test';
import { type TestPlayer, waitForConnection } from './test-helpers';

/**
 * Shared utility for managing mock save files in E2E tests.
 */

const SAVE_DIR = path.join(process.cwd(), 'server', 'saves');

/**
 * Generate a random 5-character lobby code
 */
export function generateLobbyCode(prefix: string = ''): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = prefix;
    for (let i = 0; i < 5 - prefix.length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result.toUpperCase();
}

/**
 * Write a mock save file to the server's saves directory
 */
export function createMockSaveFile(lobbyCode: string, gameState: any): string {
    if (!fs.existsSync(SAVE_DIR)) {
        fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    const savePath = path.join(SAVE_DIR, `${lobbyCode}.json`);
    const mockSave = {
        version: 1,
        savedAt: new Date().toISOString(),
        lobbyCode,
        gameState
    };

    fs.writeFileSync(savePath, JSON.stringify(mockSave, null, 2), 'utf-8');
    return savePath;
}

/**
 * Delete a mock save file
 */
export function deleteMockSaveFile(savePath: string): void {
    if (savePath && fs.existsSync(savePath)) {
        fs.unlinkSync(savePath);
    }
}

/**
 * Common flow for joining a lobby and claiming seats in a restored game
 */
export async function joinAndClaimSeats(
    players: TestPlayer[],
    lobbyCode: string,
    step?: (msg: string) => Promise<void>
): Promise<void> {
    const log = step ?? (async (msg: string) => console.log(`[Join] ${msg}`));

    // All players join
    for (const player of players) {
        await player.page.goto('/');
        await waitForConnection(player.page);
        await player.page.getByPlaceholder('ABCDE').fill(lobbyCode);
        await player.page.getByRole('button', { name: 'Join Online Game' }).click();
    }

    // Claim seats
    for (let i = 0; i < players.length; i++) {
        const p = players[i].page;
        await expect(p.locator('h1:has-text("Restore Game")')).toBeVisible({ timeout: 20000 });
        await p.getByRole('button', { name: 'Claim' }).first().click();
        await log(`Player ${i + 1} (${players[i].name}) claimed seat`);
    }
}

/**
 * Base GameState template for Trade phase
 */
export function getBaseTradeState(playerNames: string[]) {
    return {
        players: playerNames.map((name, i) => ({
            id: `p${i + 1}`,
            name,
            color: ['#3b82f6', '#ef4444', '#10b981'][i] || '#8b5cf6',
            resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
            money: 100,
            loans: 0,
            flags: 18,
            ready: false,
            flag: ['anglica.svg', 'bolshevica.svg', 'bharat.svg'][i] || 'europia.svg',
            hasPassed: false,
            hasProduced: false
        })),
        board: {},
        markets: {
            Food: { stock: 4, priceIndex: 4 },
            Energy: { stock: 4, priceIndex: 4 },
            Labor: { stock: 4, priceIndex: 4 },
            Ore: { stock: 4, priceIndex: 4 },
            Capital: { stock: 4, priceIndex: 4 }
        },
        phase: 'Trade',
        currentTurnPlayerIndex: 0,
        firstPlayerIndex: 0,
        round: 1,
        consecutivePasses: 0,
        tilesRemaining: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
        initialFlagsPerPlayer: 18,
        initialTiles: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
        settings: { promissoryNoteInterestFees: false },
        logs: [],
        tradeIntents: playerNames.map((_, i) => ({
            playerId: `p${i + 1}`,
            ready: false,
            desiredInventory: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }
        }))
    };
}
