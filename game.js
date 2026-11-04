const {
    BOARD_SIZE, STREAM_LENGTH, POINTS_PER_TILE, CLEAR_BONUS,
    createBoard, createStream, randomDigit, findMatch, countFilled, getStatus,
    UNDO_LIMIT, isValidSavedGame, createUndoSnapshot, restoreUndoSnapshot, readSavedUndo,
    HINT_LIMIT, findHint, readSavedHints,
    DEFAULT_PLAYER_NAME, sanitizePlayerName, normalizeEntries, addLeaderboardEntry
} = SummingLogic;

// Keep in sync with the CSS animation durations in styles.css.
const PLACE_DELAY_MS = 300;
const MATCH_DELAY_MS = 500;
const REMOVE_DELAY_MS = 400;
const RESULT_DELAY_MS = 1000;
const REMOTE_TIMEOUT_MS = 10000;

const TEXT = {
    cleared: '클리어!',
    gameOver: '게임 오버',
    inProgress: '진행 중',
    noRecords: '기록이 없습니다.',
    win: '승리',
    end: '종료',
    moves: '이동',
    confirmNewGame: '진행 중인 게임을 버리고 새 게임을 시작할까요?',
    undone: left => `되돌렸습니다. 남은 횟수 ${left}회. `,
    hintFound: (row, col, left) => `힌트: ${row + 1}행 ${col + 1}열에 놓으면 제거됩니다. 남은 힌트 ${left}회. `,
    noHint: '지금은 매치되는 칸이 없습니다. ',
    loading: '서버 기록을 불러오는 중…',
    submitting: '기록을 저장하는 중…',
    offline: '서버에 연결할 수 없어 이 기기의 기록을 표시합니다.',
    saveFailed: '서버에 저장하지 못해 이 기기에만 기록했습니다.',
    saved: '기록을 저장했습니다.'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function readStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.warn(`Failed to read "${key}". Resetting saved data.`, error);
        try {
            localStorage.removeItem(key);
        } catch (removeError) {
            // storage unavailable
        }
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`Failed to save "${key}".`, error);
    }
}

// Talks to the Google Apps Script web app (server/apps-script). Disabled when no URL is configured.
class RemoteLeaderboard {
    constructor(url) {
        this.url = typeof url === 'string' ? url.trim() : '';
    }

    get enabled() {
        return this.url !== '';
    }

    async request(url, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data || data.ok !== true) {
                throw new Error('Unexpected leaderboard response');
            }
            return normalizeEntries(data.entries);
        } finally {
            clearTimeout(timer);
        }
    }

    list() {
        const url = new URL(this.url);
        url.searchParams.set('action', 'list');
        return this.request(url.toString());
    }

    // Sent as text/plain so the browser does not make a CORS preflight request (Apps Script cannot answer one).
    submit({ name, score, moves, remaining, status }) {
        return this.request(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'submit', name, score, moves, remaining, status })
        });
    }
}

// Local records are always kept (offline fallback); server records, when loaded, are shown instead.
class LeaderboardManager {
    constructor() {
        this.entries = this.load();
        this.remoteEntries = null;
    }

    load() {
        return normalizeEntries(readStorage('leaderboard'));
    }

    addEntry(name, score, moves, remaining, status) {
        const entry = {
            name: sanitizePlayerName(name) || DEFAULT_PLAYER_NAME,
            score,
            moves,
            remaining,
            status,
            date: new Date().toISOString(),
            timestamp: Date.now()
        };
        // Re-read first so records saved by another tab are not overwritten.
        this.entries = addLeaderboardEntry(this.load(), entry);
        writeStorage('leaderboard', this.entries);
    }

    getTopEntries(count = 10) {
        return (this.remoteEntries || this.entries).slice(0, count);
    }
}

class SummingGame {
    constructor() {
        this.board = [];
        this.stream = [];
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
        this.isResolvingMove = false;
        this.generation = 0;
        this.undoState = null;
        this.undosLeft = UNDO_LIMIT;
        this.pendingDigit = null;
        this.hintsLeft = HINT_LIMIT;
        this.hintCell = null;
        this.statusPrefix = '';
        // A finished game waits for a player name (submitted === false); playing games count as submitted.
        this.submitted = true;
        this.leaderboard = new LeaderboardManager();
        this.remote = new RemoteLeaderboard((window.SUMMING_CONFIG || {}).leaderboardApiUrl);
        // Lets a newer server request win over an older one that is still in flight.
        this.remoteToken = 0;

        this.initElements();
        this.buildBoard();
        this.loadOrStartGame();
    }

