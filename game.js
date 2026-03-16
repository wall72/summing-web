const BOARD_SIZE = 9;
const INITIAL_GRID_SIZE = 7;
const STREAM_LENGTH = 5;

class LeaderboardManager {
    constructor() {
        this.entries = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem('leaderboard');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.warn('Failed to load leaderboard data. Resetting saved leaderboard.', error);
            localStorage.removeItem('leaderboard');
            return [];
        }
    }

    save() {
        localStorage.setItem('leaderboard', JSON.stringify(this.entries));
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

        this.entries.push(entry);
        this.entries.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }

            if (a.moves !== b.moves) {
                return a.moves - b.moves;
            }

            return b.timestamp - a.timestamp;
        });

        this.entries = this.entries.slice(0, 20);
        this.save();
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

        this.resultTitle = document.getElementById('resultTitle');
        this.finalScore = document.getElementById('finalScore');
        this.finalMoves = document.getElementById('finalMoves');
        this.finalRemaining = document.getElementById('finalRemaining');
        this.leaderboardEntries = document.getElementById('leaderboardEntries');

        this.newGameBtn = document.getElementById('newGameBtn');
        this.continueBtn = document.getElementById('continueBtn');

        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => this.startNewGame());
        }

        if (this.continueBtn) {
            this.continueBtn.addEventListener('click', () => this.continueGame());
        }
    }

    loadOrStartGame() {
        const savedGame = this.loadGameState();

        if (savedGame && savedGame.gameStatus === 'playing') {
            this.board = savedGame.board;
            this.stream = savedGame.stream;
            this.score = savedGame.score;
            this.moves = savedGame.moves;
            this.gameStatus = savedGame.gameStatus;
            this.isResolvingMove = false;
            this.showGameScreen();
            this.render();
            return;
        }

        this.startNewGame();
    }

    startNewGame() {
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
        this.isResolvingMove = false;
        this.initBoard();
        this.generateStream();
        this.showGameScreen();
        this.render();
        this.saveGameState();
    }

    continueGame() {
        this.showGameScreen();
    }

    initBoard() {
        this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

        const startIdx = (BOARD_SIZE - INITIAL_GRID_SIZE) / 2;
        for (let row = startIdx; row < startIdx + INITIAL_GRID_SIZE; row++) {
            for (let col = startIdx; col < startIdx + INITIAL_GRID_SIZE; col++) {
                this.board[row][col] = Math.floor(Math.random() * 10);
            }
        }
    }

    generateStream() {
        this.stream = [];
        for (let i = 0; i < STREAM_LENGTH; i++) {
            this.stream.push(Math.floor(Math.random() * 10));
        }
    }

    addToStream() {
        this.stream.push(Math.floor(Math.random() * 10));
    }

    getNeighbours(row, col) {
        const neighbours = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dRow, dCol] of directions) {
            const nextRow = row + dRow;
            const nextCol = col + dCol;

            if (nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE) {
                neighbours.push([nextRow, nextCol]);
            }
        }

        return neighbours;
    }

    checkMatch(row, col) {
        const placedNumber = this.board[row][col];
        const neighbours = this.getNeighbours(row, col);
        const filledNeighbours = neighbours.filter(([nRow, nCol]) => this.board[nRow][nCol] !== null);

        if (filledNeighbours.length === 0) {
            return null;
        }

        const sum = filledNeighbours.reduce((acc, [nRow, nCol]) => acc + this.board[nRow][nCol], 0);

        return sum % 10 === placedNumber ? [[row, col], ...filledNeighbours] : null;
    }

    placeNumber(row, col) {
        if (this.gameStatus !== 'playing' || this.isResolvingMove || this.board[row][col] !== null) {
            return;
        }

        this.isResolvingMove = true;

        const currentNumber = this.stream[0];
        this.board[row][col] = currentNumber;
        this.moves += 1;
        this.render();

        const cellElement = this.getCellElement(row, col);
        if (cellElement) {
            cellElement.classList.add('new-tile');
        }

        const matchedCells = this.checkMatch(row, col);

        if (!matchedCells) {
            this.stream.shift();
            this.addToStream();
            this.isResolvingMove = false;
            this.render();
            this.checkEndCondition();
            this.saveGameState();
            return;
        }

        setTimeout(() => {
            this.stream.shift();
            this.addToStream();
            this.applyClear(matchedCells, () => {
                this.isResolvingMove = false;
                this.render();
            });
        }, 300);
    }

    applyClear(cells, onComplete = () => {}) {
        cells.forEach(([row, col]) => {
            const cellElement = this.getCellElement(row, col);
            if (cellElement) {
                cellElement.classList.add('matched');
            }
        });

        setTimeout(() => {
            cells.forEach(([row, col]) => {
                const cellElement = this.getCellElement(row, col);
                if (cellElement) {
                    cellElement.classList.add('removing');
                }
            });

            setTimeout(() => {
                cells.forEach(([row, col]) => {
                    this.board[row][col] = null;
                });

                this.score += cells.length * 10;
                this.checkEndCondition();
                this.saveGameState();
                onComplete();
            }, 400);
        }, 500);
    }

    getCellElement(row, col) {
        if (!this.boardElement) {
            return null;
        }

        const index = row * BOARD_SIZE + col;
        return this.boardElement.children[index] || null;
    }

    checkEndCondition() {
        const filledCount = this.getRemainingTiles();

        if (filledCount === 0) {
            this.gameStatus = 'cleared';
            this.score += 500;
            this.endGame('Cleared!', 'cleared');
        } else if (filledCount === BOARD_SIZE * BOARD_SIZE) {
            this.gameStatus = 'gameover';
            this.endGame('Game Over', 'gameover');
        }
    }

    endGame(title, status) {
        this.leaderboard.addEntry(this.score, this.moves, this.getRemainingTiles(), status);
        this.saveGameState();

        setTimeout(() => {
            this.showLeaderboard(title);
        }, 1000);
    }

    showLeaderboard(title) {
        this.resultTitle.textContent = title;
        this.finalScore.textContent = this.score;
        this.finalMoves.textContent = this.moves;
        this.finalRemaining.textContent = this.getRemainingTiles();
        this.renderLeaderboard();

        this.gameScreen.classList.add('hidden');
        this.leaderboardScreen.classList.remove('hidden');
        this.continueBtn.classList.add('hidden');
    }

    renderLeaderboard() {
        const entries = this.leaderboard.getTopEntries(10);
        this.leaderboardEntries.innerHTML = '';

        if (entries.length === 0) {
            this.leaderboardEntries.innerHTML = '<p style="text-align: center; color: #6c757d;">No records yet.</p>';
            return;
        }

        entries.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = `entry rank-${index + 1}`;

            const date = new Date(entry.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const statusLabel = entry.status === 'cleared' ? 'WIN' : 'END';

            item.innerHTML = `
                <div class="entry-rank">${index + 1}</div>
                <div class="entry-details">
                    <div class="entry-score">${statusLabel} ${entry.score}</div>
                    <div class="entry-info">Moves: ${entry.moves} | ${dateStr}</div>
                </div>
            `;

            this.leaderboardEntries.appendChild(item);
        });
    }

    showGameScreen() {
        this.gameScreen.classList.remove('hidden');
        this.leaderboardScreen.classList.add('hidden');
    }

    getRemainingTiles() {
        let count = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.board[row][col] !== null) {
                    count += 1;
                }
            }
        }

        return count;
    }

    render() {
        this.boardElement.innerHTML = '';

        const cellSize = Math.min(
            window.innerWidth / (BOARD_SIZE + 2),
            (window.innerHeight - 250) / (BOARD_SIZE + 2)
        );
        const fontSize = Math.max(cellSize * 0.4, 12);

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.style.fontSize = `${fontSize}px`;

                const value = this.board[row][col];
                if (value !== null) {
                    cell.textContent = value;
                    cell.classList.add('filled');
                } else {
                    cell.classList.add('empty');
                    if (!this.isResolvingMove) {
                        cell.addEventListener('click', () => this.placeNumber(row, col));
                    }
                }

                this.boardElement.appendChild(cell);
            }
        }

        this.streamNumbersElement.innerHTML = '';
        for (let i = 0; i < STREAM_LENGTH; i++) {
            const span = document.createElement('span');
            span.className = 'stream-num';
            if (i === 0) {
                span.classList.add('current');
            }
            span.textContent = this.stream[i];
            this.streamNumbersElement.appendChild(span);
        }

        this.scoreElement.textContent = this.score;
        this.movesElement.textContent = this.moves;
        this.remainingElement.textContent = this.getRemainingTiles();
    }

    saveGameState() {
        const gameState = {
            board: this.board,
            stream: this.stream,
            score: this.score,
            moves: this.moves,
            gameStatus: this.gameStatus,
            savedAt: new Date().toISOString()
        };

        localStorage.setItem('currentGame', JSON.stringify(gameState));
    }

    loadGameState() {
        try {
            const data = localStorage.getItem('currentGame');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to load saved game. Resetting current game state.', error);
            localStorage.removeItem('currentGame');
            return null;
        }
    }
}

let game;
if (document.getElementById('board')) {
    document.addEventListener('DOMContentLoaded', () => {
        game = new SummingGame();
    });
}
