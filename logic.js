(function (root) {
    const BOARD_SIZE = 9;
    const INITIAL_GRID_SIZE = 7;
    const STREAM_LENGTH = 5;
    const LEADERBOARD_LIMIT = 20;
    const POINTS_PER_TILE = 10;
    const CLEAR_BONUS = 500;

    const DIRECTIONS = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    function randomDigit(rng = Math.random) {
        return Math.floor(rng() * 10);
    }

    function createEmptyBoard() {
        return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    }

    function createBoard(rng = Math.random) {
        const board = createEmptyBoard();
        const start = (BOARD_SIZE - INITIAL_GRID_SIZE) / 2;
        for (let row = start; row < start + INITIAL_GRID_SIZE; row++) {
            for (let col = start; col < start + INITIAL_GRID_SIZE; col++) {
                board[row][col] = randomDigit(rng);
            }
        }
        return board;
    }

    function createStream(rng = Math.random) {
        return Array.from({ length: STREAM_LENGTH }, () => randomDigit(rng));
    }

    function getNeighbours(row, col) {
        const neighbours = [];
        for (const [dRow, dCol] of DIRECTIONS) {
            const r = row + dRow;
            const c = col + dCol;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                neighbours.push([r, c]);
            }
        }
        return neighbours;
    }

    // Returns the cells to clear (placed cell first) or null. Expects the placed digit to be on the board.
    function findMatch(board, row, col) {
        const placed = board[row][col];
        const filled = getNeighbours(row, col).filter(([r, c]) => board[r][c] !== null);
        if (filled.length === 0) {
            return null;
        }
        const sum = filled.reduce((acc, [r, c]) => acc + board[r][c], 0);
        return sum % 10 === placed ? [[row, col], ...filled] : null;
    }

    function countFilled(board) {
        return board.reduce((total, line) => total + line.filter(v => v !== null).length, 0);
    }

    function getStatus(board) {
        const filled = countFilled(board);
        if (filled === 0) {
            return 'cleared';
        }
        return filled === BOARD_SIZE * BOARD_SIZE ? 'gameover' : 'playing';
    }

    function isDigit(value) {
        return Number.isInteger(value) && value >= 0 && value <= 9;
    }

    function isValidSavedGame(game) {
        if (!game || typeof game !== 'object') {
            return false;
        }
        const { board, stream, score, moves } = game;
        return Array.isArray(board)
            && board.length === BOARD_SIZE
            && board.every(line => Array.isArray(line) && line.length === BOARD_SIZE
                && line.every(v => v === null || isDigit(v)))
            && Array.isArray(stream)
            && stream.length === STREAM_LENGTH
            && stream.every(isDigit)
            && Number.isInteger(score) && score >= 0
            && Number.isInteger(moves) && moves >= 0
            && ['playing', 'cleared', 'gameover'].includes(game.gameStatus);
    }

    function isValidLeaderboardEntry(entry) {
        return Boolean(entry) && typeof entry === 'object'
            && [entry.score, entry.moves, entry.remaining, entry.timestamp].every(Number.isFinite)
            && (entry.status === 'cleared' || entry.status === 'gameover')
            && typeof entry.date === 'string';
    }

    function compareEntries(a, b) {
        return (b.score - a.score) || (a.moves - b.moves) || (b.timestamp - a.timestamp);
    }

    function addLeaderboardEntry(entries, entry) {
        return [...entries, entry].sort(compareEntries).slice(0, LEADERBOARD_LIMIT);
    }

    const api = {
        BOARD_SIZE, INITIAL_GRID_SIZE, STREAM_LENGTH, LEADERBOARD_LIMIT, POINTS_PER_TILE, CLEAR_BONUS,
        createEmptyBoard, createBoard, createStream, randomDigit, getNeighbours, findMatch,
        countFilled, getStatus, isValidSavedGame, isValidLeaderboardEntry, compareEntries, addLeaderboardEntry
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.SummingLogic = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
