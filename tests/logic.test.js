const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const empty = () => L.createEmptyBoard();

test('createBoard fills the centered 7x7 area only', () => {
    const board = L.createBoard();
    assert.equal(board.length, 9);
    assert.equal(L.countFilled(board), 49);
    for (let i = 0; i < 9; i++) {
        assert.equal(board[0][i], null);
        assert.equal(board[8][i], null);
        assert.equal(board[i][0], null);
        assert.equal(board[i][8], null);
    }
    assert.ok(board.flat().filter(v => v !== null).every(v => v >= 0 && v <= 9));
});

test('createStream has 5 digits', () => {
    const stream = L.createStream();
    assert.equal(stream.length, 5);
    assert.ok(stream.every(v => Number.isInteger(v) && v >= 0 && v <= 9));
});

test('getNeighbours handles corners and the center', () => {
    assert.equal(L.getNeighbours(0, 0).length, 3);
    assert.equal(L.getNeighbours(0, 4).length, 5);
    assert.equal(L.getNeighbours(4, 4).length, 8);
});

test('findMatch detects a neighbour sum match', () => {
    const board = empty();
    board[4][4] = 3;
    board[4][5] = 4;
    board[5][4] = 7; // placed: (3 + 4) % 10 === 7
    const cells = L.findMatch(board, 5, 4);
    assert.equal(cells.length, 3);
    assert.deepEqual(cells[0], [5, 4]);
});

test('findMatch rejects a non-match', () => {
    const board = empty();
    board[4][4] = 3;
    board[4][5] = 4;
    board[5][4] = 5;
    assert.equal(L.findMatch(board, 5, 4), null);
});

test('findMatch cannot match without filled neighbours', () => {
    const board = empty();
    board[4][4] = 0;
    assert.equal(L.findMatch(board, 4, 4), null);
});

test('getStatus', () => {
    assert.equal(L.getStatus(empty()), 'cleared');
    const full = Array.from({ length: 9 }, () => Array(9).fill(1));
    assert.equal(L.getStatus(full), 'gameover');
    const some = empty();
    some[0][0] = 1;
    assert.equal(L.getStatus(some), 'playing');
});

test('isValidSavedGame', () => {
    const valid = {
        board: L.createBoard(), stream: L.createStream(), score: 0, moves: 0, gameStatus: 'playing'
    };
    assert.equal(L.isValidSavedGame(valid), true);
    assert.equal(L.isValidSavedGame(null), false);
    assert.equal(L.isValidSavedGame({ ...valid, stream: [1, 2] }), false);
    assert.equal(L.isValidSavedGame({ ...valid, board: [[1]] }), false);
    assert.equal(L.isValidSavedGame({ ...valid, gameStatus: 'x' }), false);
    const badCell = L.createBoard();
    badCell[4][4] = 12;
    assert.equal(L.isValidSavedGame({ ...valid, board: badCell }), false);
});

test('isValidSavedGame rejects a status that does not match the board', () => {
    const base = { stream: L.createStream(), score: 0, moves: 0 };
    const full = L.createEmptyBoard().map(line => line.map(() => 1));
    assert.equal(L.isValidSavedGame({ ...base, board: L.createBoard(), gameStatus: 'cleared' }), false);
    assert.equal(L.isValidSavedGame({ ...base, board: L.createBoard(), gameStatus: 'gameover' }), false);
    assert.equal(L.isValidSavedGame({ ...base, board: full, gameStatus: 'playing' }), false);
    assert.equal(L.isValidSavedGame({ ...base, board: full, gameStatus: 'gameover' }), true);
    assert.equal(L.isValidSavedGame({ ...base, board: L.createEmptyBoard(), gameStatus: 'playing' }), false);
    assert.equal(L.isValidSavedGame({ ...base, board: L.createEmptyBoard(), gameStatus: 'cleared' }), true);
});

