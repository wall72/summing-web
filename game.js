// 게임 상태 타입 정의
const BOARD_SIZE = 9;
const INITIAL_GRID_SIZE = 7;
const STREAM_LENGTH = 4;

class SummingGame {
    constructor() {
        this.board = [];
        this.stream = [];
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing'; // 'playing' | 'cleared' | 'gameover'
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.bestMoves = parseInt(localStorage.getItem('bestMoves')) || null;
        
        this.initElements();
        this.initBoard();
        this.generateStream();
        this.render();
        this.updateRecords();
    }

    initElements() {
        this.boardElement = document.getElementById('board');
        this.scoreElement = document.getElementById('score');
        this.movesElement = document.getElementById('moves');
        this.remainingElement = document.getElementById('remaining');
        this.currentNumberElement = document.getElementById('currentNumber');
        this.upcomingNumbersElement = document.getElementById('upcomingNumbers');
        this.gameStatusElement = document.getElementById('gameStatus');
        this.highScoreElement = document.getElementById('highScore');
        this.bestMovesElement = document.getElementById('bestMoves');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.overlay = document.getElementById('overlay');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalMessage = document.getElementById('modalMessage');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');

        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.modalCloseBtn.addEventListener('click', () => this.hideModal());
    }

    initBoard() {
        // 9x9 보드 초기화
        this.board = Array(BOARD_SIZE).fill(null).map(() => 
            Array(BOARD_SIZE).fill(null)
        );

        // 중앙 7x7 영역에 랜덤 숫자 배치
        const startIdx = (BOARD_SIZE - INITIAL_GRID_SIZE) / 2;
        for (let i = startIdx; i < startIdx + INITIAL_GRID_SIZE; i++) {
            for (let j = startIdx; j < startIdx + INITIAL_GRID_SIZE; j++) {
                this.board[i][j] = Math.floor(Math.random() * 10); // 0-9
            }
        }
    }

    generateStream() {
        // 숫자 스트림 생성
        this.stream = [];
        for (let i = 0; i < STREAM_LENGTH; i++) {
            this.stream.push(Math.floor(Math.random() * 10)); // 0-9
        }
    }

    addToStream() {
        // 새로운 숫자를 스트림에 추가
        this.stream.push(Math.floor(Math.random() * 10));
    }

    getNeighbours(row, col) {
        // 8방향 이웃 좌표 반환
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
        // 새로 배치한 타일 기준으로 이웃 합 계산 및 매치 판정
        const placedNumber = this.board[row][col];
        const neighbours = this.getNeighbours(row, col);
        
        // 숫자가 있는 이웃만 필터링
        const filledNeighbours = neighbours.filter(
            ([r, c]) => this.board[r][c] !== null
        );

        if (filledNeighbours.length === 0) {
            return null; // 이웃이 없으면 매치 불가
        }

        // 이웃 숫자들의 합 계산
        const sum = filledNeighbours.reduce(
            (acc, [r, c]) => acc + this.board[r][c], 
            0
        );

        // 일의 자리 계산
        const lastDigit = sum % 10;

        // 매치 성공 시
        if (lastDigit === placedNumber) {
            // 제거할 셀 목록: 새로 배치한 타일 + 모든 이웃 타일
            const cellsToRemove = [[row, col], ...filledNeighbours];
            return cellsToRemove;
        }

        return null;
    }

    placeNumber(row, col) {
        // 이미 숫자가 있거나 게임이 끝난 경우
        if (this.board[row][col] !== null || this.gameStatus !== 'playing') {
            return;
        }

        // 현재 숫자를 보드에 배치
        const currentNumber = this.stream[0];
        this.board[row][col] = currentNumber;
        this.moves++;

        // 셀에 애니메이션 추가
        const cellElement = this.getCellElement(row, col);
        cellElement.classList.add('new-tile');

        // 매치 확인
        const matchedCells = this.checkMatch(row, col);

        if (matchedCells) {
            // 매치 성공
            setTimeout(() => {
                this.applyClear(matchedCells);
                
                // 스트림 업데이트
                this.stream.shift();
                this.addToStream();
                this.render();
            }, 300);
        } else {
            // 매치 실패
            this.stream.shift();
            this.addToStream();
            this.render();
            this.checkEndCondition();
        }
    }

