import { test, expect } from '@playwright/test';
import {
    type TestPlayer,
    createPlayers,
    closePlayers,
    waitForConnection,
} from './test-helpers';
import {
    generateLobbyCode,
    createMockSaveFile,
    deleteMockSaveFile,
    getBaseTradeState
} from './save-test-utils';

/**
 * Save/Load Game Flow E2E Tests (Optimized)
 * 
 * Tests the ability to restore a game by entering a lobby code
 * and claiming seats.
 */

// Shared state across serial tests
let players: TestPlayer[] = [];
const playerNames = ['SaveP1', 'SaveP2', 'SaveP3'];
const LOBBY_CODE = generateLobbyCode('SL');
let savePath: string = '';

const step = async (msg: string) => console.log(`[SaveTest] ${msg}`);

test.describe.serial('save and restore game flow', () => {

    test.beforeAll(async () => {
        // Initialize game state in Trade phase
        const gameState = getBaseTradeState(playerNames);
        savePath = createMockSaveFile(LOBBY_CODE, gameState);
    });

    test.afterAll(async () => {
        await closePlayers(players);
        deleteMockSaveFile(savePath);
        players = [];
    });

    test('restore game with same code', async ({ browser }) => {
        test.setTimeout(60000);

        // Create new browser contexts (simulating reconnection)
        await step('Connecting players...');
        players = await createPlayers(browser, playerNames, { defaultTimeout: 5000 });

        // First player joins with saved code
        const p1 = players[0].page;
        await p1.goto('/');
        await waitForConnection(p1);
        await p1.getByPlaceholder('ABCDE').fill(LOBBY_CODE);
        await p1.getByRole('button', { name: 'Join Online Game' }).click();

        // Should see Restore Lobby UI since we saved
        await step('Checking restore UI...');
        await expect(p1.locator('text=Restore Game')).toBeVisible({ timeout: 10000 });

        // Other players join
        for (let i = 1; i < 3; i++) {
            await players[i].page.goto('/');
            await waitForConnection(players[i].page);
            await players[i].page.getByPlaceholder('ABCDE').fill(LOBBY_CODE);
            await players[i].page.getByRole('button', { name: 'Join Online Game' }).click();
        }

        // Each player claims a seat
        await step('Claiming seats...');
        for (let i = 0; i < 3; i++) {
            const claimBtn = players[i].page.getByRole('button', { name: 'Claim' }).first();
            const tradePhase = players[i].page.getByTestId('phase-display').filter({ hasText: 'TRADE' });

            // Wait for either Claim button (still in restore) or TRADE text (game started)
            await expect(claimBtn.or(tradePhase)).toBeVisible({ timeout: 10000 });

            if (await tradePhase.isVisible().catch(() => false)) {
                await step(`Game already started, skipping player ${i + 1}`);
                continue;
            }

            // Click the claim button
            await claimBtn.click();
            await step(`Player ${i + 1} claimed a seat`);
        }

        // After all seats claimed, should transition to game
        await step('Waiting for game to resume...');
        await expect(players[0].page.getByTestId('phase-display').filter({ hasText: 'TRADE' })).toBeVisible({ timeout: 10000 });
        await step('Successfully restored to game!');
    });
});
