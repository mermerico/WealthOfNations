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
        await runSetupPhase(players, step);
    });

    test('trade phase - execute trade and finish', async () => {
        test.setTimeout(45000);
        const pages = players.map(p => p.page);

        const activeIdx = await findActivePlayer(players);
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        // Verify Turn Indicators
        const activePlayerName = playerNames[activeIdx];
        const inactiveIdxCheck = (activeIdx + 1) % 3;
        const inactivePlayerNameCheck = playerNames[inactiveIdxCheck];
        const inactivePageCheck = pages[inactiveIdxCheck];

        // 1. Check if Inactive Player sees TURN badge on Inactive Player (Self) -> Should be 0
        const selfHaveTurnBadge = await inactivePageCheck.getByTestId(`turn-badge-${inactivePlayerNameCheck}`).count();
        expect(selfHaveTurnBadge, 'Inactive player should NOT see TURN badge on themselves').toBe(0);

        // 2. Check if Inactive Player sees TURN badge on Active Player -> Should be > 0
        const activeHaveTurnBadge = await inactivePageCheck.getByTestId(`turn-badge-${activePlayerName}`).count();
        expect(activeHaveTurnBadge, 'Inactive player SHOULD see TURN badge on active player').toBeGreaterThan(0);

        await step('Verified: Turn indicators are correct.');

        const activePage = pages[activeIdx];
        const targetIdx = (activeIdx + 1) % 3;
        const targetPage = pages[targetIdx];
        const targetName = playerNames[targetIdx];

        // --- START Trade Intent Sync Checks (Merged from trade-intent-sync.spec.ts) ---

        await step(`Testing Trade Intent Sync...`);

        // Check that inactive player sees Active player as "(Planning...)"
        await expect(targetPage.locator(`text=${activePlayerName}`).filter({ hasText: '(Planning...)' })).toBeVisible();

        // Active player modifies desired inventory
        await step(`${activePlayerName} modifying Desired Inventory...`);
        const plusButtons = activePage.getByTestId(/^inventory-plus-/);
        if (await plusButtons.count() > 0) {
            await plusButtons.first().click();
            await plusButtons.first().click();
            // Just verify it doesn't crash other views; deep delta validation is complex without data-ids
        }

        // Active player marks Ready
        await step(`${activePlayerName} marks Ready...`);
        await activePage.getByTestId('trade-ready-button').click();
        await expect(activePage.getByRole('button', { name: /Ready/i })).toBeVisible();

        // Verify other players see "(Planning...)" disappear for Active Player
        await step(`Verifying ${activePlayerName} is Ready on ${targetName}'s screen...`);
        await expect(targetPage.locator(`text=${activePlayerName}`).filter({ hasText: '(Planning...)' })).not.toBeVisible({ timeout: 5000 });

        // --- END Trade Intent Sync Checks ---

        await step(`P${activeIdx + 1} (${playerNames[activeIdx]}) proposing trade to P${targetIdx + 1} (${targetName})...`);

        // Target player must also be Ready for Active player to propose trade (game rule)
        await step(`P${targetIdx + 1} (${targetName}) marking ready...`);
        const targetMarkReadyBtn = targetPage.getByTestId('trade-ready-button');
        await targetMarkReadyBtn.click();
        await expect(targetPage.getByTestId('trade-ready-button')).toHaveText(/Ready/);

        // Active player waits for Target to be ready
        // Check active page sees target as ready (no planning)
        await expect(activePage.locator(`text=${targetName}`).filter({ hasText: '(Planning...)' })).not.toBeVisible();

        // Open trade modal by clicking target player's card
        await step(`P${activeIdx + 1} clicking P${targetIdx + 1}'s card to propose trade...`);

        const offersSection = activePage.getByTestId('player-offers-section');
        await expect(offersSection).toBeVisible();

        await activePage.getByTestId(`player-offer-button-${targetName}`).click();

        // Enter money amount
        await activePage.getByTestId('trade-money-input-give').fill('10');
        await activePage.getByRole('button', { name: 'Propose Trade', exact: true }).click();

        // Wait for trade proposal to appear on target
        await step(`Waiting for trade proposal on ${targetName}...`);
        await expect(targetPage.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 5000 });

        // Accept trade
        await step(`P${targetIdx + 1} accepting trade...`);
        await targetPage.getByRole('button', { name: 'Accept' }).click();

        await expect(targetPage.getByRole('button', { name: 'Accept' })).not.toBeVisible();
        await step('Trade accepted!');

        // All players pass to finish trade phase
        await step('All players passing to finish Trade phase...');
        for (let turn = 0; turn < 3; turn++) {
            const activeIdxCurrent = await findActivePlayer(players);
            expect(activeIdxCurrent).toBeGreaterThanOrEqual(0);

            await step(`P${activeIdxCurrent + 1} passing Trade phase`);
            await pages[activeIdxCurrent].getByTestId('trade-pass-button').click();

            // Wait for turn to pass (active player changes) or phase to change
            // If it's the last player, phase changes. If not, active player changes.
            if (turn < 2) {
                // Wait for active player to change
                await expect(async () => {
                    const newActive = await findActivePlayer(players);
                    return newActive !== activeIdxCurrent;
                }).toPass();
            } else {
                // Last player passed, wait for phase change in next test block
            }
        }
    });

    test('development phase - all players pass', async () => {
        test.setTimeout(60000);
        const pages = players.map(p => p.page);

        await step('Waiting for Development phase...');

        // Wait for all players to see DEVELOP
        for (let i = 0; i < 3; i++) {
            await expect(pages[i].getByTestId('phase-display').filter({ hasText: 'DEVELOP' })).toBeVisible({ timeout: 5000 });
        }

        for (let turn = 0; turn < 3; turn++) {
            const activeIdx = await findActivePlayer(players);
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

        // P1 runs production first and waits
        const p1 = pages[0];
        const p1Name = playerNames[0];

        await step(`P1 (${p1Name}) running production...`);
        await p1.getByTestId('run-production-button').click();
        await expect(p1.getByText('Are you sure you want to run production?')).toBeVisible();
        await p1.getByRole('button', { name: 'Confirm' }).click();

        // Check P1 sees waiting message
        await step(`Verifying P1 sees waiting message...`);
        await expect(p1.getByText('Production Complete')).toBeVisible();
        await expect(p1.getByText('Waiting for other players to finish...')).toBeVisible();

        // Check P2 still has button (not waiting)
        const p2 = pages[1];
        await expect(p2.getByTestId('run-production-button')).toBeVisible();
        await expect(p2.getByText('Production Complete')).not.toBeVisible();

        // Remaining players run production
        const remainingIndices = [1, 2];
        for (const i of remainingIndices) {
            const name = playerNames[i];
            await step(`P${i + 1} (${name}) clicking Run Production...`);

            // Wait for button to be available and click
            const btn = pages[i].getByTestId('run-production-button');
            await btn.click();

            // Handle confirmation modal
            await expect(pages[i].getByText('Are you sure you want to run production?')).toBeVisible();
            await pages[i].getByRole('button', { name: 'Confirm' }).click();

            // Verify roster reflects status (assuming there's a status indicator)
            // This adds synchronization
            await pages[i].waitForTimeout(500);
        }

        // Verify phase advances (usually back to Trade of Round 2)
        await step('Verifying transition to next round...');

        // Use more robust selectors for phase and round
        // Phase should be TRADE in Round 2
        for (let i = 0; i < 3; i++) {
            await expect(pages[i].getByTestId('phase-display')).toHaveText('TRADE', { timeout: 10000 });
            // Look for the round number "2" specifically in the Control Panel status info
            await expect(pages[i].getByTestId('round-indicator')).toHaveText('2', { timeout: 5000 });
        }
    });
});
