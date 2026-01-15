import { test, expect } from '@playwright/test';

test('coordinates are visible when debug flag is active', async ({ page }) => {
    // Navigate with debug flag
    await page.goto('/?debug=true');

    // Wait for the board to render
    const hex = page.getByTestId('hex-0,0');
    await expect(hex).toBeVisible();

    // Check if the text "0,0" is visible within the hex
    // We use a locator for the text element itself
    const coords = hex.locator('text=0,0');
    await expect(coords).toBeVisible();
});