test('leaderboard sorts by score, then fewer moves, then newer; keeps 20', () => {
    const mk = (score, moves, timestamp) => ({
        score, moves, remaining: 0, status: 'cleared', date: '2026-01-01T00:00:00.000Z', timestamp
    });
    let entries = [];
    entries = L.addLeaderboardEntry(entries, mk(100, 10, 1));
    entries = L.addLeaderboardEntry(entries, mk(200, 20, 2));
    entries = L.addLeaderboardEntry(entries, mk(100, 5, 3));
    entries = L.addLeaderboardEntry(entries, mk(100, 5, 4));
    assert.deepEqual(entries.map(e => e.timestamp), [2, 4, 3, 1]);

    for (let i = 0; i < 30; i++) {
        entries = L.addLeaderboardEntry(entries, mk(i, 1, 10 + i));
    }
    assert.equal(entries.length, 20);
    assert.ok(L.isValidLeaderboardEntry(entries[0]));
    assert.equal(L.isValidLeaderboardEntry({ score: 'x' }), false);
    assert.equal(L.isValidLeaderboardEntry({ ...entries[0], date: 'not a date' }), false);
});

test('UNDO_LIMIT is 3', () => {
    assert.equal(L.UNDO_LIMIT, 3);
});

test('createUndoSnapshot copies the state and keeps the pending digit', () => {
    const state = { board: L.createBoard(), stream: L.createStream(), score: 40, moves: 3 };
    const snapshot = L.createUndoSnapshot(state, 7);
    assert.deepEqual(snapshot, { ...state, pendingDigit: 7 });

    state.board[4][4] = null;
    state.stream[0] = (state.stream[0] + 1) % 10;
    assert.notEqual(snapshot.board[4][4], null);
    assert.notEqual(snapshot.stream[0], state.stream[0]);
});

test('restoreUndoSnapshot returns an independent copy', () => {
    const snapshot = L.createUndoSnapshot(
        { board: L.createBoard(), stream: [1, 2, 3, 4, 5], score: 10, moves: 1 }, 9
    );
    const restored = L.restoreUndoSnapshot(snapshot);
    assert.deepEqual(restored, snapshot);

    restored.board[4][4] = null;
    restored.stream.shift();
    assert.notEqual(snapshot.board[4][4], null);
    assert.equal(snapshot.stream.length, 5);
});

test('isValidUndoSnapshot', () => {
    const valid = L.createUndoSnapshot(
        { board: L.createBoard(), stream: L.createStream(), score: 0, moves: 0 }, 0
    );
    assert.equal(L.isValidUndoSnapshot(valid), true);
    assert.equal(L.isValidUndoSnapshot(null), false);
    assert.equal(L.isValidUndoSnapshot('x'), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, pendingDigit: 10 }), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, pendingDigit: undefined }), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, pendingDigit: 1.5 }), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, stream: [1, 2] }), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, moves: -1 }), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, board: [[1]] }), false);
    // a snapshot of an ended game (empty or full board) can never be undone into
    assert.equal(L.isValidUndoSnapshot({ ...valid, board: L.createEmptyBoard() }), false);
    assert.equal(L.isValidUndoSnapshot({ ...valid, board: L.createEmptyBoard().map(l => l.map(() => 1)) }), false);
});

test('readSavedUndo falls back to defaults for old or corrupt saves', () => {
    const snapshot = L.createUndoSnapshot(
        { board: L.createBoard(), stream: L.createStream(), score: 0, moves: 0 }, 4
    );
    assert.deepEqual(L.readSavedUndo({}), { undoState: null, undosLeft: 3, pendingDigit: null });
    assert.deepEqual(L.readSavedUndo({ undo: snapshot, undosLeft: 1 }),
        { undoState: snapshot, undosLeft: 1, pendingDigit: null });
    assert.deepEqual(L.readSavedUndo({ undo: null, undosLeft: 0, pendingDigit: 6 }),
        { undoState: null, undosLeft: 0, pendingDigit: 6 });
    // corrupt values are replaced individually
    assert.deepEqual(L.readSavedUndo({ undo: { board: [] }, undosLeft: 9, pendingDigit: 12 }),
        { undoState: null, undosLeft: 3, pendingDigit: null });
    assert.equal(L.readSavedUndo({ undosLeft: 'x' }).undosLeft, 3);
    assert.equal(L.readSavedUndo({ undosLeft: -1 }).undosLeft, 3);
    // a snapshot and a pending digit never coexist
    assert.equal(L.readSavedUndo({ undo: snapshot, pendingDigit: 2 }).pendingDigit, null);
});

