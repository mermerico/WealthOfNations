import { test, expect } from '@playwright/test';
import {
    type TestPlayer,
    createPlayers,
    closePlayers,
    findActivePlayer,
} from './test-helpers';
import {
    generateLobbyCode,
    createMockSaveFile,
    deleteMockSaveFile,
    getBaseTradeState,
    joinAndClaimSeats
} from './save-test-utils';

/**
 * E2E Test: Trade Counterproposal Flow (Optimized)
 * 
 * Verifies the counterproposal modal flow using a pre-configured save file.
 */

let players: TestPlayer[] = [];
let savePath: string = '';
const playerNames = ['Alice', 'Bob', 'Charlie'];
const LOBBY_CODE = generateLobbyCode('CP');
const step = async (msg: string) => console.log(`[CounterProposal] ${msg}`);

test.describe('trade counterproposal flow', () => {

    test.beforeAll(async ({ browser }) => {
        players = await createPlayers(browser, playerNames, { defaultTimeout: 5000 });

        // Initialize game state in Trade phase
        const gameState = getBaseTradeState(playerNames);
        savePath = createMockSaveFile(LOBBY_CODE, gameState);
    });

    test.afterAll(async () => {
        await closePlayers(players);
        deleteMockSaveFile(savePath);
        players = [];
    });

    test('counterproposal is visible to original proposer', async () => {
        test.setTimeout(60000);

        await step('Joining lobby and claiming seats...');
        await joinAndClaimSeats(players, LOBBY_CODE, step);

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
        await expect(activePage.locator(`text=${targetName}`).filter({ hasText: '(Planning...)' })).not.toBeVisible({ timeout: 10000 });

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
