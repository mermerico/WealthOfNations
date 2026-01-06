import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * 3-Player Game Flow E2E Tests
 * 
 * Uses test.describe.serial() to run tests in sequence with shared state.
 * This allows efficient reuse of game setup across multiple test scenarios.
 */

// Shared state across serial tests
let contexts: BrowserContext[] = [];
let pages: Page[] = [];
const playerNames = ['Alice', 'Bob', 'Charlie'];

// Helper functions
const step = async (msg: string) => console.log(`[Test] ${msg}`);

const waitForConnection = async (page: Page) => {
    await expect(page.locator('text=Online services available')).toBeVisible({ timeout: 10000 });
};

const findActivePlayer = async (): Promise<number> => {
    await pages[0].waitForTimeout(5);
    for (let i = 0; i < 3; i++) {
        const page = pages[i];
        const waitingText = await page.getByText('Waiting for your turn').count();
        if (waitingText === 0) {
            return i;
        }
    }
    return -1;
};

const debugPlayerStates = async () => {
    for (let i = 0; i < 3; i++) {
        const page = pages[i];
        const waitingText = await page.getByText('Waiting for your turn').count();
        const pkgCount = await page.locator('.package-card:not(.disabled) .select-button:not([disabled])').count();
        await step(`  P${i + 1}: waiting=${waitingText > 0}, enabledPkgs=${pkgCount}`);
    }
};

test.describe.serial('3-player game flow', () => {

    test.beforeAll(async ({ browser }) => {
        // Create 3 separate browser contexts (like 3 different users)
        for (let i = 0; i < 3; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();
            page.setDefaultTimeout(2000);

            // Capture E2E_RECORD console messages
            page.on('console', msg => {
                if (msg.text().includes('E2E_RECORD')) {
                    console.log(`[${playerNames[i]}] ${msg.text()}`);
                }
            });

            contexts.push(context);
            pages.push(page);
        }
    });

    test.afterAll(async () => {
        // Cleanup
        for (const context of contexts) {
            await context.close();
        }
        contexts = [];
        pages = [];
    });

    test('lobby creation and joining', async () => {
        test.setTimeout(30000);
        const [p1, p2, p3] = pages;

        // P1 creates lobby
        await step('P1 (Alice) creating lobby...');
        await p1.goto('/');
        await waitForConnection(p1);
        await p1.getByRole('button', { name: 'Create Online Game' }).click();
        await expect(p1.locator('.lobby-code')).toBeVisible();
        const lobbyCode = (await p1.locator('.lobby-code span').first().innerText()).trim();
        await step(`Lobby Code: ${lobbyCode}`);
        await p1.locator('.lobby-name-input').fill(playerNames[0]);
        await p1.locator('.lobby-name-input').press('Enter');

        // P2 joins
        await step('P2 (Bob) joining...');
        await p2.goto('/');
        await waitForConnection(p2);
        await p2.getByPlaceholder('ABCDE').fill(lobbyCode);
        await p2.getByRole('button', { name: 'Join Online Game' }).click();
        await expect(p2.locator('.lobby-code')).toBeVisible();
        await p2.locator('.lobby-name-input').fill(playerNames[1]);
        await p2.locator('.lobby-name-input').press('Enter');

        // P3 joins
        await step('P3 (Charlie) joining...');
        await p3.goto('/');
        await waitForConnection(p3);
        await p3.getByPlaceholder('ABCDE').fill(lobbyCode);
        await p3.getByRole('button', { name: 'Join Online Game' }).click();
        await expect(p3.locator('.lobby-code')).toBeVisible();
        await p3.locator('.lobby-name-input').fill(playerNames[2]);
        await p3.locator('.lobby-name-input').press('Enter');

        // Ready up
        await step('Readying up...');
        await p1.getByRole('button', { name: 'Ready Up' }).click();
        await p2.getByRole('button', { name: 'Ready Up' }).click();
        await p3.getByRole('button', { name: 'Ready Up' }).click();

        // Start game
        await step('Starting game...');
        await expect(p1.getByRole('button', { name: /Start Game/ })).toBeEnabled();
        await p1.getByRole('button', { name: /Start Game/ }).click();

        await step('Lobby phase complete!');
    });

    test('setup phase - package selection and tile placement', async () => {
        test.setTimeout(120000);
        const p1 = pages[0];

        await step('Entering Setup Phase...');
        await p1.waitForTimeout(100);

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

        while (!tradePhaseReached && noProgressCount < 40) {
            // Check for Trade phase
            for (const page of pages) {
                if (await page.locator('text=TRADE').count() > 0) {
                    tradePhaseReached = true;
                    break;
                }
            }
            if (tradePhaseReached) break;

            const activePlayer = await findActivePlayer();

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
                await p1.waitForTimeout(10);
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
                await p1.waitForTimeout(5);
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

        const activeIdx = await findActivePlayer();
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        const activePage = pages[activeIdx];
        const targetIdx = (activeIdx + 1) % 3;
        const targetPage = pages[targetIdx];
        const targetName = playerNames[targetIdx];

        await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) proposing trade to P${targetIdx + 1} (${targetName})...`);

        // Open trade modal and propose
        await activePage.getByText('🤝 Propose Trade').click();
        // Select target by name, not by index (dropdown order isn't deterministic)
        await activePage.locator('select').selectOption({ label: targetName });
        // Enter money amount (first number input is "One Give" money)
        await activePage.locator('input[type="number"]').first().fill('10');
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
            const activeIdx = await findActivePlayer();
            expect(activeIdx).toBeGreaterThanOrEqual(0);
            await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) passing Trade phase`);
            await pages[activeIdx].getByRole('button', { name: '✓ Pass' }).click({ force: true });
            await pages[activeIdx].waitForTimeout(200);
        }
    });

    test('development phase - all players pass', async () => {
        test.setTimeout(60000);
        await step('Waiting for Development phase...');

        // Wait for all players to see DEVELOP
        for (let i = 0; i < 3; i++) {
            await expect(pages[i].locator('text=DEVELOP')).toBeVisible({ timeout: 5000 });
        }

        for (let turn = 0; turn < 3; turn++) {
            const activeIdx = await findActivePlayer();
            expect(activeIdx).toBeGreaterThanOrEqual(0);
            await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) passing Develop phase`);
            await pages[activeIdx].getByRole('button', { name: '✓ Pass' }).click({ force: true });
            await pages[activeIdx].waitForTimeout(200);
        }
    });

    test('production phase - simultaneous production', async () => {
        test.setTimeout(30000);
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
            const btn = pages[i].getByRole('button', { name: 'Run Production' });
            await btn.waitFor({ state: 'visible' });
            await btn.click({ force: true });

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
