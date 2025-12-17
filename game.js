// 게임 상수
const BOARD_SIZE = 9;
const INITIAL_GRID_SIZE = 7;
const STREAM_LENGTH = 5; // 5개로 증가

class LeaderboardManager {
    constructor() {
        this.entries = this.load();
    }

    load() {
        const data = localStorage.getItem('leaderboard');
        return data ? JSON.parse(data) : [];
    }

    save() {
        localStorage.setItem('leaderboard', JSON.stringify(this.entries));
    }

    addEntry(score, moves, remaining, status) {
        const entry = {
            score,
            moves,
            remaining,
            status, // 'cleared' or 'gameover'
            date: new Date().toISOString(),
            timestamp: Date.now()
        };

        this.entries.push(entry);
        this.entries.sort((a, b) => {
            // 점수 높은 순
            if (b.score !== a.score) return b.score - a.score;
            // 점수 같으면 배치 횟수 적은 순
            if (a.moves !== b.moves) return a.moves - b.moves;
            // 둘 다 같으면 최신 순
            return b.timestamp - a.timestamp;
        });

        // 상위 20개만 유지
        this.entries = this.entries.slice(0, 20);
        this.save();
    }

    getTopEntries(count = 10) {
        return this.entries.slice(0, count);
    }

    clear() {
        this.entries = [];
        this.save();
    }
}

class SummingGame {
    constructor() {
        this.board = [];
        this.stream = [];
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
        this.leaderboard = new LeaderboardManager();
        
        this.initElements();
        this.loadOrStartGame();
    }

    initElements() {
        // 게임 화면 요소
        this.gameScreen = document.getElementById('gameScreen');
        this.leaderboardScreen = document.getElementById('leaderboardScreen');
        
        this.boardElement = document.getElementById('board');
        this.scoreElement = document.getElementById('score');
        this.movesElement = document.getElementById('moves');
        this.remainingElement = document.getElementById('remaining');
        this.streamNumbersElement = document.getElementById('streamNumbers');
        
        // 리더보드 화면 요소
        this.resultTitle = document.getElementById('resultTitle');
        this.finalScore = document.getElementById('finalScore');
        this.finalMoves = document.getElementById('finalMoves');
        this.finalRemaining = document.getElementById('finalRemaining');
        this.leaderboardEntries = document.getElementById('leaderboardEntries');
        
        // 버튼
        this.newGameBtn = document.getElementById('newGameBtn');
        this.continueBtn = document.getElementById('continueBtn');
        
        // 이벤트 리스너
        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.continueBtn.addEventListener('click', () => this.continueGame());
    }

    loadOrStartGame() {
        const savedGame = this.loadGameState();
        
        if (savedGame && savedGame.gameStatus === 'playing') {
            // 저장된 게임 복원
            this.board = savedGame.board;
            this.stream = savedGame.stream;
            this.score = savedGame.score;
            this.moves = savedGame.moves;
            this.gameStatus = savedGame.gameStatus;
            this.showGameScreen();
            this.render();
        } else {
            // 새 게임 시작
            this.startNewGame();
        }
    }

    startNewGame() {
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
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
        this.board = Array(BOARD_SIZE).fill(null).map(() => 
            Array(BOARD_SIZE).fill(null)
        );

        const startIdx = (BOARD_SIZE - INITIAL_GRID_SIZE) / 2;
        for (let i = startIdx; i < startIdx + INITIAL_GRID_SIZE; i++) {
            for (let j = startIdx; j < startIdx + INITIAL_GRID_SIZE; j++) {
                this.board[i][j] = Math.floor(Math.random() * 10);
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

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (newRow >= 0 && newRow < BOARD_SIZE && 
                newCol >= 0 && newCol < BOARD_SIZE) {
                neighbours.push([newRow, newCol]);
            }
        }

        return neighbours;
    }

    checkMatch(row, col) {
        const placedNumber = this.board[row][col];
        const neighbours = this.getNeighbours(row, col);
        
        const filledNeighbours = neighbours.filter(
            ([r, c]) => this.board[r][c] !== null
        );

        if (filledNeighbours.length === 0) {
            return null;
        }

        const sum = filledNeighbours.reduce(
            (acc, [r, c]) => acc + this.board[r][c], 
            0
        );

        const lastDigit = sum % 10;

        if (lastDigit === placedNumber) {
            return [[row, col], ...filledNeighbours];
        }

        return null;
    }

    placeNumber(row, col) {
        if (this.board[row][col] !== null || this.gameStatus !== 'playing') {
            return;
        }

        const currentNumber = this.stream[0];
        this.board[row][col] = currentNumber;
        this.moves++;

        const cellElement = this.getCellElement(row, col);
        cellElement.classList.add('new-tile');

        const matchedCells = this.checkMatch(row, col);

        if (matchedCells) {
            setTimeout(() => {
                this.applyClear(matchedCells);
                this.stream.shift();
                this.addToStream();
                this.render();
                this.saveGameState();
            }, 300);
        } else {
            this.stream.shift();
            this.addToStream();
            this.render();
            this.checkEndCondition();
            this.saveGameState();
        }
    }

    applyClear(cells) {
        cells.forEach(([row, col]) => {
            const cellElement = this.getCellElement(row, col);
            cellElement.classList.add('matched');
        });

        setTimeout(() => {
            cells.forEach(([row, col]) => {
                const cellElement = this.getCellElement(row, col);
                cellElement.classList.add('removing');
            });

            setTimeout(() => {
                cells.forEach(([row, col]) => {
                    this.board[row][col] = null;
                });

                const points = cells.length * 10;
                this.score += points;

                this.render();
                this.checkEndCondition();
                this.saveGameState();
            }, 400);
        }, 500);
    }

    getCellElement(row, col) {
        const index = row * BOARD_SIZE + col;
        return this.boardElement.children[index];
    }

    checkEndCondition() {
        let filledCount = 0;
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (this.board[i][j] !== null) {
                    filledCount++;
                }
            }
        }

