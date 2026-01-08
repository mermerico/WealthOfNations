import { expect, type Page, type BrowserContext, type Browser } from '@playwright/test';

/**
 * Shared test helpers for E2E tests.
 * Provides common utilities for lobby setup, game initialization, and player management.
 */

export interface TestPlayer {
    context: BrowserContext;
    page: Page;
    name: string;
}

export type StepLogger = (msg: string) => Promise<void>;

/**
 * Wait for WebSocket connection to be established
 */
export async function waitForConnection(page: Page): Promise<void> {
    await expect(page.locator('text=Online services available')).toBeVisible({ timeout: 10000 });
}

/**
 * Find which player is currently active (not waiting for their turn)
 */
export async function findActivePlayer(players: TestPlayer[]): Promise<number> {
    const pages = players.map(p => p.page);
    await pages[0].waitForTimeout(5);

    // Strategy 1: Check Control Panel for Active Player Name
    try {
        const activeNameElement = pages[0].getByTestId('active-player-name');
        if (await activeNameElement.count() > 0) {
            const activeName = (await activeNameElement.innerText()).trim();
            const index = players.findIndex(p => p.name === activeName);
            if (index !== -1) return index;
        }
    } catch (e) {
        console.log('Error reading active player from control panel:', e);
    }

    return -1;
}

/**
 * Create browser contexts and pages for multiple players
 */
export async function createPlayers(
    browser: Browser,
    playerNames: string[],
    options?: { defaultTimeout?: number; logE2ERecords?: boolean }
): Promise<TestPlayer[]> {
    const players: TestPlayer[] = [];
    const timeout = options?.defaultTimeout ?? 2000;

    for (let i = 0; i < playerNames.length; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(timeout);

        if (options?.logE2ERecords !== false) {
            page.on('console', msg => {
                if (msg.text().includes('E2E_RECORD')) {
                    console.log(`[${playerNames[i]}] ${msg.text()}`);
                }
            });
        }

        players.push({ context, page, name: playerNames[i] });
    }

    return players;
}

/**
 * Close all player contexts
 */
export async function closePlayers(players: TestPlayer[]): Promise<void> {
    for (const player of players) {
        await player.context.close();
    }
}

/**
 * Create a lobby and have all players join
 * Returns the lobby code
 */
export async function createAndJoinLobby(
    players: TestPlayer[],
    step?: StepLogger
): Promise<string> {
    const log = step ?? (async (msg: string) => console.log(`[Setup] ${msg}`));
    const [host, ...guests] = players;

    // Host creates lobby
    await log('Creating lobby...');
    await host.page.goto('/');
    await waitForConnection(host.page);
    await host.page.getByRole('button', { name: 'Create Online Game' }).click();
    await expect(host.page.locator('.lobby-code')).toBeVisible();
    const lobbyCode = (await host.page.getByTestId('lobby-code').innerText()).trim();
    await log(`Lobby Code: ${lobbyCode}`);
    await host.page.locator('.lobby-name-input').fill(host.name);
    await host.page.locator('.lobby-name-input').press('Enter');

    // Guests join
    for (const guest of guests) {
        await guest.page.goto('/');
        await waitForConnection(guest.page);
        await guest.page.getByPlaceholder('ABCDE').fill(lobbyCode);
        await guest.page.getByRole('button', { name: 'Join Online Game' }).click();
        await expect(guest.page.locator('.lobby-code')).toBeVisible();
        await guest.page.locator('.lobby-name-input').fill(guest.name);
        await guest.page.locator('.lobby-name-input').press('Enter');
    }

    return lobbyCode;
}

/**
 * Ready up all players and start the game (host starts)
 */
export async function readyUpAndStartGame(
    players: TestPlayer[],
    step?: StepLogger
): Promise<void> {
    const log = step ?? (async (msg: string) => console.log(`[Setup] ${msg}`));
    const [host, ...guests] = players;

    await log('Readying up...');
    for (const player of players) {
        await player.page.getByTestId('lobby-ready-button').click();
    }

    await log('Starting game...');
    await expect(host.page.getByTestId('lobby-start-button')).toBeEnabled();
    await host.page.getByTestId('lobby-start-button').click();
}

/**
 * Run through the setup phase (package selection and tile placement) until Trade phase
 * Uses a fast, reliable approach with predefined valid placements
 */
export async function runSetupPhase(
    players: TestPlayer[],
    step?: StepLogger
): Promise<void> {
    const log = step ?? (async (msg: string) => console.log(`[Setup] ${msg}`));
    const pages = players.map(p => p.page);

    await log('Running setup phase...');
    await pages[0].waitForTimeout(100);

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

    let tradePhaseReached = false;
    let noProgressCount = 0;
    let actionCount = 0;

    while (!tradePhaseReached && noProgressCount < 40) {
        // Check for Trade phase
        for (const page of pages) {
            if (await page.getByTestId('phase-display').filter({ hasText: 'TRADE' }).count() > 0) {
                tradePhaseReached = true;
                break;
            }
        }
        if (tradePhaseReached) break;

        const activePlayer = await findActivePlayer(players);

        if (activePlayer === -1) {
            noProgressCount++;
            await pages[0].waitForTimeout(10);
            continue;
        }

        const page = pages[activePlayer];
        let madeProgress = false;

        // Try package selection
        const pkgBtn = page.getByTestId(/package-select-button-.+/).filter({ hasNot: page.locator('[disabled]') }).first();
        if (await pkgBtn.count() > 0) {
            await pkgBtn.click({ timeout: 2000 });
            await page.waitForTimeout(10);
            madeProgress = true;
            actionCount++;
        }

        // Try clicking Pass/Continue button
        if (!madeProgress) {
            const passBtn = page.getByTestId('setup-pass-button').filter({ hasNot: page.locator('[disabled]') });
            if (await passBtn.count() > 0 && await passBtn.isEnabled()) {
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
            throw new Error('Too many actions without reaching Trade phase');
        }
    }

    if (!tradePhaseReached) {
        throw new Error('Failed to reach Trade phase');
    }

    await log('Setup phase complete - Trade Phase Reached!');
}

/**
 * Full game initialization: create lobby, join, ready up, start game, complete setup phase
 * Returns the lobby code
 */
export async function initializeGameToTradePhase(
    players: TestPlayer[],
    step?: StepLogger
): Promise<string> {
    const lobbyCode = await createAndJoinLobby(players, step);
    await readyUpAndStartGame(players, step);
    await runSetupPhase(players, step);
    return lobbyCode;
}