    initElements() {
        this.gameScreen = document.getElementById('gameScreen');
        this.leaderboardScreen = document.getElementById('leaderboardScreen');

        this.boardElement = document.getElementById('board');
        this.scoreElement = document.getElementById('score');
        this.movesElement = document.getElementById('moves');
        this.remainingElement = document.getElementById('remaining');
        this.streamNumbersElement = document.getElementById('streamNumbers');
        this.statusElement = document.getElementById('status');

        this.resultTitle = document.getElementById('resultTitle');
        this.finalScore = document.getElementById('finalScore');
        this.finalMoves = document.getElementById('finalMoves');
        this.finalRemaining = document.getElementById('finalRemaining');
        this.leaderboardEntries = document.getElementById('leaderboardEntries');
        this.leaderboardStatus = document.getElementById('leaderboardStatus');
        this.nameForm = document.getElementById('nameForm');
        this.playerNameInput = document.getElementById('playerName');
        this.skipScoreBtn = document.getElementById('skipScoreBtn');

        this.bestElement = document.getElementById('best');

        this.newGameBtn = document.getElementById('newGameBtn');
        this.continueBtn = document.getElementById('continueBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.recordsBtn = document.getElementById('recordsBtn');
        this.undoBtn = document.getElementById('undoBtn');
        this.undoCountElement = document.getElementById('undoCount');
        this.hintBtn = document.getElementById('hintBtn');
        this.hintCountElement = document.getElementById('hintCount');

        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.continueBtn.addEventListener('click', () => this.showGameScreen());
        this.restartBtn.addEventListener('click', () => this.confirmNewGame());
        this.recordsBtn.addEventListener('click', () => this.showResult());
        this.undoBtn.addEventListener('click', () => this.undoMove());
        this.hintBtn.addEventListener('click', () => this.showHint());
        this.nameForm.addEventListener('submit', event => {
            event.preventDefault();
            this.submitScore(this.playerNameInput.value);
        });
        this.skipScoreBtn.addEventListener('click', () => this.submitScore(''));
    }

    // Build the 81 cells once; render() only updates them. One delegated listener handles input.
    buildBoard() {
        this.cells = [];
        // What each cell currently shows, so render() only touches cells that changed.
        this.shown = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => ({ value: undefined, locked: undefined }));
        this.animatedCells = [];
        this.streamSpans = Array.from({ length: STREAM_LENGTH }, (_, i) => {
            const span = document.createElement('span');
            span.className = i === 0 ? 'stream-num current' : 'stream-num';
            return span;
        });
        this.streamNumbersElement.replaceChildren(...this.streamSpans);
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                this.boardElement.appendChild(cell);
                this.cells.push(cell);
            }
        }

        this.boardElement.addEventListener('click', event => {
            const cell = event.target.closest('.cell');
            if (cell) {
                this.placeNumber(Number(cell.dataset.row), Number(cell.dataset.col));
            }
        });
    }

    loadOrStartGame() {
        const saved = readStorage('currentGame');

        if (isValidSavedGame(saved)) {
            this.board = saved.board;
            this.stream = saved.stream;
            this.score = saved.score;
            this.moves = saved.moves;
            this.gameStatus = saved.gameStatus;
            ({ undoState: this.undoState, undosLeft: this.undosLeft, pendingDigit: this.pendingDigit } =
                readSavedUndo(saved));
            this.hintsLeft = readSavedHints(saved);
            // Saves from before player names existed were already recorded when the game ended.
            this.submitted = saved.submitted !== false;
            this.render();

            if (this.gameStatus === 'playing') {
                this.showGameScreen();
            } else {
                this.showResult();
            }
            return;
        }

        this.startNewGame();
    }

    startNewGame() {
        // A finished game whose name was never entered is still recorded, anonymously and only on this device.
        if (this.gameStatus !== 'playing' && !this.submitted) {
            this.leaderboard.addEntry('', this.score, this.moves, countFilled(this.board), this.gameStatus);
        }
        // Invalidates any move animation still running for the previous game.
        this.generation += 1;
        this.submitted = true;
        this.board = createBoard();
        this.stream = createStream();
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
        this.isResolvingMove = false;
        this.undoState = null;
        this.undosLeft = UNDO_LIMIT;
        this.pendingDigit = null;
        this.hintsLeft = HINT_LIMIT;
        this.hintCell = null;
        this.showGameScreen();
        this.render();
        this.saveGameState();
    }

    confirmNewGame() {
        const inProgress = this.gameStatus === 'playing' && this.moves > 0;
        if (this.isResolvingMove || (inProgress && !window.confirm(TEXT.confirmNewGame))) {
            return;
        }
        this.startNewGame();
    }

    // Applies the whole move to the game state immediately (so it is saved right away),
    // then plays the animation from a snapshot of the board before the clear.
    async placeNumber(row, col) {
        if (this.gameStatus !== 'playing' || this.isResolvingMove || this.board[row][col] !== null) {
            return;
        }

        this.isResolvingMove = true;
        this.hintCell = null;
        const generation = this.generation;

        // The digit this move appends to the stream. After an undo the same digit is reused,
        // so undoing and replaying cannot be used to re-roll the stream.
        const appendedDigit = this.pendingDigit === null ? randomDigit() : this.pendingDigit;
        this.pendingDigit = null;
        const snapshot = createUndoSnapshot(this, appendedDigit);

        this.board[row][col] = this.stream[0];
        const matchedCells = findMatch(this.board, row, col);
        const boardBeforeClear = this.board.map(line => [...line]);

        this.moves += 1;
        this.stream.shift();
        this.stream.push(appendedDigit);

        if (matchedCells) {
            matchedCells.forEach(([r, c]) => {
                this.board[r][c] = null;
            });
            this.score += matchedCells.length * POINTS_PER_TILE;
        }

        this.gameStatus = getStatus(this.board);
        if (this.gameStatus === 'cleared') {
            this.score += CLEAR_BONUS;
        }
        // A finished game cannot be undone. Its record is added once the player enters a name (submitScore).
        this.undoState = this.gameStatus === 'playing' ? snapshot : null;
        this.submitted = this.gameStatus === 'playing';
        this.saveGameState();

        this.render(boardBeforeClear);
        this.animate([[row, col]], 'new-tile');

        if (matchedCells) {
            await delay(PLACE_DELAY_MS);
            if (generation !== this.generation) {
                return;
            }
            this.animate(matchedCells, 'matched');
            await delay(MATCH_DELAY_MS);
            if (generation !== this.generation) {
                return;
            }
            this.animate(matchedCells, 'removing');
            await delay(REMOVE_DELAY_MS);
            if (generation !== this.generation) {
                return;
            }
        }

        this.isResolvingMove = false;
        this.render();

        if (this.gameStatus !== 'playing') {
            await delay(RESULT_DELAY_MS);
            if (generation === this.generation) {
                this.showResult();
            }
        }
    }

    canUndo() {
        return this.undoState !== null && this.undosLeft > 0
            && this.gameStatus === 'playing' && !this.isResolvingMove;
    }

    // Restores the state before the last move. Not allowed while a move is animating or after the game ended.
    undoMove() {
        if (!this.canUndo()) {
            return;
        }

        const restored = restoreUndoSnapshot(this.undoState);
        // Invalidate any animation callbacks and drop leftover animation classes.
        this.generation += 1;
        this.board = restored.board;
        this.stream = restored.stream;
        this.score = restored.score;
        this.moves = restored.moves;
        this.pendingDigit = restored.pendingDigit;
        this.undoState = null;
        this.undosLeft -= 1;
        this.hintCell = null;
        this.statusPrefix = TEXT.undone(this.undosLeft);
        this.render();
        this.saveGameState();
    }

    canHint() {
        return this.hintsLeft > 0 && this.gameStatus === 'playing' && !this.isResolvingMove;
    }

    // Highlights the best matching empty cell for the current digit. Costs one hint only when a cell is found.
    // The highlight is transient (not saved) and cleared by the next move, undo or new game.
    showHint() {
        if (!this.canHint()) {
            return;
        }

        const found = findHint(this.board, this.stream[0]);
        if (!found) {
            this.statusPrefix = TEXT.noHint;
            this.statusElement.textContent = '';
            this.render();
            return;
        }

        this.hintsLeft -= 1;
        this.hintCell = found;
        this.statusPrefix = TEXT.hintFound(found[0], found[1], this.hintsLeft);
        this.render();
        this.saveGameState();
    }

    animate(positions, className) {
        positions.forEach(([r, c]) => {
            const cell = this.getCellElement(r, c);
            cell.classList.add(className);
            this.animatedCells.push(cell);
        });
    }

    getCellElement(row, col) {
        return this.cells[row * BOARD_SIZE + col];
    }

    showResult() {
        const titles = { cleared: TEXT.cleared, gameover: TEXT.gameOver, playing: TEXT.inProgress };
        this.resultTitle.textContent = titles[this.gameStatus];
        this.finalScore.textContent = this.score;
        this.finalMoves.textContent = this.moves;
        this.finalRemaining.textContent = countFilled(this.board);
        this.renderLeaderboard();

        const awaitingName = this.gameStatus !== 'playing' && !this.submitted;
        this.nameForm.classList.toggle('hidden', !awaitingName);
        if (awaitingName) {
            const remembered = readStorage('playerName');
            this.playerNameInput.value = typeof remembered === 'string' ? remembered : '';
        }

        this.gameScreen.classList.add('hidden');
        this.leaderboardScreen.classList.remove('hidden');
        // During a game the records screen can be closed; after the game ends only a new game is offered.
        this.continueBtn.classList.toggle('hidden', this.gameStatus !== 'playing');
        if (awaitingName) {
            this.playerNameInput.focus();
        } else {
            (this.gameStatus === 'playing' ? this.continueBtn : this.newGameBtn).focus();
        }
        this.refreshRemote();
    }

    setLeaderboardStatus(text) {
        if (this.leaderboardStatus.textContent !== text) {
            this.leaderboardStatus.textContent = text;
        }
    }

    // Loads the server leaderboard; on failure the local records stay on screen.
    async refreshRemote() {
        if (!this.remote.enabled) {
            return;
        }
        const token = ++this.remoteToken;
        this.setLeaderboardStatus(TEXT.loading);
        try {
            const entries = await this.remote.list();
            if (token !== this.remoteToken) {
                return;
            }
            this.leaderboard.remoteEntries = entries;
            this.setLeaderboardStatus('');
        } catch (error) {
            if (token !== this.remoteToken) {
                return;
            }
            console.warn('Failed to load the server leaderboard.', error);
            this.leaderboard.remoteEntries = null;
            this.setLeaderboardStatus(TEXT.offline);
        }
        this.renderLeaderboard();
        this.renderBest();
    }

    // Records the finished game under the entered name: always locally, and on the server when configured.
    async submitScore(rawName) {
        if (this.gameStatus === 'playing' || this.submitted) {
            return;
        }
        const name = sanitizePlayerName(rawName) || DEFAULT_PLAYER_NAME;
        const result = {
            name,
            score: this.score,
            moves: this.moves,
            remaining: countFilled(this.board),
            status: this.gameStatus
        };
        if (name !== DEFAULT_PLAYER_NAME) {
            writeStorage('playerName', name);
        }

        this.submitted = true;
        this.leaderboard.addEntry(result.name, result.score, result.moves, result.remaining, result.status);
        this.saveGameState();
        this.nameForm.classList.add('hidden');
        this.newGameBtn.focus();
        this.renderLeaderboard();
        this.renderBest();

        if (!this.remote.enabled) {
            return;
        }
        const token = ++this.remoteToken;
        this.setLeaderboardStatus(TEXT.submitting);
        try {
            const entries = await this.remote.submit(result);
            if (token === this.remoteToken) {
                this.leaderboard.remoteEntries = entries;
                this.setLeaderboardStatus(TEXT.saved);
            }
        } catch (error) {
            if (token === this.remoteToken) {
                console.warn('Failed to submit to the server leaderboard.', error);
                this.leaderboard.remoteEntries = null;
                this.setLeaderboardStatus(TEXT.saveFailed);
            }
        }
        if (token === this.remoteToken) {
            this.renderLeaderboard();
            this.renderBest();
        }
    }

    renderBest() {
        const [topEntry] = this.leaderboard.getTopEntries(1);
        this.bestElement.textContent = Math.max(this.score, topEntry ? topEntry.score : 0);
    }

    renderLeaderboard() {
        const entries = this.leaderboard.getTopEntries(10);
        this.leaderboardEntries.replaceChildren();

        if (entries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'entries-empty';
            empty.textContent = TEXT.noRecords;
            this.leaderboardEntries.appendChild(empty);
            return;
        }

        entries.forEach((entry, index) => {
            const date = new Date(entry.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const statusLabel = entry.status === 'cleared' ? TEXT.win : TEXT.end;

            const item = document.createElement('div');
            item.className = `entry rank-${index + 1}`;

            const rank = document.createElement('div');
            rank.className = 'entry-rank';
            rank.textContent = index + 1;

            const details = document.createElement('div');
            details.className = 'entry-details';

            const name = document.createElement('div');
            name.className = 'entry-name';
            name.textContent = entry.name;

            const score = document.createElement('div');
            score.className = 'entry-score';
            score.textContent = `${statusLabel} ${entry.score}`;

            const info = document.createElement('div');
            info.className = 'entry-info';
            info.textContent = `${TEXT.moves} ${entry.moves} | ${dateStr}`;

            details.append(name, score, info);
            item.append(rank, details);
            this.leaderboardEntries.appendChild(item);
        });
    }

    showGameScreen() {
        this.gameScreen.classList.remove('hidden');
        this.leaderboardScreen.classList.add('hidden');
    }

    // `displayBoard` lets a move animation show the board before tiles are cleared.
    render(displayBoard = this.board) {
        const locked = this.isResolvingMove || this.gameStatus !== 'playing';

        this.animatedCells.forEach(cell => cell.classList.remove('new-tile', 'matched', 'removing', 'hint'));
        this.animatedCells.length = 0;
        if (this.hintCell && displayBoard === this.board) {
            this.animate([this.hintCell], 'hint');
        }

        this.cells.forEach((cell, index) => {
            const row = Math.floor(index / BOARD_SIZE);
            const col = index % BOARD_SIZE;
            const value = displayBoard[row][col];
            const shown = this.shown[index];
            if (shown.value === value && shown.locked === locked) {
                return;
            }

            const filled = value !== null;
            if (shown.value !== value) {
                cell.className = `cell ${filled ? 'filled' : 'empty'}`;
                cell.textContent = filled ? value : '';
                cell.tabIndex = filled ? -1 : 0;
                cell.setAttribute('aria-label',
                    `${row + 1}행 ${col + 1}열, ${filled ? `숫자 ${value}` : '빈 칸'}`);
            }
            cell.setAttribute('aria-disabled', String(filled || locked));
            shown.value = value;
            shown.locked = locked;
        });

        this.stream.forEach((value, i) => {
            if (this.streamSpans[i].textContent !== String(value)) {
                this.streamSpans[i].textContent = value;
            }
        });

        const remaining = countFilled(this.board);
        this.scoreElement.textContent = this.score;
        this.movesElement.textContent = this.moves;
        this.remainingElement.textContent = remaining;
        this.renderBest();

        // Announce once per move: skip the intermediate render that shows the pre-clear board.
        if (displayBoard === this.board) {
            const status = this.statusPrefix + `점수 ${this.score}, 이동 ${this.moves}, 남은 타일 ${remaining}개. ` +
                `${this.stream[0]}을(를) 놓으세요.`;
            this.statusPrefix = '';
            if (this.statusElement.textContent !== status) {
                this.statusElement.textContent = status;
            }
        }

        const undoAvailable = this.canUndo();
        if (this.undoBtn.disabled === undoAvailable) {
            this.undoBtn.disabled = !undoAvailable;
        }
        if (this.undoCountElement.textContent !== String(this.undosLeft)) {
            this.undoCountElement.textContent = this.undosLeft;
        }

        const hintAvailable = this.canHint();
        if (this.hintBtn.disabled === hintAvailable) {
            this.hintBtn.disabled = !hintAvailable;
        }
        if (this.hintCountElement.textContent !== String(this.hintsLeft)) {
            this.hintCountElement.textContent = this.hintsLeft;
        }
    }

    saveGameState() {
        writeStorage('currentGame', {
            board: this.board,
            stream: this.stream,
            score: this.score,
            moves: this.moves,
            gameStatus: this.gameStatus,
            undo: this.undoState,
            undosLeft: this.undosLeft,
            hintsLeft: this.hintsLeft,
            pendingDigit: this.pendingDigit,
            submitted: this.submitted,
            savedAt: new Date().toISOString()
        });
    }
}

let game;
if (document.getElementById('board')) {
    document.addEventListener('DOMContentLoaded', () => {
        game = new SummingGame();
    });
}

if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker failed.', error));
    });
}