        if (filledCount === 0) {
            this.gameStatus = 'cleared';
            this.score += 500;
            this.endGame('완승! 🎉', 'cleared');
        } else if (filledCount === BOARD_SIZE * BOARD_SIZE) {
            this.gameStatus = 'gameover';
            this.endGame('게임 오버', 'gameover');
        }
    }

    endGame(title, status) {
        // 리더보드에 추가
        this.leaderboard.addEntry(
            this.score,
            this.moves,
            this.getRemainingTiles(),
            status
        );

        // 게임 상태 저장
        this.saveGameState();

        // 리더보드 화면 표시
        setTimeout(() => {
            this.showLeaderboard(title);
        }, 1000);
    }

    showLeaderboard(title) {
        this.resultTitle.textContent = title;
        this.finalScore.textContent = this.score;
        this.finalMoves.textContent = this.moves;
        this.finalRemaining.textContent = this.getRemainingTiles();

        // 리더보드 엔트리 표시
        this.renderLeaderboard();

        // 화면 전환
        this.gameScreen.classList.add('hidden');
        this.leaderboardScreen.classList.remove('hidden');

        // 계속하기 버튼 숨김 (게임 종료 후)
        this.continueBtn.classList.add('hidden');
    }

    renderLeaderboard() {
        const entries = this.leaderboard.getTopEntries(10);
        this.leaderboardEntries.innerHTML = '';

        if (entries.length === 0) {
            this.leaderboardEntries.innerHTML = '<p style="text-align: center; color: #6c757d;">아직 기록이 없습니다</p>';
            return;
        }

        entries.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = `entry rank-${index + 1}`;
            
            const date = new Date(entry.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            
            const statusIcon = entry.status === 'cleared' ? '🏆' : '⏹️';
            
            div.innerHTML = `
                <div class="entry-rank">${index + 1}</div>
                <div class="entry-details">
                    <div class="entry-score">${statusIcon} ${entry.score}점</div>
                    <div class="entry-info">
                        배치: ${entry.moves}회 | ${dateStr}
                    </div>
                </div>
            `;
            
            this.leaderboardEntries.appendChild(div);
        });
    }

    showGameScreen() {
        this.gameScreen.classList.remove('hidden');
        this.leaderboardScreen.classList.add('hidden');
    }

    getRemainingTiles() {
        let count = 0;
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (this.board[i][j] !== null) {
                    count++;
                }
            }
        }
        return count;
    }

    render() {
        // 보드 렌더링
        this.boardElement.innerHTML = '';
        const cellSize = Math.min(
            window.innerWidth / (BOARD_SIZE + 2),
            (window.innerHeight - 250) / (BOARD_SIZE + 2)
        );
        
        const fontSize = Math.max(cellSize * 0.4, 12);
        
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.style.fontSize = `${fontSize}px`;
                
                const value = this.board[i][j];
                if (value !== null) {
                    cell.textContent = value;
                    cell.classList.add('filled');
                } else {
                    cell.classList.add('empty');
                    cell.addEventListener('click', () => this.placeNumber(i, j));
                }
                
                this.boardElement.appendChild(cell);
            }
        }

        // 스트림 렌더링 (5개)
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

        // 통계 업데이트
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
        const data = localStorage.getItem('currentGame');
        return data ? JSON.parse(data) : null;
    }

    clearGameState() {
        localStorage.removeItem('currentGame');
    }
}

// 게임 시작
let game;
if (document.getElementById('board')) {
    document.addEventListener('DOMContentLoaded', () => {
        game = new SummingGame();
    });
}
