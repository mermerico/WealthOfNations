import { test, expect } from '@playwright/test';
import { createPlayers, closePlayers, waitForConnection } from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';

// Use a random code to avoid collisions
const LOBBY_CODE = Math.random().toString(36).substring(2, 7).toUpperCase();

test.describe('Bank Production E2E', () => {
    let players: any[] = [];
    let saveFilePath: string;

    test.beforeAll(async () => {
        const rootDir = process.cwd();
        const saveDir = path.join(rootDir, 'server', 'saves');
        saveFilePath = path.join(saveDir, `${LOBBY_CODE}.json`);

        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const mockSave = {
            version: 1,
            savedAt: new Date().toISOString(),
            lobbyCode: LOBBY_CODE,
            gameState: {
                players: [
                    { id: 'p1', name: 'Alice', color: '#3b82f6', resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }, money: 100, loans: 0, flags: 16, ready: true, flag: 'anglica.svg', hasPassed: false, hasProduced: false },
                    { id: 'p2', name: 'Bob', color: '#ef4444', resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }, money: 100, loans: 0, flags: 18, ready: true, flag: 'bolshevica.svg', hasPassed: false, hasProduced: false },
                    { id: 'p3', name: 'Charlie', color: '#10b981', resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 }, money: 100, loans: 0, flags: 18, ready: true, flag: 'bharat.svg', hasPassed: false, hasProduced: false }
                ],
                board: {
                    "0,0": {
                        q: 0, r: 0,
                        occupant: {
                            type: "Industry",
                            playerId: "p1",
                            tile: { id: "0,0", type: "Bank", ownerId: "p1", orientation: 0, active: true, automated: false }
                        }
                    },
                    "1,-1": {
                        q: 1, r: -1,
                        occupant: {
                            type: "Industry",
                            playerId: "p1",
                            tile: { id: "1,-1", type: "Bank", ownerId: "p1", orientation: 3, active: true, automated: false }
                        }
                    }
                },
                markets: {
                    Food: { stock: 4, priceIndex: 4 },
                    Energy: { stock: 4, priceIndex: 4 },
                    Labor: { stock: 4, priceIndex: 4 },
                    Ore: { stock: 4, priceIndex: 4 },
                    Capital: { stock: 4, priceIndex: 4 }
                },
                phase: 'Produce',
                currentTurnPlayerIndex: 0,
                firstPlayerIndex: 0,
                round: 1,
                consecutivePasses: 0,
                tilesRemaining: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 7 },
                initialFlagsPerPlayer: 18,
                initialTiles: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
                settings: { promissoryNoteInterestFees: false },
                logs: []
            }
        };

        fs.writeFileSync(saveFilePath, JSON.stringify(mockSave, null, 2));
    });

    test.afterAll(async () => {
        await closePlayers(players);
        if (saveFilePath && fs.existsSync(saveFilePath)) {
            fs.unlinkSync(saveFilePath);
            console.log(`[TestCleanup] Deleted save: ${saveFilePath}`);
        }
    });

    test('should display bank output as dollars', async ({ browser }) => {
        test.setTimeout(180000);

        players = await createPlayers(browser, ['Alice', 'Bob', 'Charlie']);
        const alicePage = players[0].page;

        // 1. Join
        for (const player of players) {
            await player.page.goto('/');
            await waitForConnection(player.page);
            await player.page.getByPlaceholder('ABCDE').fill(LOBBY_CODE);
            await player.page.getByRole('button', { name: 'Join Online Game' }).click();
        }

        // 2. Claim seats
        for (let i = 0; i < 3; i++) {
            const p = players[i].page;
            // Wait for restore UI to be visible
            try {
                await expect(p.locator('h1:has-text("Restore Game")')).toBeVisible({ timeout: 20000 });
                console.log(`[Player ${i + 1}] Restore screen visible`);
                await p.getByRole('button', { name: 'Claim' }).first().click();
                console.log(`[Player ${i + 1}] Claimed seat`);
            } catch (err) {
                const errorMsg = await p.locator('.landing-error').innerText().catch(() => 'no error visible');
                console.error(`[Player ${i + 1}] Failed to find restore screen. Error in UI: ${errorMsg}`);
                throw err;
            }
        }

        // 3. Wait for Produce phase
        await expect(alicePage.getByTestId('phase-display')).toContainText('PRODUCE', { timeout: 30000 });

        // Power the bank bloc
        const bankBloc = alicePage.getByTestId('bloc-config-item');
        await expect(bankBloc).toBeVisible();
        const powerCheckbox = bankBloc.locator('input[type="checkbox"]').first();
        if (!(await powerCheckbox.isChecked())) {
            await powerCheckbox.click();
        }

        // Verify net production shows dollars
        const netProduction = alicePage.getByTestId('net-production-summary');
        await expect(netProduction).toContainText('Producing: $30');

        // Verify bloc summary shows dollars
        const blocSummary = bankBloc.locator('div', { hasText: 'Producing:' }).last();
        await expect(blocSummary).toContainText('Producing: $30');

        // Run production
        console.log('[Alice] Clicking Run Production...');
        await alicePage.getByTestId('run-production-button').click();
        const modalContent = alicePage.getByTestId('modal-content');
        await expect(modalContent).toBeVisible();

        // Verify output in modal
        await expect(modalContent).toContainText('Producing: $30');

        await alicePage.getByTestId('modal-confirm-button').click();

        // Verify confirmed
        await expect(alicePage.getByTestId('production-confirmed-indicator')).toBeVisible({ timeout: 15000 });
        console.log('[Alice] Production confirmed locally');
        await expect(alicePage.getByTestId('produced-badge-Alice')).toBeVisible({ timeout: 10000 });
        console.log('[Alice] Production confirmed on Roster');

        // 6. Have Bob and Charlie produce (sequentially)
        for (let i = 1; i < 3; i++) {
            const p = players[i].page;
            const name = players[i].name;
            const isLastPlayer = i === 2;

            console.log(`Waiting for ${name}'s turn to produce...`);
            await expect(p.getByTestId(`turn-badge-${name}`)).toBeVisible({ timeout: 10000 });

            await p.getByTestId('run-production-button').click();
            await expect(p.getByTestId('modal-content')).toBeVisible();
            await p.getByTestId('modal-confirm-button').click();

            if (!isLastPlayer) {
                await expect(p.getByTestId('production-confirmed-indicator')).toBeVisible({ timeout: 15000 });
                await expect(p.getByTestId(`produced-badge-${name}`)).toBeVisible({ timeout: 10000 });
                console.log(`[${name}] Production confirmed`);
            } else {
                console.log(`[${name}] Last player confirmed, waiting for phase transition...`);
            }
        }

        // Verify Alice's money increased by $30
        const aliceCard = alicePage.getByTestId('player-roster-card-Alice');
        await expect(aliceCard.getByTestId('player-money')).toHaveText('$130', { timeout: 15000 });
        console.log('Bank production E2E successful!');
    });
});
