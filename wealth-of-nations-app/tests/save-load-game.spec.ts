import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Save/Load Game Flow E2E Tests
 * 
 * Tests the ability to save a game mid-progress, have players disconnect,
 * and restore the game by entering the saved lobby code.
 */

// Shared state across serial tests
let contexts: BrowserContext[] = [];
let pages: Page[] = [];
let savedLobbyCode: string = '';
const playerNames = ['SaveP1', 'SaveP2', 'SaveP3'];

const step = async (msg: string) => console.log(`[SaveTest] ${msg}`);

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

test.describe.serial('save and restore game flow', () => {

    test.beforeAll(async ({ browser }) => {
        for (let i = 0; i < 3; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            contexts.push(context);
            pages.push(page);
        }
    });

    test.afterAll(async () => {
        for (const context of contexts) {
            await context.close();
        }
        contexts = [];
        pages = [];
    });

    test('setup game and save mid-progress', async () => {
        test.setTimeout(60000);
        const [p1, p2, p3] = pages;

        // Create lobby
        await step('Creating lobby...');
        await p1.goto('/');
        await waitForConnection(p1);
        await p1.getByRole('button', { name: 'Create Online Game' }).click();
        await expect(p1.locator('.lobby-code')).toBeVisible();
        savedLobbyCode = (await p1.locator('.lobby-code span').first().innerText()).trim();
        await step(`Lobby Code: ${savedLobbyCode}`);

        // Set names
        await p1.locator('.lobby-name-input').fill(playerNames[0]);
        await p1.locator('.lobby-name-input').press('Enter');

        // Join with other players
        for (let i = 1; i < 3; i++) {
            await pages[i].goto('/');
            await waitForConnection(pages[i]);
            await pages[i].getByPlaceholder('ABCDE').fill(savedLobbyCode);
            await pages[i].getByRole('button', { name: 'Join Online Game' }).click();
            await expect(pages[i].locator('.lobby-code')).toBeVisible();
            await pages[i].locator('.lobby-name-input').fill(playerNames[i]);
            await pages[i].locator('.lobby-name-input').press('Enter');
        }

        // Ready up
        await step('Readying up...');
        for (const page of pages) {
            await page.getByRole('button', { name: 'Ready Up' }).click();
        }

        // Start game
        await step('Starting game...');
        await p1.getByRole('button', { name: /Start Game/ }).click();

        // Quick setup - select packages and place tiles
        await step('Running quick setup...');
        // Valid tile placements similar to multiplayer test
        const validPlacements = [
            '1,0', '0,1', '1,-1',       // Package 1
            '-1,1', '-2,1', '-2,2',     // Package 2
            '1,-2', '0,-1',             // Package 3
            '0,-2', '-1,-1',            // Package 4
            '-3,1', '-3,2',             // Package 5
            '2,0', '0,2',               // Package 6
        ];
        let placementIndex = 0;
        let tradePhaseReached = false;
        let noProgressCount = 0;
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

            if (activePlayer === -1) {
                noProgressCount++;
                await p1.waitForTimeout(100);
                continue;
            }

            const page = pages[activePlayer];
            let madeProgress = false;

            // Try package selection
            const pkgBtn = page.locator('.package-card:not(.disabled) .select-button:not([disabled])').first();
            if (await pkgBtn.count() > 0) {
                try {
                    await pkgBtn.click({ timeout: 1000 });
                    await page.waitForTimeout(50);
                    madeProgress = true;
                    actionCount++;
                } catch { }
            }

            // Try clicking Pass/Continue button
            if (!madeProgress) {
                // Look for "Pass" or "Continue"
                const passBtn = page.getByRole('button', { name: /Pass|Continue/i }).filter({ hasNot: page.locator('[disabled]') }).first();
                if (await passBtn.count() > 0 && await passBtn.isVisible()) {
                    try {
                        await passBtn.click({ timeout: 1000 });
                        await page.waitForTimeout(50);
                        madeProgress = true;
                        actionCount++;
                    } catch { }
                }
            }

            // Try tile placement
            if (!madeProgress && placementIndex < validPlacements.length) {
                const cellId = validPlacements[placementIndex];
                try {
                    // Check if hex exists first to avoid waiting
                    const hex = page.getByTestId(`hex-${cellId}`);
                    if (await hex.count() > 0) {
                        await hex.click({ timeout: 300 });
                        await page.waitForTimeout(50);
                        madeProgress = true;
                        actionCount++;
                        placementIndex++;
                    } else {
                        placementIndex++;
                    }
                } catch {
                    placementIndex++;
                }
            }

            if (madeProgress) {
                noProgressCount = 0;
            } else {
                noProgressCount++;
                await p1.waitForTimeout(100);
            }

            if (actionCount > 200) break; // Safety break
        }

        // Wait for Trade phase
        // Wait for Trade phase
        await expect(p1.getByText('TRADE', { exact: true })).toBeVisible({ timeout: 10000 });
        await step('Now in Trade phase - ready to save');

        // Save game via UI button (host only)
        await step('Saving game...');

        // Host should see button
        await expect(p1.getByRole('button', { name: 'Save Game' })).toBeVisible();
        await p1.getByRole('button', { name: 'Save Game' }).click();

        // Verify success toast
        await expect(p1.locator('text=✅ Game saved successfully!')).toBeVisible();
        await step('Game saved successfully!');

        // Save code for next test
        console.log('Saved lobby code:', savedLobbyCode);
    });

    test('restore game with same code after disconnect', async ({ browser }) => {
        test.setTimeout(45000);

        // Leave game to clean up lobby on server (triggering persistent save check on next join)
        await step('Leaving game to cleanup lobby...');
        for (const page of pages) {
            // Try to leave from game screen (Leave Game) or lobby screen (Leave Lobby)
            const leaveGameBtn = page.getByRole('button', { name: 'Leave Game' });
            const leaveLobbyBtn = page.getByRole('button', { name: 'Leave Lobby' });

            if (await leaveGameBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await leaveGameBtn.click();
                // Confirm leave
                await page.getByRole('button', { name: 'Confirm' }).click();
                // Wait for return to landing page
                await expect(page.locator('.landing-container')).toBeVisible({ timeout: 10000 });
            } else if (await leaveLobbyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await leaveLobbyBtn.click();
                // Wait for return to landing page (no confirmation needed for lobby leave)
                await expect(page.locator('.landing-container')).toBeVisible({ timeout: 10000 });
            }
        }

        // Close all existing contexts
        await step('Closing browsers...');
        for (const context of contexts) {
            await context.close();
        }
        contexts = [];
        pages = [];

        // Wait for server to clean up
        await new Promise(r => setTimeout(r, 1000));

        // Create new browser contexts (simulating reconnection)
        await step('Reconnecting players...');
        for (let i = 0; i < 3; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            contexts.push(context);
            pages.push(page);
        }

        // First player joins with saved code
        const p1 = pages[0];
        await p1.goto('/');
        await waitForConnection(p1);
        await p1.getByPlaceholder('ABCDE').fill(savedLobbyCode);
        await p1.getByRole('button', { name: 'Join Online Game' }).click();

        // Should see Restore Lobby UI since we saved
        await step('Checking restore UI...');
        await expect(p1.locator('text=Restore Game')).toBeVisible({ timeout: 10000 });

        // Other players join
        for (let i = 1; i < 3; i++) {
            await pages[i].goto('/');
            await waitForConnection(pages[i]);
            await pages[i].getByPlaceholder('ABCDE').fill(savedLobbyCode);
            await pages[i].getByRole('button', { name: 'Join Online Game' }).click();
        }

        // Each player claims a seat
        // Note: Seat order in restore lobby matches the saved player order
        // We'll mimic players claiming their original seats (or any available)
        await step('Claiming seats...');
        for (let i = 0; i < 3; i++) {
            // Wait for seat list to populate (or game to start if all seats claimed)
            const claimBtn = pages[i].getByRole('button', { name: 'Claim' }).first();
            const tradePhase = pages[i].getByText('TRADE', { exact: true });

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
            await expect(pages[i].getByRole('button', { name: 'Unclaim' }).or(tradePhase)).toBeVisible({ timeout: 5000 });
        }

        // After all seats claimed, should transition to game
        await step('Waiting for game to resume...');
        await expect(pages[0].getByText('TRADE', { exact: true })).toBeVisible({ timeout: 10000 });
        await step('Successfully restored to game!');
    });
});