    applyClear(cells) {
        // 매치된 셀들에 애니메이션 추가
        cells.forEach(([row, col]) => {
            const cellElement = this.getCellElement(row, col);
            cellElement.classList.add('matched');
        });

        // 셀들을 제거하고 점수 업데이트
        setTimeout(() => {
            cells.forEach(([row, col]) => {
                const cellElement = this.getCellElement(row, col);
                cellElement.classList.add('removing');
            });

            setTimeout(() => {
                cells.forEach(([row, col]) => {
                    this.board[row][col] = null;
                });

                // 점수 계산: 제거된 타일 개수 × 10점
                const points = cells.length * 10;
                this.score += points;

                this.render();
                this.checkEndCondition();
            }, 400);
        }, 500);
    }

    getCellElement(row, col) {
        const index = row * BOARD_SIZE + col;
        return this.boardElement.children[index];
    }

    checkEndCondition() {
        // 남은 숫자 타일 개수 확인
        let filledCount = 0;
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (this.board[i][j] !== null) {
                    filledCount++;
                }
            }
        }

        if (filledCount === 0) {
            // 완전 클리어
            this.gameStatus = 'cleared';
            this.score += 500; // 클리어 보너스
            this.showEndMessage('완승!', `축하합니다! 보드를 완전히 비웠습니다!<br>최종 점수: ${this.score}<br>배치 횟수: ${this.moves}`);
            this.updateBestRecords();
        } else if (filledCount === BOARD_SIZE * BOARD_SIZE) {
            // 보드가 가득 참
            this.gameStatus = 'gameover';
            this.showEndMessage('게임 오버', `보드가 가득 찼습니다.<br>최종 점수: ${this.score}<br>배치 횟수: ${this.moves}`);
            this.updateBestRecords();
        }
    }

    showEndMessage(title, message) {
        this.modalTitle.textContent = title;
        this.modalMessage.innerHTML = message;
        this.overlay.classList.remove('hidden');
    }

    hideModal() {
        this.overlay.classList.add('hidden');
    }

    updateBestRecords() {
        // 최고 점수 업데이트
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
        }

        // 최소 배치 횟수 업데이트 (완전 클리어 시에만)
        if (this.gameStatus === 'cleared') {
            if (this.bestMoves === null || this.moves < this.bestMoves) {
                this.bestMoves = this.moves;
                localStorage.setItem('bestMoves', this.bestMoves);
            }
        }

        this.updateRecords();
    }

    updateRecords() {
        this.highScoreElement.textContent = this.highScore;
        this.bestMovesElement.textContent = this.bestMoves !== null ? this.bestMoves : '-';
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
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                
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

        // 스트림 렌더링
        this.currentNumberElement.textContent = this.stream[0];
        this.upcomingNumbersElement.innerHTML = '';
        for (let i = 1; i < STREAM_LENGTH; i++) {
            const span = document.createElement('span');
            span.className = 'upcoming-number';
            span.textContent = this.stream[i];
            this.upcomingNumbersElement.appendChild(span);
        }

        // 정보 패널 업데이트
        this.scoreElement.textContent = this.score;
        this.movesElement.textContent = this.moves;
        this.remainingElement.textContent = this.getRemainingTiles();
    }

    startNewGame() {
        this.score = 0;
        this.moves = 0;
        this.gameStatus = 'playing';
        this.initBoard();
        this.generateStream();
        this.render();
        this.hideModal();
    }
}

// 게임 시작
let game;
if (document.getElementById('board')) {
    document.addEventListener('DOMContentLoaded', () => {
        game = new SummingGame();
    });
}
