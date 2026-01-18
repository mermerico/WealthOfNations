import { test, expect } from '@playwright/test';
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
 * E2E Test: Trade Counterproposal Flow
 * 
 * This test verifies that when Player B counters Player A's trade proposal:
 * 1. Player A sees the counterproposal modal (AcceptTradeModal)
 * 2. The modal correctly shows Player B as the proposer
 * 3. Player A can accept or reject the counterproposal
 */

let players: TestPlayer[] = [];
const playerNames = ['Alice', 'Bob', 'Charlie'];
const step = async (msg: string) => console.log(`[CounterProposal] ${msg}`);

test.describe.serial('trade counterproposal flow', () => {

    test.beforeAll(async ({ browser }) => {
        players = await createPlayers(browser, playerNames, { defaultTimeout: 5000 });
    });

    test.afterAll(async () => {
        await closePlayers(players);
        players = [];
    });

    test('setup game to trade phase', async () => {
        test.setTimeout(120000);

        await step('Creating and joining lobby...');
        await createAndJoinLobby(players, step);
        await readyUpAndStartGame(players, step);

        await step('Running setup phase...');
        await runSetupPhase(players, step);

        await step('Game ready for counterproposal test!');
    });

    test('counterproposal is visible to original proposer', async () => {
        test.setTimeout(60000);
        const pages = players.map(p => p.page);

        // ====== STEP 1: Find active player and their target ======
        const activeIdx = await findActivePlayer(players);
        expect(activeIdx).toBeGreaterThanOrEqual(0);

        const activePage = pages[activeIdx];
        const activeName = playerNames[activeIdx];
        const targetIdx = (activeIdx + 1) % 3;
        const targetPage = pages[targetIdx];
        const targetName = playerNames[targetIdx];

        await step(`Active player: ${activeName} (P${activeIdx + 1}), Target: ${targetName} (P${targetIdx + 1})`);

        // ====== STEP 2: Both players mark ready ======
        await step(`${activeName} marking ready...`);
        await activePage.getByTestId('trade-ready-button').click();

        await step(`${targetName} marking ready...`);
        await targetPage.getByTestId('trade-ready-button').click();

        // Wait for ready state to sync
        await expect(activePage.locator(`text=${targetName}`).filter({ hasText: '(Planning...)' })).not.toBeVisible({ timeout: 5000 });

        // ====== STEP 3: Active player proposes trade to target ======
        await step(`${activeName} proposing trade to ${targetName}...`);

        await activePage.getByTestId(`player-offer-button-${targetName}`).click();
        await activePage.getByTestId('trade-money-input-give').fill('10');
        await activePage.getByRole('button', { name: 'Propose Trade', exact: true }).click();

        // ====== STEP 4: Verify target sees the Accept modal ======
        await step(`Verifying ${targetName} sees trade proposal...`);
        await expect(targetPage.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 5000 });
        await expect(targetPage.getByTestId('counter-trade-button')).toBeVisible();

        // ====== STEP 5: Target clicks Counter button ======
        await step(`${targetName} clicking Counter button...`);
        await targetPage.getByTestId('counter-trade-button').click();

        // ====== STEP 6: Verify Counter Proposal modal appears for target ======
        await step(`Verifying ${targetName} sees Counter Proposal modal...`);
        await expect(targetPage.getByText(/Counter Proposal/)).toBeVisible({ timeout: 5000 });

        // ====== STEP 7: Target fills in counterproposal and sends it ======
        await step(`${targetName} filling in counterproposal...`);
        // Clear the prefilled value and enter new amount
        await targetPage.getByTestId('trade-money-input-give').fill('5');
        await targetPage.getByRole('button', { name: 'Propose Trade', exact: true }).click();

        // ====== STEP 8: CRITICAL ASSERTION - Original proposer sees counterproposal modal ======
        await step(`CRITICAL: Verifying ${activeName} sees the counterproposal modal...`);

        // The original proposer (activePage) should now see the AcceptTradeModal
        // because they are now the TARGET of the counterproposal
        await expect(activePage.getByRole('button', { name: 'Accept' })).toBeVisible({
            timeout: 10000
        });

        await step(`SUCCESS: ${activeName} sees Accept button!`);

        // Verify modal has From: label (proposer info)
        await expect(activePage.getByText(/From:/)).toBeVisible();

        // ====== STEP 9: Original proposer accepts the counterproposal ======
        await step(`${activeName} accepting the counterproposal...`);
        await activePage.getByRole('button', { name: 'Accept' }).click();

        // Modal should close
        await expect(activePage.getByRole('button', { name: 'Accept' })).not.toBeVisible({ timeout: 5000 });

        await step('Counterproposal flow completed successfully!');
    });
});
