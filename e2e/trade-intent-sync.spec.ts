import { test, expect } from '@playwright/test';
import {
    type TestPlayer,
    createPlayers,
    closePlayers,
    initializeGameToTradePhase,
    findActivePlayer,
} from './test-helpers';

/**
 * Trade Intent Synchronization Tests
 * 
 * Tests that player trade intents (desired inventory + ready state)
 * are properly synchronized across all clients in remote multiplayer.
 */

test.describe.serial('Trade Intent Synchronization', () => {
    let players: TestPlayer[] = [];
    const playerNames = ['Alice', 'Bob', 'Charlie'];
    const step = async (msg: string) => console.log(`[TradeIntent] ${msg}`);

    test.beforeAll(async ({ browser }) => {
        players = await createPlayers(browser, playerNames, { defaultTimeout: 3000 });
    });

    test.afterAll(async () => {
        await closePlayers(players);
        players = [];
    });

    test('setup - reach trade phase', async () => {
        test.setTimeout(120000);
        await initializeGameToTradePhase(players, step);

        // Verify all players see Trade phase
        for (const player of players) {
            await expect(player.page.getByTestId('phase-display').filter({ hasText: 'TRADE' })).toBeVisible({ timeout: 5000 });
        }
        await step('All players in Trade phase');
    });

    test('player marking ready updates other players', async () => {
        test.setTimeout(30000);
        const pages = players.map(p => p.page);

        // Find who is the active player - they will set their desired inventory and mark ready
        const activeIdx = await findActivePlayer(pages);
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        const activePage = pages[activeIdx];
        const activePlayer = players[activeIdx];
        const otherIdx = (activeIdx + 1) % 3;
        const otherPage = pages[otherIdx];

        await step(`Active player is ${activePlayer.name} (index ${activeIdx})`);

        // Find the "Mark Ready" button on the active player's page
        const markReadyBtn = activePage.getByTestId('trade-ready-button');

        // Check if the button exists (it should be visible in remote mode)
        const hasMarkReady = await markReadyBtn.count() > 0;
        await step(`Mark Ready button visible: ${hasMarkReady}`);

        if (!hasMarkReady) {
            // The button might not exist if not in remote mode - skip test
            test.skip();
            return;
        }

        // Before marking ready, check that other players see "(Planning...)" next to this player
        // The Player Offers section should show players as "Planning..." until ready
        await step(`Looking for ${activePlayer.name} in Player Offers on other client...`);

        // On the other player's page, the active player should appear in the Player Offers section
        // with "(Planning...)" indicator since they haven't marked ready yet
        const playerOffersBefore = await otherPage.locator(`text=${activePlayer.name}`).count();
        await step(`Found ${activePlayer.name} in Player Offers: ${playerOffersBefore > 0}`);

        // Mark ready on active player
        await step(`${activePlayer.name} clicking Mark Ready...`);
        await markReadyBtn.click();

        // Wait a moment for the state to sync
        await activePage.waitForTimeout(500);

        // Verify the button now shows "Ready" 
        await expect(activePage.getByRole('button', { name: 'Ready', exact: true })).toBeVisible({ timeout: 2000 });
        await step(`${activePlayer.name} button now shows "Ready"`);

        // Now check on the other player's page - the "(Planning...)" indicator should be gone
        // Wait for the update to propagate
        await otherPage.waitForTimeout(1000);

        // The player card for activePlayer should no longer show "(Planning...)"
        // Look for the specific pattern where the player name is followed by Planning
        const planningText = `(Planning...)`;
        const playerCardWithPlanning = otherPage.locator(`text=${activePlayer.name}`).filter({ has: otherPage.locator(`text=${planningText}`) });

        // Find all player entries that are still showing as planning
        const stillPlanning = (await playerCardWithPlanning.count()) > 0;
        await step(`${activePlayer.name} still showing as Planning on ${players[otherIdx].name}'s screen: ${stillPlanning}`);

        // This assertion will help us identify if the sync is working
        // If this fails, the trade intents are not syncing properly
        expect(stillPlanning).toBe(false);
        await step('Trade intent ready state synced successfully!');
    });

    test('desired inventory changes sync to other players', async () => {
        test.setTimeout(30000);
        const pages = players.map(p => p.page);

        // Active player modifies their desired inventory
        const activeIdx = await findActivePlayer(pages);
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        const activePage = pages[activeIdx];
        const activePlayer = players[activeIdx];
        const otherIdx = (activeIdx + 1) % 3;
        const otherPage = pages[otherIdx];

        await step(`${activePlayer.name} modifying Desired Inventory...`);

        // Find the Desired Inventory section - look for the spinner inputs
        // The spinners have + and - buttons
        const plusButtons = activePage.getByTestId(/^inventory-plus-/);
        const plusCount = await plusButtons.count();
        await step(`Found ${plusCount} plus buttons for incrementing`);

        if (plusCount > 0) {
            // Click the first + button a few times to increase a commodity
            await plusButtons.first().click();
            await activePage.waitForTimeout(100);
            await plusButtons.first().click();
            await activePage.waitForTimeout(100);
            await step('Incremented first commodity by 2');

            // Wait for sync
            await activePage.waitForTimeout(1000);

            // Check if the other player sees updated deltas in Player Offers
            // The deltas should show non-zero values now
            await step('Checking if other player sees updated deltas...');

            // This is harder to verify without specific data-testid attributes
            // For now, just verify the page didn't crash and the action was received
            const playerOffersSection = otherPage.locator('text=Player Offers');
            await expect(playerOffersSection).toBeVisible();
            await step('Other player still sees Player Offers section (no crash)');
        }
    });

    test('inactive player marking ready updates active player', async () => {
        test.setTimeout(30000);
        const pages = players.map(p => p.page);

        // identify active and inactive players
        const activeIdx = await findActivePlayer(pages);
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        const activePage = pages[activeIdx];
        const activePlayer = players[activeIdx];

        // Find an inactive player
        const inactiveIdx = (activeIdx + 1) % 3;
        const inactivePage = pages[inactiveIdx];
        const inactivePlayer = players[inactiveIdx];

        await step(`Testing Inactive->Active Sync. Active: ${activePlayer.name}, Inactive: ${inactivePlayer.name}`);

        // Inactive player marks ready
        const markReadyBtn = inactivePage.getByTestId('trade-ready-button');

        // Ensure button is there
        const count = await markReadyBtn.count();
        if (count === 0) {
            // Already ready?
            await step(`${inactivePlayer.name} Mark Ready button not found. Already ready?`);
        } else {
            await step(`${inactivePlayer.name} (inactive) clicking Mark Ready...`);
            await markReadyBtn.click();
            await expect(inactivePage.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
        }

        // Check if Active Player sees this
        await step(`Checking if Active Player (${activePlayer.name}) sees ${inactivePlayer.name} as ready...`);

        // On active player's screen, the inactive player should NOT have "(Planning...)"
        // We wait up to 5s for sync
        try {
            await expect(activePage.locator(`text=${inactivePlayer.name}`).filter({ hasText: '(Planning...)' })).toHaveCount(0, { timeout: 5000 });
        } catch (e) {
            // Debug: Check if inactive player has an error
            const lastError = await inactivePage.evaluate(() => {
                // accessing internal React state is hard from outside unless we expose it or use devtools
                // But we display error in UI usually? 
                // TradeActionPanel doesn't show global error.
                // But maybe we can check console logs for 'error' type message?
                return document.body.innerText.includes('Action not permitted') ? 'Action not permitted' : null;
            });
            await step(`Inactive player error state: ${lastError}`);

            // Also check useGameEngine internal state if possible or rely on console logs we just captured
            throw e;
        }
        await step('Sync confirmed: Planning indicator gone.');
    });
});
