import { test, expect } from '@playwright/test';
import {
    type TestPlayer,
    runSetupPhase,
    findActivePlayer,
} from './test-helpers';

/**
 * Local Hotseat Game E2E Test
 * Simulates a single browser session where 3 players take turns on the same device.
 */

const playerNames = ['Player 1', 'Player 2', 'Player 3'];
const step = async (msg: string) => console.log(`[Hotseat] ${msg}`);

test('local hotseat game flow', async ({ page }) => {
    test.slow();
    test.setTimeout(180000); // Allow ample time for a full game flow

    // 1. Start Local Game
    await step('Starting local game setup...');
    await page.goto('/');
    await page.getByText('Local Hotseat Game').click();

    // Verify setup screen
    await expect(page.getByText('Local Game Setup')).toBeVisible();

    // Default is 3 players, just click Start
    await step('Starting game with 3 players...');
    await page.getByText('Start Game').click();

    // Verify game started (Setup phase)
    await expect(page.getByTestId('phase-display')).toBeVisible({ timeout: 10000 });

    // 2. Setup Phase (Package Selection & Tile Placement)
    // We create mock "TestPlayer" objects that all share the same page
    // This allows reusing the runSetupPhase helper which expects an array of players
    // but in hotseat it's just one shared view that updates.
    const mockPlayers: TestPlayer[] = playerNames.map(name => ({
        page,
        context: page.context(),
        name
    }));

    await step('Running setup phase...');
    await runSetupPhase(mockPlayers, step);

    // 3. Trade Phase
    await step('Trade Phase started');

    // Verify each player sees their turn
    for (let turn = 0; turn < 3; turn++) {
        // Determine who is active
        const activeIdx = await findActivePlayer(mockPlayers);
        const name = playerNames[activeIdx];
        await step(`Active player is: ${name}`);

        // Verify active player indicator
        await expect(page.getByTestId('active-player-name')).toHaveText(name);

        // Pass the turn
        await step(`${name} passing Trade phase...`);
        // In hotseat, we just click Pass. The view updates immediately.
        await page.getByTestId('trade-pass-button').click();
        await page.waitForTimeout(500); // Visual pause

        // If it was the last player, check for phase transition
        if (turn === 2) {
            await expect(page.getByTestId('phase-display')).toHaveText('DEVELOP');
        } else {
            // Otherwise wait for next turn logic?
            // Actually hotseat might show an interstitial or just switch.
            // If local game, it might just switch.
        }
    }

    // 4. Develop Phase (This is where the bug is reported)
    await step('Develop Phase started');
    await expect(page.getByTestId('phase-display')).toHaveText('DEVELOP');

    for (let turn = 0; turn < 3; turn++) {
        const activeIdx = await findActivePlayer(mockPlayers);
        const name = playerNames[activeIdx];
        await step(`Develop Phase - Active: ${name}`);

        // Try to place a tile if possible? Or just Pass.
        // User says "can't progress past develop stage".
        // Let's try to Pass.
        await step(`${name} passing Develop phase...`);
        const passBtn = page.getByTestId('develop-pass-button');
        await expect(passBtn).toBeVisible();
        await expect(passBtn).toBeEnabled();
        await passBtn.click();

        await page.waitForTimeout(500);

        if (turn === 2) {
            // Expect transition to PRODUCE
            await step('Waiting for Produce phase...');
            await expect(page.getByTestId('phase-display')).toHaveText('PRODUCE', { timeout: 10000 });
        }
    }

    // 5. Produce Phase
    await step('Produce Phase started');
    // In hotseat, produce might be sequential or one big screen?
    // Rules say "Simultaneous", but in hotseat it usually iterates players or shows a summary.
    // Based on `Game.tsx`, it likely iterates if not properly handled for hotseat?
    // Or maybe it's a single screen where you click "Run Production" once?
    // Let's check what typically happens.
    // If it's sequential hotseat, we expect to see Player 1, then 2, then 3.

    // Let's check if we see "Run Production"
    await expect(page.getByTestId('run-production-button')).toBeVisible();

    // We expect 3 iterations of production if it's sequential-ish (since they need to configure their blocs)
    // Or maybe it just does it automatically?
    // The multiplayer test clicks "Run Production" for each.

    // Let's assume sequential for now and debug if it fails.
    for (let i = 0; i < 3; i++) {
        const productionBtn = page.getByTestId('run-production-button');
        await expect(productionBtn).toBeVisible();
        await productionBtn.click();

        // Confirm modal
        await page.getByRole('button', { name: 'Confirm' }).click();
        await page.waitForTimeout(1000);
    }

    // Next round checks...
    await expect(page.getByTestId('phase-display')).toHaveText('TRADE');
    await expect(page.getByTestId('round-indicator')).toHaveText('2');
});
