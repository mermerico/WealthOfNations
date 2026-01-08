import { test, expect, type Page } from '@playwright/test';
import {
    type TestPlayer,
    createPlayers,
    closePlayers,
    waitForConnection
} from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Legacy Save Compatibility E2E Test
 * 
 * Verifies that the server and client can gracefully handle loading
 * an old save file that is missing the 'tradeIntents' property.
 */

const SAVE_DIR = path.join(process.cwd(), 'server', 'saves');

// Use unique 5-char code to match game constraints and avoid parallel collisions
const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
const LEGACY_LOBBY_CODE = generateCode();
const LEGACY_FILE_PATH = path.join(SAVE_DIR, `${LEGACY_LOBBY_CODE}.json`);

test.describe.serial('legacy save compatibility', () => {
    let players: TestPlayer[] = [];

    test.beforeAll(async () => {
        // Ensure saves directory exists
        if (!fs.existsSync(SAVE_DIR)) {
            fs.mkdirSync(SAVE_DIR, { recursive: true });
        }

        // Create a mock legacy save file (missing tradeIntents)
        const mockLegacySave = {
            version: '1.0.0',
            savedAt: new Date().toISOString(),
            lobbyCode: LEGACY_LOBBY_CODE,
            gameState: {
                players: [
                    { id: 'p1', name: 'LegacyP1', resources: { Food: 5, Energy: 5, Labor: 5, Ore: 5, Capital: 5 }, money: 50, loans: 0, flags: 18, ready: false, flag: 'anglica.svg' },
                    { id: 'p2', name: 'LegacyP2', resources: { Food: 5, Energy: 5, Labor: 5, Ore: 5, Capital: 5 }, money: 50, loans: 0, flags: 18, ready: false, flag: 'bolshevica.svg' },
                    { id: 'p3', name: 'LegacyP3', resources: { Food: 5, Energy: 5, Labor: 5, Ore: 5, Capital: 5 }, money: 50, loans: 0, flags: 18, ready: false, flag: 'bharat.svg' }
                ],
                board: {}, // Empty board for simplicity
                markets: {
                    Food: { stock: 4, priceIndex: 4 },
                    Energy: { stock: 3, priceIndex: 4 },
                    Labor: { stock: 6, priceIndex: 4 },
                    Ore: { stock: 2, priceIndex: 4 },
                    Capital: { stock: 5, priceIndex: 4 }
                },
                phase: 'Trade', // Start in Trade phase to test tradeIntents
                round: 1,
                currentTurnPlayerIndex: 0,
                firstPlayerIndex: 0,
                tilesRemaining: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
                initialFlagsPerPlayer: 18,
                initialTiles: { Farm: 10, Generator: 10, Academy: 10, Mine: 10, Factory: 10, Bank: 10 },
                consecutivePasses: 0,
                isLastRound: false,
                gameEnded: false,
                settings: { promissoryNoteInterestFees: false }
                // CRITICAL: tradeIntents is intentionally OMITTED here
            }
        };

        fs.writeFileSync(LEGACY_FILE_PATH, JSON.stringify(mockLegacySave, null, 2), 'utf-8');
        console.log(`[LegacyTest] Created legacy save file at ${LEGACY_FILE_PATH}`);
    });

    test.afterAll(async () => {
        await closePlayers(players);
        // Clean up the mock save file
        if (fs.existsSync(LEGACY_FILE_PATH)) {
            fs.unlinkSync(LEGACY_FILE_PATH);
            console.log(`[LegacyTest] Removed legacy save file`);
        }
    });

    test('should load legacy save and handle missing tradeIntents gracefully', async ({ browser }) => {
        test.setTimeout(60000);

        const playerNames = ['LegacyP1', 'LegacyP2', 'LegacyP3'];

        // Connect players to the lobby using the legacy code (this triggers restore flow)
        // We use createPlayers but need to manually navigate to join the specific lobby
        // Actually, createPlayers goes to home. Let's do the join flow manually.

        // 1. Launch browsers
        players = await createPlayers(browser, playerNames, { defaultTimeout: 5000 });


        const p1 = players[0].page;

        // 2. Player 1 joins with LEGACY code
        await p1.goto('/');
        await waitForConnection(p1);
        await p1.getByPlaceholder('ABCDE').fill(LEGACY_LOBBY_CODE);
        await p1.getByRole('button', { name: 'Join Online Game' }).click();

        // 3. Verify Restore UI appears
        await expect(p1.locator('text=Restore Game')).toBeVisible({ timeout: 10000 });
        console.log('[LegacyTest] Restore UI visible');

        // 4. Have other players join
        for (let i = 1; i < 3; i++) {
            const p = players[i].page;
            await p.goto('/');
            await waitForConnection(p);
            await p.getByPlaceholder('ABCDE').fill(LEGACY_LOBBY_CODE);
            await p.getByRole('button', { name: 'Join Online Game' }).click();
        }

        // 5. Claim seats (LegacyP1 claims index 0, etc.)
        for (let i = 0; i < 3; i++) {
            const p = players[i].page;
            // Wait for seat list
            const claimBtn = p.getByRole('button', { name: 'Claim' }).nth(i);
            // Warning: indexing by nth might be flaky if order varies, but restore lists usually stable.
            // Better: Claim the seat that matches the name?
            // The saved names are LegacyP1, P2, P3. The restore UI shows them.
            // We can search for the row containing the name, then click claim.

            // Simple approach: Click the first available Claim button
            // Note: After claiming, the button becomes 'Unclaim', so the next available 'Claim' button is always at index 0
            await p.getByRole('button', { name: 'Claim' }).first().click();

            // For the last player, the game starts immediately, so "Unclaim" won't be visible.
            if (i < players.length - 1) {
                await expect(p.getByRole('button', { name: 'Unclaim' })).toBeVisible();
            }
            console.log(`[LegacyTest] Player ${i + 1} claimed seat`);
        }

        // 6. Wait for game to start (Trade phase)
        await expect(p1.getByTestId('phase-display').filter({ hasText: 'TRADE' })).toBeVisible({ timeout: 10000 });
        console.log('[LegacyTest] Game started in Trade phase');

        // 7. Test interaction that uses tradeIntents: "Mark Ready"
        // Open Trade Action Panel if not already visible (it should be in Trade phase)

        // P1 Marks Ready
        await p1.getByTestId('trade-ready-button').click();

        // Verify it changed to "Ready" and green style
        const readyBtn = p1.getByTestId('trade-ready-button');
        await expect(readyBtn).toHaveText(/Ready/i);

        // Verify via P2 that P1 is ready
        // P2 should see P1's status update in the "Other Player Needs" list
        // Note: TradeActionPanel logic: "Ready" text or visual indicator
        // Our mock players don't have distinct visual rows easily targeted by testid yet, 
        // but let's verify no crash and local update at minimum.
        console.log('[LegacyTest] P1 marked ready successfully');

        // 8. Test modifying needs and verifying deltas
        // P1 has 5 Food. Increase need to 7. Delta should be +2 (Buying 2)
        // Find the plus button for Food
        const p2 = players[1].page;
        await p1.getByTestId('inventory-plus-Food').click();
        await p1.getByTestId('inventory-plus-Food').click();

        // Verify local delta display
        await expect(p1.getByTestId('inventory-delta-Food')).toHaveText('2');

        // 9. Verify P1's deltas are visible to P2
        // Find P1's offer card in P2's view
        const p1OfferCard = p2.getByTestId('player-offer-button-LegacyP1');
        await expect(p1OfferCard).toBeVisible();

        // Within that card, find the Food item
        // We added data-testid={`offer-item-${c}`}
        const p1FoodOffer = p1OfferCard.getByTestId('offer-item-Food');
        await expect(p1FoodOffer).toContainText('2'); // Should show the delta magnitude

        console.log('[LegacyTest] Verified resource deltas and remote sync');


        // Success!
    });
});
