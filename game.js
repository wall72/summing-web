const {
    BOARD_SIZE, STREAM_LENGTH, POINTS_PER_TILE, CLEAR_BONUS,
    createBoard, createStream, randomDigit, findMatch, countFilled, getStatus,
    isValidSavedGame, isValidLeaderboardEntry, addLeaderboardEntry
} = SummingLogic;

// Keep in sync with the CSS animation durations in styles.css.
const PLACE_DELAY_MS = 300;
const MATCH_DELAY_MS = 500;
const REMOVE_DELAY_MS = 400;
const RESULT_DELAY_MS = 1000;

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

class LeaderboardManager {
    constructor() {
        const saved = readStorage('leaderboard');
        this.entries = Array.isArray(saved) ? saved.filter(isValidLeaderboardEntry) : [];
    }

    addEntry(score, moves, remaining, status) {
        const entry = {
            score,
            moves,
            remaining,
            status,
            date: new Date().toISOString(),
            timestamp: Date.now()
        };
        this.entries = addLeaderboardEntry(this.entries, entry);
        writeStorage('leaderboard', this.entries);
    }

    getTopEntries(count = 10) {
        return this.entries.slice(0, count);
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
        this.leaderboard = new LeaderboardManager();

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

        this.newGameBtn = document.getElementById('newGameBtn');
        this.newGameBtn.addEventListener('click', () => this.startNewGame());
    }

    // Build the 81 cells once; render() only updates them. One delegated listener handles input.
    buildBoard() {
        this.cells = [];
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
        this.board = createBoard();
        this.stream = createStream();
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
        this.isResolvingMove = false;
        this.showGameScreen();
        this.render();
        this.saveGameState();
    }

    // Applies the whole move to the game state immediately (so it is saved right away),
    // then plays the animation from a snapshot of the board before the clear.
    async placeNumber(row, col) {
        if (this.gameStatus !== 'playing' || this.isResolvingMove || this.board[row][col] !== null) {
            return;
        }

        this.isResolvingMove = true;

        this.board[row][col] = this.stream[0];
        const matchedCells = findMatch(this.board, row, col);
        const boardBeforeClear = this.board.map(line => [...line]);

        this.moves += 1;
        this.stream.shift();
        this.stream.push(randomDigit());

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
        if (this.gameStatus !== 'playing') {
            this.leaderboard.addEntry(this.score, this.moves, countFilled(this.board), this.gameStatus);
        }
        this.saveGameState();

        this.render(boardBeforeClear);
        this.getCellElement(row, col).classList.add('new-tile');

        if (matchedCells) {
            await delay(PLACE_DELAY_MS);
            matchedCells.forEach(([r, c]) => this.getCellElement(r, c).classList.add('matched'));
            await delay(MATCH_DELAY_MS);
            matchedCells.forEach(([r, c]) => this.getCellElement(r, c).classList.add('removing'));
            await delay(REMOVE_DELAY_MS);
        }

        this.isResolvingMove = false;
        this.render();

        if (this.gameStatus !== 'playing') {
            await delay(RESULT_DELAY_MS);
            this.showResult();
        }
    }

    getCellElement(row, col) {
        return this.cells[row * BOARD_SIZE + col];
    }

    showResult() {
        const title = this.gameStatus === 'cleared' ? 'Cleared!' : 'Game Over';
        this.resultTitle.textContent = title;
        this.finalScore.textContent = this.score;
        this.finalMoves.textContent = this.moves;
        this.finalRemaining.textContent = countFilled(this.board);
        this.renderLeaderboard();

        this.gameScreen.classList.add('hidden');
        this.leaderboardScreen.classList.remove('hidden');
        this.newGameBtn.focus();
    }

    renderLeaderboard() {
        const entries = this.leaderboard.getTopEntries(10);
        this.leaderboardEntries.replaceChildren();

        if (entries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'entries-empty';
            empty.textContent = 'No records yet.';
            this.leaderboardEntries.appendChild(empty);
            return;
        }

        entries.forEach((entry, index) => {
            const date = new Date(entry.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const statusLabel = entry.status === 'cleared' ? 'WIN' : 'END';

            const item = document.createElement('div');
            item.className = `entry rank-${index + 1}`;

            const rank = document.createElement('div');
            rank.className = 'entry-rank';
            rank.textContent = index + 1;

            const details = document.createElement('div');
            details.className = 'entry-details';

            const score = document.createElement('div');
            score.className = 'entry-score';
            score.textContent = `${statusLabel} ${entry.score}`;

            const info = document.createElement('div');
            info.className = 'entry-info';
            info.textContent = `Moves: ${entry.moves} | ${dateStr}`;

            details.append(score, info);
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

        this.cells.forEach((cell, index) => {
            const row = Math.floor(index / BOARD_SIZE);
            const col = index % BOARD_SIZE;
            const value = displayBoard[row][col];
            const filled = value !== null;

            cell.className = `cell ${filled ? 'filled' : 'empty'}`;
            cell.textContent = filled ? value : '';
            cell.tabIndex = filled ? -1 : 0;
            cell.setAttribute('aria-disabled', String(filled || locked));
            cell.setAttribute('aria-label',
                `Row ${row + 1}, column ${col + 1}, ${filled ? `tile ${value}` : 'empty'}`);
        });

        this.streamNumbersElement.replaceChildren(
            ...this.stream.map((value, i) => {
                const span = document.createElement('span');
                span.className = i === 0 ? 'stream-num current' : 'stream-num';
                span.textContent = value;
                return span;
            })
        );

        this.scoreElement.textContent = this.score;
        this.movesElement.textContent = this.moves;
        this.remainingElement.textContent = countFilled(this.board);

        if (this.statusElement) {
            this.statusElement.textContent =
                `Score ${this.score}. Moves ${this.moves}. ${countFilled(this.board)} tiles left. ` +
                `Place ${this.stream[0]}.`;
        }
    }

    saveGameState() {
        writeStorage('currentGame', {
            board: this.board,
            stream: this.stream,
            score: this.score,
            moves: this.moves,
            gameStatus: this.gameStatus,
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