test('findHint picks the match that clears the most tiles, first in row-major order on ties', () => {
    const board = empty();
    board[4][4] = 3;
    board[4][5] = 4;
    // 7 matches next to both tiles; (3,4) is the first such cell
    assert.deepEqual(L.findHint(board, 7), [3, 4]);
    // a lone neighbour of the 3 matches a 3 and clears 2 tiles; no cell reaches 7 mod 10 with only the 4
    assert.deepEqual(L.findHint(board, 3), [3, 3]);
    // an extra pair elsewhere that clears 3 tiles wins over the earlier 2-tile match
    board[8][0] = 1;
    board[8][2] = 1;
    assert.deepEqual(L.findHint(board, 2), [7, 1]);
});

test('findHint returns null without a match and does not modify the board', () => {
    const board = empty();
    board[4][4] = 3;
    const before = JSON.stringify(board);
    assert.equal(L.findHint(board, 5), null);
    assert.equal(L.findHint(empty(), 0), null);
    assert.equal(JSON.stringify(board), before);
});

test('readSavedHints falls back to the full allowance for old or corrupt saves', () => {
    assert.equal(L.HINT_LIMIT, 3);
    assert.equal(L.readSavedHints({}), 3);
    assert.equal(L.readSavedHints({ hintsLeft: 0 }), 0);
    assert.equal(L.readSavedHints({ hintsLeft: 2 }), 2);
    assert.equal(L.readSavedHints({ hintsLeft: 4 }), 3);
    assert.equal(L.readSavedHints({ hintsLeft: -1 }), 3);
    assert.equal(L.readSavedHints({ hintsLeft: 1.5 }), 3);
    assert.equal(L.readSavedHints({ hintsLeft: '1' }), 3);
});

test('sanitizePlayerName trims, collapses whitespace, strips control characters and caps the length', () => {
    assert.equal(L.sanitizePlayerName('  홍  길동  '), '홍 길동');
    assert.equal(L.sanitizePlayerName('a\u0000b\nc'), 'a b c');
    assert.equal(L.sanitizePlayerName('x'.repeat(30)), 'x'.repeat(L.PLAYER_NAME_MAX));
    assert.equal(L.sanitizePlayerName('   '), '');
    assert.equal(L.sanitizePlayerName(42), '');
    assert.equal(L.sanitizePlayerName(undefined), '');
});

test('leaderboard entries accept a missing name but reject a non-string name', () => {
    const base = { score: 1, moves: 1, remaining: 0, status: 'cleared', date: new Date().toISOString(), timestamp: 1 };
    assert.ok(L.isValidLeaderboardEntry(base));
    assert.ok(L.isValidLeaderboardEntry({ ...base, name: '민수' }));
    assert.ok(!L.isValidLeaderboardEntry({ ...base, name: 5 }));
});

test('normalizeEntries drops invalid items, defaults names, sorts and caps the list', () => {
    const date = new Date().toISOString();
    const make = (score, extra = {}) => ({ score, moves: 1, remaining: 0, status: 'cleared', date, timestamp: score, ...extra });
    const list = [make(10), make(30, { name: '  가나다  ' }), { nonsense: true }, make(20, { name: '<b>x</b>' })];
    const result = L.normalizeEntries(list);
    assert.deepEqual(result.map(e => e.score), [30, 20, 10]);
    assert.deepEqual(result.map(e => e.name), ['가나다', '<b>x</b>', L.DEFAULT_PLAYER_NAME]);
    assert.deepEqual(L.normalizeEntries('nope'), []);
    assert.deepEqual(L.normalizeEntries(null), []);

    const many = Array.from({ length: 30 }, (_, i) => make(i));
    assert.equal(L.normalizeEntries(many).length, L.LEADERBOARD_LIMIT);
});

test('calcClearBonus: 적은 이동으로 클리어할수록 최종 점수가 높다', () => {
    const finalScore = moves => (49 + moves) * L.POINTS_PER_TILE + L.calcClearBonus(moves, (49 + moves) * L.POINTS_PER_TILE);
    assert.ok(finalScore(30) > finalScore(40));
    assert.ok(finalScore(40) > finalScore(60));
    assert.equal(finalScore(30), 3000 - 30 * 20);
});

test('calcClearBonus: 바닥값과 음수 보너스 방지', () => {
    assert.equal(L.calcClearBonus(500, 5000), 0);
    assert.equal(L.calcClearBonus(500, 100) + 100, L.CLEAR_MIN_SCORE);
});
