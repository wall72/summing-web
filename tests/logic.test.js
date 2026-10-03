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
});
