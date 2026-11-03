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

test('starting a new game right after a game ends is not overridden by the late result screen', async ({ page }) => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    await seed(page, 'currentGame', savedGame({ board, stream: [7, 1, 2, 3, 4] }));
    await page.goto('/');

    await page.locator('.cell').nth(5 * 9 + 4).click();
    // animation (1.2s) is over but the result screen (1s later) is not shown yet: start a new game
    await page.waitForTimeout(1500);
    await expect(page.locator('#gameScreen')).toBeVisible();
    await page.locator('#restartBtn').click();
    await expect(page.locator('.cell.filled')).toHaveCount(49);

    await page.waitForTimeout(1500);
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#leaderboardScreen')).toBeHidden();
    await expect(page.locator('.cell.filled')).toHaveCount(49);
    await expect(page.locator('.cell.matched, .cell.removing')).toHaveCount(0);
});

test('records saved by another tab are kept', async ({ context }) => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    const other = { score: 999, moves: 1, remaining: 0, status: 'cleared', date: new Date().toISOString(), timestamp: 1 };

    const page = await context.newPage();
    await seed(page, 'currentGame', savedGame({ board, stream: [7, 1, 2, 3, 4] }));
    await page.goto('/');
    // another tab writes a record after this tab has loaded the leaderboard
    await page.evaluate(entry => localStorage.setItem('leaderboard', JSON.stringify([entry])), other);

    await page.locator('.cell').nth(5 * 9 + 4).click();
    await expect(page.locator('#leaderboardScreen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#leaderboardEntries .entry')).toHaveCount(2);
});

test.describe('service worker', () => {
    test.use({ serviceWorkers: 'allow' });

    test('serves the app offline from a single cache version', async ({ page, context }) => {
        await page.goto('/');
        await page.evaluate(() => navigator.serviceWorker.ready);
        // wait until the worker controls the page (clients.claim after activation)
        await page.waitForFunction(() => navigator.serviceWorker.controller);

        const cached = await page.evaluate(async () => {
            const keys = await caches.keys();
            const cache = await caches.open(keys[0]);
            return { keys, urls: (await cache.keys()).map(r => new URL(r.url).pathname).sort() };
        });
        expect(cached.keys).toEqual(['summing-v3']);
        expect(cached.urls).toEqual(
            ['/', '/game.js', '/icon.svg', '/index.html', '/logic.js', '/manifest.webmanifest', '/styles.css']
        );

        await context.setOffline(true);
        await page.reload();
        await expect(page.locator('.cell')).toHaveCount(81);
        await page.locator('.cell.empty').first().click();
        await expect(page.locator('#moves')).toHaveText('1');
    });
});

test('a move leaves clean cells and announces the status once', async ({ page }) => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    board[0][0] = 9;
    await seed(page, 'currentGame', savedGame({ board, stream: [7, 1, 2, 3, 4] }));
    await page.goto('/');

    await page.evaluate(() => {
        window.statusMutations = 0;
        new MutationObserver(records => { window.statusMutations += records.length; })
            .observe(document.getElementById('status'), { childList: true, characterData: true, subtree: true });
    });

    await page.locator('.cell').nth(5 * 9 + 4).click();
    await expect(page.locator('#remaining')).toHaveText('1');
    await expect(page.locator('.cell[aria-disabled="true"].empty')).toHaveCount(0);

    await expect(page.locator('.cell.new-tile, .cell.matched, .cell.removing')).toHaveCount(0);
    await expect(page.locator('.cell').nth(5 * 9 + 4)).toHaveAttribute('aria-label', '6행 5열, 빈 칸');
    await expect(page.locator('.cell').nth(5 * 9 + 4)).toHaveText('');
    await expect(page.locator('.cell').nth(0)).toHaveAttribute('aria-label', '1행 1열, 숫자 9');
    await expect(page.locator('.stream-num')).toHaveCount(5);
    await expect(page.locator('.stream-num.current')).toHaveText('1');
    expect(await page.evaluate(() => window.statusMutations)).toBe(1);
});

const matchSeed = () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    board[0][0] = 9;
    return savedGame({ board, stream: [7, 1, 2, 3, 4] });
};
const idle = page => page.waitForFunction(() => game && !game.isResolvingMove);

test('undoMove restores the board, stream, score and moves of the last move', async ({ page }) => {
    await seed(page, 'currentGame', matchSeed());
    await page.goto('/');

    await page.locator('.cell').nth(5 * 9 + 4).click();
    await expect(page.locator('#score')).toHaveText('30');
    await idle(page);

    await page.evaluate(() => game.undoMove());
    await expect(page.locator('#score')).toHaveText('0');
    await expect(page.locator('#moves')).toHaveText('0');
    await expect(page.locator('.cell.filled')).toHaveCount(3);
    await expect(page.locator('.stream-num.current')).toHaveText('7');
    expect(await page.evaluate(() => game.undosLeft)).toBe(2);

    // nothing left to undo until another move is made
    await page.evaluate(() => game.undoMove());
    expect(await page.evaluate(() => game.undosLeft)).toBe(2);
});

