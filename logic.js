(function (root) {
    const BOARD_SIZE = 9;
    const INITIAL_GRID_SIZE = 7;
    const STREAM_LENGTH = 5;
    const LEADERBOARD_LIMIT = 20;
    const PLAYER_NAME_MAX = 12;
    const DEFAULT_PLAYER_NAME = '익명';
    const POINTS_PER_TILE = 10;
    const CLEAR_BONUS = 500;
    const UNDO_LIMIT = 3;
    const HINT_LIMIT = 3;

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
            && ['playing', 'cleared', 'gameover'].includes(game.gameStatus)
            && getStatus(board) === game.gameStatus;
    }

    // Snapshot of the state before a move. `pendingDigit` is the digit that move appended to the stream;
    // it is reused when the move is replayed so undo cannot be used to re-roll the stream.
    function createUndoSnapshot({ board, stream, score, moves }, pendingDigit) {
        return {
            board: board.map(line => [...line]),
            stream: [...stream],
            score,
            moves,
            pendingDigit
        };
    }

    // Returns a deep copy so the caller can mutate the restored state without touching the snapshot.
    function restoreUndoSnapshot(snapshot) {
        return {
            board: snapshot.board.map(line => [...line]),
            stream: [...snapshot.stream],
            score: snapshot.score,
            moves: snapshot.moves,
            pendingDigit: snapshot.pendingDigit
        };
    }

    // A snapshot is always taken before a move that kept the game running, so it must be a playing state.
    function isValidUndoSnapshot(snapshot) {
        return Boolean(snapshot) && typeof snapshot === 'object'
            && isDigit(snapshot.pendingDigit)
            && isValidSavedGame({ ...snapshot, gameStatus: 'playing' });
    }

    // Reads the undo-related fields of a saved game. Missing or corrupt values fall back to defaults
    // without discarding the game itself (older saves have none of these fields).
    function readSavedUndo(saved) {
        const undoState = isValidUndoSnapshot(saved.undo) ? saved.undo : null;
        const undosLeft = Number.isInteger(saved.undosLeft) && saved.undosLeft >= 0 && saved.undosLeft <= UNDO_LIMIT
            ? saved.undosLeft : UNDO_LIMIT;
        // A pending digit only exists between an undo and the replayed move, when there is no snapshot.
        const pendingDigit = !undoState && isDigit(saved.pendingDigit) ? saved.pendingDigit : null;
        return { undoState, undosLeft, pendingDigit };
    }

    // Best empty cell for placing `digit`: the match that clears the most tiles, first in row-major order on ties.
    // Returns [row, col] or null when no placement matches. The board is left unchanged.
    function findHint(board, digit) {
        const work = board.map(line => [...line]);
        let best = null;
        let bestCount = 0;
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (work[row][col] !== null) {
                    continue;
                }
                work[row][col] = digit;
                const match = findMatch(work, row, col);
                work[row][col] = null;
                if (match && match.length > bestCount) {
                    best = [row, col];
                    bestCount = match.length;
                }
            }
        }
        return best;
    }

    // Missing or corrupt values fall back to the full allowance without discarding the game.
    function readSavedHints(saved) {
        return Number.isInteger(saved.hintsLeft) && saved.hintsLeft >= 0 && saved.hintsLeft <= HINT_LIMIT
            ? saved.hintsLeft : HINT_LIMIT;
    }

    // Strips control characters, collapses whitespace and caps the length. May return ''.
    function sanitizePlayerName(raw) {
        if (typeof raw !== 'string') {
            return '';
        }
        return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
            .slice(0, PLAYER_NAME_MAX).trim();
    }

    // `name` is optional so records saved before names existed stay valid.
    function isValidLeaderboardEntry(entry) {
        return Boolean(entry) && typeof entry === 'object'
            && [entry.score, entry.moves, entry.remaining, entry.timestamp].every(Number.isFinite)
            && (entry.status === 'cleared' || entry.status === 'gameover')
            && (entry.name === undefined || typeof entry.name === 'string')
            && typeof entry.date === 'string'
            && Number.isFinite(Date.parse(entry.date));
    }

    function withPlayerName(entry) {
        return { ...entry, name: sanitizePlayerName(entry.name) || DEFAULT_PLAYER_NAME };
    }

    // Validates and orders a list received from the server (or storage): invalid items are dropped.
    function normalizeEntries(list) {
        if (!Array.isArray(list)) {
            return [];
        }
        return list.filter(isValidLeaderboardEntry).map(withPlayerName)
            .sort(compareEntries).slice(0, LEADERBOARD_LIMIT);
    }

    function compareEntries(a, b) {
        return (b.score - a.score) || (a.moves - b.moves) || (b.timestamp - a.timestamp);
    }

    function addLeaderboardEntry(entries, entry) {
        return [...entries, entry].sort(compareEntries).slice(0, LEADERBOARD_LIMIT);
    }

    const api = {
        BOARD_SIZE, INITIAL_GRID_SIZE, STREAM_LENGTH, LEADERBOARD_LIMIT, POINTS_PER_TILE, CLEAR_BONUS, UNDO_LIMIT, HINT_LIMIT,
        findHint, readSavedHints,
        createEmptyBoard, createBoard, createStream, randomDigit, getNeighbours, findMatch,
        countFilled, getStatus, isValidSavedGame, createUndoSnapshot, restoreUndoSnapshot, isValidUndoSnapshot, readSavedUndo,
        PLAYER_NAME_MAX, DEFAULT_PLAYER_NAME, sanitizePlayerName, normalizeEntries,
        isValidLeaderboardEntry, compareEntries, addLeaderboardEntry
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.SummingLogic = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
