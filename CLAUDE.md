# CLAUDE.md

Summing Mobile: 9x9 숫자 배치 퍼즐 게임. 빌드 단계 없는 정적 HTML/CSS/바닐라 JS, 저장은 `localStorage`만 사용 (백엔드 없음).

## 실행 / 테스트

- 실행: `python -m http.server 8000` 후 `http://localhost:8000` (index.html 직접 열기도 가능)
- 테스트: `npm test` (Node 내장 러너, 외부 의존성 없음). `tests/logic.test.js` 가 `logic.js` 를 검증
- 배포: master 푸시 시 `.github/workflows/pages.yml` 이 테스트 후 GitHub Pages 에 배포 (Pages 소스는 "GitHub Actions")
- 빌드/번들러 없음. 의존성 추가 시 사용자 확인 먼저.

## 파일 구조

- `index.html` - 게임 화면(`#gameScreen`)과 결과/리더보드 화면(`#leaderboardScreen`)
- `logic.js` - 순수 게임 로직(보드/스트림 생성, 매치, 종료 판정, 저장 데이터 검증, 리더보드 정렬). DOM/localStorage 사용 금지. 브라우저 전역 `SummingLogic` 및 Node `require` 둘 다 지원
- `game.js` - `LeaderboardManager` + `SummingGame`(DOM 렌더링, 입력, 애니메이션, 저장). 규칙 로직은 `logic.js` 에 추가
- `styles.css` - 반응형(세로/가로) 스타일, 타일 애니메이션
- `tests/` - `node --test` 용 테스트

## 게임 규칙 (변경 시 `logic.js` 와 `tests/` 도 함께 수정)

- 보드 9x9, 시작 시 가운데 7x7에 0~9 랜덤 숫자, 바깥 테두리는 비어 있음
- 스트림 5개. 첫 숫자가 현재 배치할 숫자. 배치 후 맨 앞 제거, 랜덤 1개 추가
- 빈 칸에만 배치 가능. 이동 처리 중(`isResolvingMove`)에는 입력 잠금
- 이웃은 8방향. 배치 후 채워진 이웃 합 `% 10` 이 배치한 숫자와 같으면 배치 타일 + 이웃 전부 제거. 채워진 이웃이 없으면 매치 불가
- 점수: 제거 타일 수 x 10, 보드 전체 클리어 시 +500
- 종료: `cleared`(타일 0개), `gameover`(81칸 가득)

## 저장 데이터 (`localStorage`)

- `currentGame`: `board, stream, score, moves, gameStatus, savedAt`. `gameStatus === 'playing'` 일 때만 복원. JSON 손상 시 폐기 후 새 게임
- `leaderboard`: 최대 20개. `{score, moves, remaining, status, date, timestamp}`. 정렬: 점수 높은 순 -> 이동 적은 순 -> 최신 순. 손상 시 폐기

## 코딩 컨벤션

- 4칸 들여쓰기, 작은따옴표, 세미콜론 사용 (기존 스타일 유지)
- 프레임워크/번들러 도입 금지 (비목표). 바닐라 JS 유지
- UI 문구는 현재 영어. 한글화 시 UTF-8(BOM 없음)로 저장
- 비목표: 계정, 온라인 리더보드, 멀티플레이, 오디오, undo/힌트
- `game.js` 의 애니메이션 상수는 `styles.css` 의 duration 과 맞출 것

## 개선 과제

완료: 저장 데이터 검증, 종료 후 결과 화면 복원, 이동 즉시 저장, 이벤트 위임 + 셀 재사용 렌더, CSS(cqw) 기반 글자 크기, 리더보드 textContent 렌더, 로직 분리 + `node --test`, async 애니메이션 흐름, BOM 제거, `.gitignore`, 키보드/스크린리더 지원(`button` 셀, `aria-label`, `aria-live`), GitHub Pages 배포.

남은 후보:
1. 한글 UI 복원 (UTF-8, BOM 없음) 및 문구 분리
2. 최고 점수 표시, 게임 중 새 게임/리더보드 버튼과 확인 대화상자
3. PWA (manifest + service worker)로 홈 화면 설치
4. 브라우저 UI 자동 테스트(Playwright) CI 추가

## 작업 원칙

- 규칙을 바꾸면 이 파일, README.md, `tests/` 를 함께 갱신
- 변경 후 `npm test` 실행
