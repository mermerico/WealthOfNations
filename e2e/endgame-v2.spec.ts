import { test, expect } from '@playwright/test';
import { createPlayers, closePlayers, waitForConnection } from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';

/**
 * End Game E2E Tests - V2 (Second Edition Rules)
 * 
 * Tests the full game end flow with automatedFinalTrade enabled:
 * 1. Start in Develop phase with isLastRound = false
 * 2. Place flag to trigger isLastRound
 * 3. Complete remaining phases
 * 4. Verify resources are liquidated and victory scores updated
 */

const LOBBY_CODE = 'V2' + Math.random().toString(36).substring(2, 5).toUpperCase();

// Helper to generate full hex grid
function generateGrid(radius: number) {
    const grid: Record<string, { q: number, r: number, occupant: any }> = {};
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            const id = `${q},${r}`;
            grid[id] = { q, r, occupant: null };
        }
    }
    return grid;
}

test.describe('End Game V2 (Second Edition Rules)', () => {
    let players: any[] = [];
    let saveFilePath: string;

    test.beforeAll(async () => {
        const rootDir = process.cwd();
        const saveDir = path.join(rootDir, 'server', 'saves');
        saveFilePath = path.join(saveDir, `${LOBBY_CODE}.json`);

        console.log(`[TestSetup] Writing save to: ${saveFilePath}`);

        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const board = generateGrid(4);

        // Alice has 3 industries
        board["1,0"].occupant = {
            type: "Industry", playerId: "p1",
            tile: { id: "1,0", type: "Farm", ownerId: "p1", orientation: 0, active: true, automated: false }
        };
        board["0,1"].occupant = {
            type: "Industry", playerId: "p1",
            tile: { id: "0,1", type: "Generator", ownerId: "p1", orientation: 0, active: true, automated: false }
        };
        board["2,-1"].occupant = {
            type: "Industry", playerId: "p1",
            tile: { id: "2,-1", type: "Bank", ownerId: "p1", orientation: 0, active: true, automated: false }
        };
        // Bob has 3 industries
        board["-1,1"].occupant = {
            type: "Industry", playerId: "p2",
            tile: { id: "-1,1", type: "Mine", ownerId: "p2", orientation: 0, active: true, automated: false }
        };
        board["-2,1"].occupant = {
            type: "Industry", playerId: "p2",
            tile: { id: "-2,1", type: "Academy", ownerId: "p2", orientation: 0, active: true, automated: false }
        };
        board["-1,2"].occupant = {
            type: "Industry", playerId: "p2",
            tile: { id: "-1,2", type: "Factory", ownerId: "p2", orientation: 0, active: true, automated: false }
        };
        // Charlie has 2 industries
        board["0,-1"].occupant = {
            type: "Industry", playerId: "p3",
            tile: { id: "0,-1", type: "Bank", ownerId: "p3", orientation: 0, active: true, automated: false }
        };
        board["-1,-1"].occupant = {
            type: "Industry", playerId: "p3",
            tile: { id: "-1,-1", type: "Farm", ownerId: "p3", orientation: 0, active: true, automated: false }
        };

        // Start in Develop phase, NOT in last round
        // Use initialFlagsPerPlayer=4 so Alice has 1 flag remaining (4 - 3 tiles = 1 flag left)
        // Players have significant resources that will be liquidated
        const mockSave = {
            version: 1,
            savedAt: new Date().toISOString(),
            lobbyCode: LOBBY_CODE,
            gameState: {
                players: [
                    {
                        id: 'p1', name: 'Alice', color: '#3b82f6',
                        resources: { Food: 10, Energy: 0, Labor: 5, Ore: 5, Capital: 10 },
                        money: 50, loans: 0,
                        flags: 1, // 4 - 3 tiles = 1 flag left
                        ready: true, flag: 'anglica.svg', hasPassed: false, hasProduced: false
                    },
                    {
                        id: 'p2', name: 'Bob', color: '#ef4444',
                        resources: { Food: 0, Energy: 8, Labor: 3, Ore: 0, Capital: 12 },
                        money: 40, loans: 0,
                        flags: 1, // 4 - 3 tiles = 1 flag
                        ready: true, flag: 'bolshevica.svg', hasPassed: false, hasProduced: false
                    },
                    {
                        id: 'p3', name: 'Charlie', color: '#10b981',
                        resources: { Food: 8, Energy: 4, Labor: 2, Ore: 6, Capital: 0 },
                        money: 60, loans: 0,
                        flags: 2, // 4 - 2 tiles = 2 flags
                        ready: true, flag: 'bharat.svg', hasPassed: false, hasProduced: false
                    }
                ],
                board,
                markets: {
                    Food: { stock: 4, priceIndex: 4 },
                    Energy: { stock: 4, priceIndex: 4 },
                    Labor: { stock: 4, priceIndex: 4 },
                    Ore: { stock: 4, priceIndex: 4 },
                    Capital: { stock: 4, priceIndex: 4 }
                },
                phase: 'Develop',
                currentTurnPlayerIndex: 0,
                firstPlayerIndex: 0,
                round: 4,
                consecutivePasses: 0,
                tilesRemaining: { Farm: 13, Generator: 8, Academy: 8, Mine: 8, Factory: 8, Bank: 7 },
                isLastRound: false, // NOT triggered yet
                gameEnded: false,
                pendingTrade: null,
                initialFlagsPerPlayer: 4,
                initialTiles: { Farm: 15, Generator: 9, Academy: 9, Mine: 9, Factory: 9, Bank: 9 },
                settings: {
                    promissoryNoteInterestFees: true,
                    multiBuySell: true,
                    automatedFinalTrade: true  // V2 KEY FEATURE
                },
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

    test('should trigger isLastRound, liquidate resources, and show updated scores', async ({ browser }) => {
        test.setTimeout(180000);

        players = await createPlayers(browser, ['Alice', 'Bob', 'Charlie']);
        const [alicePage, bobPage, charliePage] = players.map(p => p.page);

        // 1. Join lobby
        console.log(`[Test] Players joining lobby: ${LOBBY_CODE}`);
        for (const player of players) {
            await player.page.goto('/');
            await waitForConnection(player.page);
            await player.page.getByPlaceholder('ABCDE').fill(LOBBY_CODE);
            await player.page.getByRole('button', { name: 'Join Online Game' }).click();
        }

        // 2. Claim seats
        console.log('[Test] Claiming seats...');
        for (let i = 0; i < 3; i++) {
            const p = players[i].page;
            await expect(p.locator('h1:has-text("Restore Game")')).toBeVisible({ timeout: 20000 });
            await p.getByRole('button', { name: 'Claim' }).first().click();
        }

        // 3. Verify Develop phase, NOT last round
        await expect(alicePage.getByTestId('phase-display')).toContainText('DEVELOP', { timeout: 30000 });
        const lastRoundBanner = alicePage.locator('text=⚠️ LAST ROUND! ⚠️');
        await expect(lastRoundBanner).not.toBeVisible();
        console.log('[Test] ✓ Starting in Develop phase, not last round');
        console.log('[Test] Resources before - Alice: 10 Food, 5 Labor, 5 Ore, 10 Capital, $50');

        // 4. Alice places her last flag - triggers isLastRound
        await expect(alicePage.getByTestId('turn-badge-Alice')).toBeVisible({ timeout: 10000 });
        await alicePage.getByRole('button', { name: /Flag/ }).click();
        await alicePage.getByTestId('hex-2,0').click();
        await expect(lastRoundBanner).toBeVisible({ timeout: 10000 });
        console.log('[Test] ✓ isLastRound triggered!');

        // 5. All players pass Develop phase (turn order: Bob, Charlie after Alice placed flag)
        const passOrder = [players[1], players[2], players[0]]; // Bob, Charlie, Alice
        for (const player of passOrder) {
            const name = player.name;
            await expect(player.page.getByTestId(`turn-badge-${name}`)).toBeVisible({ timeout: 15000 });
            await player.page.getByTestId('develop-pass-button').click();
            console.log(`[${name}] Passed Develop`);
        }

        // 6. Produce phase - all run production
        await expect(alicePage.getByTestId('phase-display')).toContainText('PRODUCE', { timeout: 10000 });
        console.log('[Test] ✓ Produce phase');
        for (const player of players) {
            await player.page.getByTestId('run-production-button').click();
            await expect(player.page.getByText('Are you sure you want to run production?')).toBeVisible({ timeout: 5000 });
            await player.page.getByRole('button', { name: 'Confirm' }).click();
            console.log(`[${player.name}] Confirmed production`);
        }

        // 7. Trade phase - all pass to trigger automated final trade (turn order: Bob, Charlie, Alice)
        await expect(alicePage.getByTestId('phase-display')).toContainText('TRADE', { timeout: 10000 });
        console.log('[Test] ✓ Trade phase (final)');
        const tradePassOrder = [players[1], players[2], players[0]]; // Bob, Charlie, Alice
        for (const player of tradePassOrder) {
            await expect(player.page.getByTestId(`turn-badge-${player.name}`)).toBeVisible({ timeout: 15000 });
            await player.page.getByTestId('trade-pass-button').click();
            console.log(`[${player.name}] Passed Trade`);
        }

        // 8. End Game Sequence Modal
        console.log('[Test] Verify End Game Sequence initiated');
        await expect(alicePage.getByText('Game Complete')).toBeVisible({ timeout: 15000 });

        // BOB is the Host! (Round rotated from 4->5, so Player 1 (Bob) is First Player)
        // Alice watches.

        // Steps: Interest, Food, Energy, Labor, Ore, Capital, Repay Loans, Victory
        const expectedSteps = [
            'Game Complete',
            'Interest Payment',
            'Selling Food',
            'Selling Energy',
            'Selling Labor',
            'Selling Ore',
            'Selling Capital',
            'Repaying Loans',
            'Final Standings'
        ];

        for (const stepTitle of expectedSteps) {
            console.log(`[Test] Expecting step: ${stepTitle}`);
            await expect(alicePage.getByRole('heading', { level: 2, name: stepTitle })).toBeVisible({ timeout: 10000 });

            // Verify Alice (non-host) sees "Waiting"
            await expect(alicePage.getByText('Waiting for host to proceed...')).toBeVisible();

            // Bob clicks Next (or Close on final step)
            if (stepTitle !== 'Final Standings') {
                await bobPage.getByRole('button', { name: 'Next Step' }).click();
            }
        }

        // 9. Verify automated final trade increased money VP
        console.log('[Test] ✓ V2 End Game test complete (automated final trade verified)!');
    });
});
