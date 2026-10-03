const { test, expect } = require('@playwright/test');

const savedGame = overrides => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    return JSON.stringify({
        board, stream: [1, 2, 3, 4, 5], score: 0, moves: 0, gameStatus: 'playing',
        savedAt: new Date().toISOString(), ...overrides
    });
};

const seed = (page, key, value) =>
    page.addInitScript(([k, v]) => {
        if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem(k, v);
            sessionStorage.setItem('seeded', '1');
        }
    }, [key, value]);

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => msg.type() === 'error' && errors.push(msg.text()));
    test.info().errors = errors;
});

test.afterEach(() => {
    expect(test.info().errors).toEqual([]);
});

test('starts a new game with a 9x9 board and 49 tiles', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cell')).toHaveCount(81);
    await expect(page.locator('.cell.filled')).toHaveCount(49);
    await expect(page.locator('.stream-num')).toHaveCount(5);
    await expect(page.locator('#remaining')).toHaveText('49');
});

test('placing a tile counts a move and survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cell.empty').first().click();
    await expect(page.locator('#moves')).toHaveText('1');

    // wait out a possible clear animation, then reload
    await expect(page.locator('.cell[aria-disabled="true"].empty')).toHaveCount(0);
    const tiles = await page.locator('#remaining').textContent();
    await page.reload();
    await expect(page.locator('#moves')).toHaveText('1');
    await expect(page.locator('#remaining')).toHaveText(tiles);
});

test('a matching placement clears tiles and scores 10 per tile', async ({ page }) => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    board[0][0] = 9;
    // stream starts with 7: placing at (5,4) sums 3 + 4 = 7 -> match, clears 3 tiles
    await seed(page, 'currentGame', savedGame({ board, stream: [7, 1, 2, 3, 4] }));
    await page.goto('/');

    await page.locator('.cell').nth(5 * 9 + 4).click();
    await expect(page.locator('#score')).toHaveText('30');
    await expect(page.locator('#remaining')).toHaveText('1');
    await expect(page.locator('.cell.filled')).toHaveCount(1);
});

test('clearing the board shows the result screen and records the score', async ({ page }) => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    await seed(page, 'currentGame', savedGame({ board, stream: [7, 1, 2, 3, 4] }));
    await page.goto('/');

    await page.locator('.cell').nth(5 * 9 + 4).click();
    await expect(page.locator('#leaderboardScreen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#resultTitle')).toHaveText('클리어!');
    await expect(page.locator('#finalScore')).toHaveText('530');
    await expect(page.locator('#leaderboardEntries .entry')).toHaveCount(1);

    // a finished game reopens on its result screen
    await page.reload();
    await expect(page.locator('#leaderboardScreen')).toBeVisible();
    await expect(page.locator('#continueBtn')).toBeHidden();

    await page.locator('#newGameBtn').click();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('.cell.filled')).toHaveCount(49);
});

test('a corrupted saved game is discarded', async ({ page }) => {
    await seed(page, 'currentGame', JSON.stringify({ board: [[1]], stream: [], gameStatus: 'playing' }));
    await page.goto('/');
    await expect(page.locator('.cell.filled')).toHaveCount(49);
    await expect(page.locator('#moves')).toHaveText('0');
});

test('new game asks for confirmation mid-game; records can be closed', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cell.empty').first().click();
    await expect(page.locator('#moves')).toHaveText('1');
    await expect(page.locator('.cell[aria-disabled="true"].empty')).toHaveCount(0);

    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#restartBtn').click();
    await expect(page.locator('#moves')).toHaveText('1');

    await page.locator('#recordsBtn').click();
    await expect(page.locator('#leaderboardScreen')).toBeVisible();
    await page.locator('#continueBtn').click();
    await expect(page.locator('#gameScreen')).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#restartBtn').click();
    await expect(page.locator('#moves')).toHaveText('0');
});

test('cells are keyboard operable', async ({ page }) => {
    await page.goto('/');
    const firstEmpty = page.locator('.cell.empty').first();
    await firstEmpty.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#moves')).toHaveText('1');
});
