import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
    type TestPlayer,
    createPlayers,
    closePlayers,
    createAndJoinLobby,
    readyUpAndStartGame,
    runSetupPhase,
    findActivePlayer,
} from './test-helpers';

/**
 * 3-Player Game Flow E2E Tests
 * 
 * Uses test.describe.serial() to run tests in sequence with shared state.
 * This allows efficient reuse of game setup across multiple test scenarios.
 */

// Shared state across serial tests
let players: TestPlayer[] = [];
const playerNames = ['Alice', 'Bob', 'Charlie'];

// Helper functions
const step = async (msg: string) => console.log(`[Test] ${msg}`);

const debugPlayerStates = async () => {
    for (let i = 0; i < 3; i++) {
        const page = players[i].page;
        const waitingText = await page.getByText('Waiting for your turn').count();
        const pkgCount = await page.locator('.package-card:not(.disabled) .select-button:not([disabled])').count();
        await step(`  P${i + 1}: waiting=${waitingText > 0}, enabledPkgs=${pkgCount}`);
    }
};

test.describe.serial('3-player game flow', () => {

    test.beforeAll(async ({ browser }) => {
        players = await createPlayers(browser, playerNames, { defaultTimeout: 2000 });
    });

    test.afterAll(async () => {
        await closePlayers(players);
        players = [];
    });

    test('lobby creation and joining', async () => {
        test.setTimeout(30000);

        // Create and join lobby
        await step('P1 (Alice) creating lobby...');
        const lobbyCode = await createAndJoinLobby(players, async (msg) => {
            // Custom logging that matches original format
            if (msg.includes('Lobby Code:')) {
                await step(msg);
            } else if (msg.includes('Creating lobby')) {
                // Skip, we already logged P1 creating
            } else if (msg.includes('Readying')) {
                await step(msg);
            }
        });
        await step(`Lobby Code: ${lobbyCode}`);
        await step('P2 (Bob) joining...');
        await step('P3 (Charlie) joining...');

        await step('Readying up...');
        await step('Starting game...');
        await readyUpAndStartGame(players, step);
        await step('Lobby phase complete!');
    });

    test('setup phase - package selection and tile placement', async () => {
        test.setTimeout(120000);

        await step('Entering Setup Phase...');
        await players[0].page.waitForTimeout(100);

        // Valid tile placements extracted from successful test runs
        const validPlacements = [
            '1,0', '0,1', '1,-1',       // Package 1 (Farm)
            '-1,1', '-2,1', '-2,2',     // Package 2 (Farm)
            '1,-2', '0,-1',             // Package 3 (Generator)
            '0,-2', '-1,-1',            // Package 4 (Academy)
            '-3,1', '-3,2',             // Package 5 (Mine)
            '2,0', '0,2',               // Package 6 (Factory)
        ];
        let placementIndex = 0;

        await step('Running setup sequence...');
        await debugPlayerStates();

        let tradePhaseReached = false;
        let noProgressCount = 0;
        let lastActivePlayer = -1;
        let actionCount = 0;
        const pages = players.map(p => p.page);

        while (!tradePhaseReached && noProgressCount < 40) {
            // Check for Trade phase
            for (const page of pages) {
                if (await page.locator('text=TRADE').count() > 0) {
                    tradePhaseReached = true;
                    break;
                }
            }
            if (tradePhaseReached) break;

            const activePlayer = await findActivePlayer(pages);

            if (activePlayer !== lastActivePlayer) {
                await step(`Turn changed: P${lastActivePlayer + 1} -> P${activePlayer + 1}`);
                await debugPlayerStates();
                lastActivePlayer = activePlayer;
            }

            if (activePlayer === -1) {
                noProgressCount++;
                if (noProgressCount % 10 === 0) {
                    await step(`All players waiting? attempt ${noProgressCount}`);
                    await debugPlayerStates();
                }
                await pages[0].waitForTimeout(10);
                continue;
            }

            const page = pages[activePlayer];
            let madeProgress = false;

            // Try package selection
            const pkgBtn = page.locator('.package-card:not(.disabled) .select-button:not([disabled])').first();
            if (await pkgBtn.count() > 0) {
                await step(`P${activePlayer + 1} selecting package...`);
                await pkgBtn.click({ timeout: 2000 });
                await page.waitForTimeout(10);
                madeProgress = true;
                actionCount++;
            }

            // Try clicking Pass/Continue button
            if (!madeProgress) {
                const passBtn = page.getByRole('button', { name: /Pass.*Continue/i }).filter({ hasNot: page.locator('[disabled]') });
                if (await passBtn.count() > 0 && await passBtn.isEnabled()) {
                    await step(`P${activePlayer + 1} clicking Pass (Continue)...`);
                    await passBtn.click({ timeout: 2000 });
                    await page.waitForTimeout(10);
                    madeProgress = true;
                    actionCount++;
                }
            }

            // Try tile placement
            if (!madeProgress && placementIndex < validPlacements.length) {
                const cellId = validPlacements[placementIndex];
                try {
                    await page.getByTestId(`hex-${cellId}`).click({ timeout: 300 });
                    await step(`P${activePlayer + 1} placed at ${cellId}`);
                    await page.waitForTimeout(10);
                    madeProgress = true;
                    actionCount++;
                    placementIndex++;
                } catch {
                    placementIndex++;
                }
            }

            if (madeProgress) {
                noProgressCount = 0;
            } else {
                noProgressCount++;
                await pages[0].waitForTimeout(5);
            }

            if (actionCount > 100) {
                await step('Too many actions without reaching Trade phase');
                break;
            }
        }

        expect(tradePhaseReached).toBeTruthy();
        await step('Setup phase complete - Trade Phase Reached!');
    });

    test('trade phase - execute trade and finish', async () => {
        test.setTimeout(30000);
        const pages = players.map(p => p.page);

        const activeIdx = await findActivePlayer(pages);
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        const activePage = pages[activeIdx];
        const targetIdx = (activeIdx + 1) % 3;
        const targetPage = pages[targetIdx];
        const targetName = playerNames[targetIdx];

        await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) proposing trade to P${targetIdx + 1} (${targetName})...`);

        // New Flow: Target player must be Ready for Active player to propose trade
        await step(`P${targetIdx + 1} (${targetName}) marking ready...`);
        const targetMarkReadyBtn = targetPage.getByTestId('trade-ready-button');
        await targetMarkReadyBtn.click();
        await expect(targetPage.getByTestId('trade-ready-button')).toHaveText('Ready');

        // Wait for sync - Active player should see Target player as ready (no longer "Planning...")
        await step(`Waiting for P${targetIdx + 1} to appear ready on P${activeIdx + 1}'s screen...`);
        // Let's use the explicit check: no "(Planning...)"
        await expect(activePage.locator(`text=${targetName}`).filter({ hasText: '(Planning...)' })).toHaveCount(0, { timeout: 10000 });

        // Open trade modal by clicking target player's card
        await step(`P${activeIdx + 1} clicking P${targetIdx + 1}'s card to propose trade...`);
        // Find the "Player Offers" section
        const offersSection = activePage.getByTestId('player-offers-section');
        await expect(offersSection).toBeVisible();

        // Click the player card inside it (containing target name)
        await activePage.getByTestId(`player-offer-button-${targetName}`).click();

        // Enter money amount
        await activePage.getByTestId('trade-money-input-give').fill('10');
        await activePage.getByRole('button', { name: 'Propose Trade', exact: true }).click();
        await activePage.waitForTimeout(100); // Wait for trade proposal to propagate

        // Accept trade
        await step(`P${targetIdx + 1} accepting trade...`);
        await expect(targetPage.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 2000 });
        await targetPage.getByRole('button', { name: 'Accept' }).click();

        await expect(targetPage.getByRole('button', { name: 'Accept' })).not.toBeVisible();
        await step('Trade accepted!');

        // All players pass to finish trade phase
        await step('All players passing to finish Trade phase...');
        for (let turn = 0; turn < 3; turn++) {
            const activeIdx = await findActivePlayer(pages);
            expect(activeIdx).toBeGreaterThanOrEqual(0);
            await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) passing Trade phase`);
            await pages[activeIdx].getByTestId('trade-pass-button').click();
            await pages[activeIdx].waitForTimeout(200);
        }
    });

    test('development phase - all players pass', async () => {
        test.setTimeout(60000);
        const pages = players.map(p => p.page);

        await step('Waiting for Development phase...');

        // Wait for all players to see DEVELOP
        for (let i = 0; i < 3; i++) {
            await expect(pages[i].locator('text=DEVELOP')).toBeVisible({ timeout: 5000 });
        }

        for (let turn = 0; turn < 3; turn++) {
            const activeIdx = await findActivePlayer(pages);
            expect(activeIdx).toBeGreaterThanOrEqual(0);
            await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) passing Develop phase`);
            await pages[activeIdx].getByTestId('develop-pass-button').click();
            await pages[activeIdx].waitForTimeout(200);
        }
    });

    test('production phase - simultaneous production', async () => {
        test.setTimeout(30000);
        const pages = players.map(p => p.page);

        await step('Waiting for Production phase...');

        // Wait for all players to see PRODUCE
        for (let i = 0; i < 3; i++) {
            await expect(pages[i].locator('text=PRODUCE')).toBeVisible({ timeout: 5000 });
        }

        await step('All players running production...');
        // Click in non-sequential order to verify simultaneity
        const indices = [1, 0, 2];
        for (const i of indices) {
            const name = playerNames[i];
            await step(`P${i + 1} (${name}) clicking Run Production...`);

            // Wait for button to be available and click
            const btn = pages[i].getByTestId('run-production-button');
            await btn.click();

            // Verify roster reflects status (assuming there's a status indicator)
            // This adds synchronization
            await pages[i].waitForTimeout(500);
        }

        // Verify phase advances (usually back to Trade of Round 2)
        await step('Verifying transition to next round...');

        // Use more robust selectors for phase and round
        // Phase should be TRADE in Round 2
        for (let i = 0; i < 3; i++) {
            await expect(pages[i].getByText('TRADE', { exact: true })).toBeVisible({ timeout: 10000 });
            // Look for the round number "2" specifically in the Control Panel status info
            const roundContainer = pages[i].locator('div:has-text("ROUND")').last(); // Get the inner one
            await expect(roundContainer.getByText('2', { exact: true })).toBeVisible({ timeout: 5000 });
        }
    });
});
