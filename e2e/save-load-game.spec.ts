import { test, expect, type Page } from '@playwright/test';
import {
    type TestPlayer,
    createPlayers,
    closePlayers,
    initializeGameToTradePhase,
    waitForConnection,
} from './test-helpers';

/**
 * Save/Load Game Flow E2E Tests
 * 
 * Tests the ability to save a game mid-progress, have players disconnect,
 * and restore the game by entering the saved lobby code.
 */

// Shared state across serial tests
let players: TestPlayer[] = [];
let savedLobbyCode: string = '';
const playerNames = ['SaveP1', 'SaveP2', 'SaveP3'];

const step = async (msg: string) => console.log(`[SaveTest] ${msg}`);

test.describe.serial('save and restore game flow', () => {

    test.beforeAll(async ({ browser }) => {
        players = await createPlayers(browser, playerNames, { defaultTimeout: 5000 });
    });

    test.afterAll(async () => {
        await closePlayers(players);
        players = [];
    });

    test('setup game and save mid-progress', async () => {
        test.setTimeout(90000);

        // Use shared helper to get to Trade phase
        savedLobbyCode = await initializeGameToTradePhase(players, step);

        // Wait for Trade phase
        await expect(players[0].page.getByTestId('phase-display').filter({ hasText: 'TRADE' })).toBeVisible({ timeout: 10000 });
        await step('Now in Trade phase - ready to save');

        // Save game via UI button (host only)
        await step('Saving game...');

        // Host should see button
        await expect(players[0].page.getByRole('button', { name: 'Save Game' })).toBeVisible();
        await players[0].page.getByRole('button', { name: 'Save Game' }).click();

        // Verify success toast
        await expect(players[0].page.locator('text=✅ Game saved successfully!')).toBeVisible();
        await step('Game saved successfully!');

        // Save code for next test
        console.log('Saved lobby code:', savedLobbyCode);
    });

    test('restore game with same code after disconnect', async ({ browser }) => {
        test.setTimeout(45000);

        // Quit game to clean up lobby on server (triggering persistent save check on next join)
        await step('Quitting game to cleanup lobby...');
        for (const player of players) {
            // Try to quit from game screen (Quit Game) or lobby screen (Quit Lobby)
            const quitGameBtn = player.page.getByRole('button', { name: 'Quit Game' });
            const quitLobbyBtn = player.page.getByRole('button', { name: 'Quit Lobby' });

            if (await quitGameBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await quitGameBtn.click();
                // Confirm quit (click the 'Quit' button in the confirmation modal)
                await player.page.getByRole('button', { name: 'Quit', exact: true }).click();
                // Wait for return to landing page
                await expect(player.page.locator('.landing-container')).toBeVisible({ timeout: 10000 });
            } else if (await quitLobbyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await quitLobbyBtn.click();
                // Wait for return to landing page (no confirmation needed for lobby quit)
                await expect(player.page.locator('.landing-container')).toBeVisible({ timeout: 10000 });
            }
        }

        // Close all existing contexts
        await step('Closing browsers...');
        await closePlayers(players);
        players = [];

        // Wait for server to clean up
        await new Promise(r => setTimeout(r, 1000));

        // Create new browser contexts (simulating reconnection)
        await step('Reconnecting players...');
        players = await createPlayers(browser, playerNames, { defaultTimeout: 5000 });

        // First player joins with saved code
        const p1 = players[0].page;
        await p1.goto('/');
        await waitForConnection(p1);
        await p1.getByPlaceholder('ABCDE').fill(savedLobbyCode);
        await p1.getByRole('button', { name: 'Join Online Game' }).click();

        // Should see Restore Lobby UI since we saved
        await step('Checking restore UI...');
        await expect(p1.locator('text=Restore Game')).toBeVisible({ timeout: 10000 });

        // Other players join
        for (let i = 1; i < 3; i++) {
            await players[i].page.goto('/');
            await waitForConnection(players[i].page);
            await players[i].page.getByPlaceholder('ABCDE').fill(savedLobbyCode);
            await players[i].page.getByRole('button', { name: 'Join Online Game' }).click();
        }

        // Each player claims a seat
        // Note: Seat order in restore lobby matches the saved player order
        // We'll mimic players claiming their original seats (or any available)
        await step('Claiming seats...');
        for (let i = 0; i < 3; i++) {
            // Wait for seat list to populate (or game to start if all seats claimed)
            const claimBtn = players[i].page.getByRole('button', { name: 'Claim' }).first();
            const tradePhase = players[i].page.getByText('TRADE', { exact: true });

            // Wait for either Claim button (still in restore) or TRADE text (game started)
            await expect(claimBtn.or(tradePhase)).toBeVisible({ timeout: 10000 });

            // If game already started (all seats were claimed), we're done
            if (await tradePhase.isVisible().catch(() => false)) {
                await step(`Game already started, skipping player ${i + 1}`);
                continue;
            }

            // Click the claim button
            await claimBtn.click();
            await step(`Player ${i + 1} claimed a seat`);

            // After claiming, either see Unclaim (more seats to claim) or TRADE (game started)
            await expect(players[i].page.getByRole('button', { name: 'Unclaim' }).or(tradePhase)).toBeVisible({ timeout: 5000 });
        }

        // After all seats claimed, should transition to game
        await step('Waiting for game to resume...');
        await expect(players[0].page.getByTestId('phase-display').filter({ hasText: 'TRADE' })).toBeVisible({ timeout: 10000 });
        await step('Successfully restored to game!');
    });
});