test('a replayed move appends the same digit, and undo state survives a reload', async ({ page }) => {
    // every random draw yields a different digit, so a re-roll would always be detected
    await page.addInitScript(() => {
        // the counter lives in sessionStorage so it keeps counting across the reload below
        Math.random = () => {
            const calls = Number(sessionStorage.getItem('randomCalls') || 0);
            sessionStorage.setItem('randomCalls', calls + 1);
            return ((calls % 10) + 0.5) / 10;
        };
    });
    await seed(page, 'currentGame', matchSeed());
    await page.goto('/');

    await page.locator('.cell').nth(5 * 9 + 4).click();
    await idle(page);
    const appended = await page.evaluate(() => game.stream[4]);

    await page.evaluate(() => game.undoMove());
    await page.reload();
    expect(await page.evaluate(() => game.undosLeft)).toBe(2);
    expect(await page.evaluate(() => game.pendingDigit)).toBe(appended);

    // replay at a different cell: the appended digit is unchanged
    await page.locator('.cell').nth(8 * 9 + 8).click();
    await idle(page);
    expect(await page.evaluate(() => game.stream[4])).toBe(appended);
    expect(await page.evaluate(() => game.pendingDigit)).toBeNull();
    expect(await page.evaluate(() => game.canUndo())).toBe(true);
});

test('undo is unavailable after the game ends and for animating moves', async ({ page }) => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    board[4][4] = 3;
    board[4][5] = 4;
    await seed(page, 'currentGame', savedGame({ board, stream: [7, 1, 2, 3, 4] }));
    await page.goto('/');

    await page.locator('.cell').nth(5 * 9 + 4).click();
    expect(await page.evaluate(() => game.canUndo())).toBe(false);
    await expect(page.locator('#leaderboardScreen')).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => game.canUndo())).toBe(false);
    await page.evaluate(() => game.undoMove());
    await expect(page.locator('#finalScore')).toHaveText('530');
});

test('a save without undo fields still restores with the full undo allowance', async ({ page }) => {
    await seed(page, 'currentGame', matchSeed());
    await page.goto('/');
    expect(await page.evaluate(() => game.undosLeft)).toBe(3);
    expect(await page.evaluate(() => game.canUndo())).toBe(false);
});

test('corrupt undo fields do not discard the saved game', async ({ page }) => {
    const saved = JSON.parse(matchSeed());
    Object.assign(saved, { undo: { board: [[1]] }, undosLeft: 99, pendingDigit: 42 });
    await seed(page, 'currentGame', JSON.stringify(saved));
    await page.goto('/');
    await expect(page.locator('.cell.filled')).toHaveCount(3);
    expect(await page.evaluate(() => game.undosLeft)).toBe(3);
    expect(await page.evaluate(() => game.pendingDigit)).toBeNull();
});

test.describe('undo button', () => {
    const undoBtn = page => page.locator('#undoBtn');
    const quietSeed = () => {
        const board = Array.from({ length: 9 }, () => Array(9).fill(null));
        board[0][0] = 9;
        // 5 placed in the far corner has no filled neighbour, so it never matches
        return savedGame({ board, stream: [5, 5, 5, 5, 5] });
    };

    test('is disabled while animating, restores a cleared move and announces it', async ({ page }) => {
        await seed(page, 'currentGame', matchSeed());
        await page.goto('/');
        await expect(undoBtn(page)).toBeDisabled();
        await expect(page.locator('#undoCount')).toHaveText('3');

        await page.locator('.cell').nth(5 * 9 + 4).click();
        await expect(undoBtn(page)).toBeDisabled();
        await expect(undoBtn(page)).toBeEnabled();
        await expect(page.locator('#score')).toHaveText('30');

        await undoBtn(page).click();
        await expect(page.locator('#score')).toHaveText('0');
        await expect(page.locator('#moves')).toHaveText('0');
        await expect(page.locator('.cell.filled')).toHaveCount(3);
        await expect(page.locator('.stream-num.current')).toHaveText('7');
        await expect(page.locator('#undoCount')).toHaveText('2');
        await expect(undoBtn(page)).toBeDisabled();
        await expect(page.locator('#status')).toContainText('되돌렸습니다. 남은 횟수 2회');
    });

    test('allows three undos per game and a new game resets them', async ({ page }) => {
        await seed(page, 'currentGame', quietSeed());
        await page.goto('/');

        for (const left of ['2', '1', '0']) {
            await page.locator('.cell').nth(8 * 9 + 8).click();
            await expect(undoBtn(page)).toBeEnabled();
            await undoBtn(page).click();
            await expect(page.locator('#undoCount')).toHaveText(left);
            await expect(page.locator('#moves')).toHaveText('0');
        }

        await page.locator('.cell').nth(8 * 9 + 8).click();
        await expect(page.locator('#moves')).toHaveText('1');
        await expect(undoBtn(page)).toBeDisabled();

        page.once('dialog', dialog => dialog.accept());
        await page.locator('#restartBtn').click();
        await expect(page.locator('#undoCount')).toHaveText('3');
        await expect(undoBtn(page)).toBeDisabled();
    });

    test('stays available after a reload', async ({ page }) => {
        await seed(page, 'currentGame', quietSeed());
        await page.goto('/');
        await page.locator('.cell').nth(8 * 9 + 8).click();
        await expect(undoBtn(page)).toBeEnabled();

        await page.reload();
        await expect(undoBtn(page)).toBeEnabled();
        await undoBtn(page).click();
        await expect(page.locator('#moves')).toHaveText('0');
        await expect(page.locator('.cell.filled')).toHaveCount(1);

        // the remaining count and the pending digit are kept too
        await page.reload();
        await expect(page.locator('#undoCount')).toHaveText('2');
        await expect(undoBtn(page)).toBeDisabled();
    });

    test('fits on screen with the other buttons', async ({ page }) => {
        await page.goto('/');
        const viewport = page.viewportSize();
        for (const id of ['undoBtn', 'restartBtn', 'recordsBtn']) {
            const box = await page.locator(`#${id}`).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
    });
});
