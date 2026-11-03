# CLAUDE.md

Summing Mobile: 9x9 숫자 배치 퍼즐 게임. 빌드 단계 없는 정적 HTML/CSS/바닐라 JS, 저장은 `localStorage`만 사용 (백엔드 없음).

## 실행 / 테스트

- 실행: `python -m http.server 8000` 후 `http://localhost:8000` (index.html 직접 열기도 가능)
- 단위 테스트: `npm test` (Node 내장 러너). `tests/logic.test.js` 가 `logic.js` 를 검증
- E2E 테스트: `npm run test:e2e` (Playwright, 모바일/데스크톱 2개 프로젝트, `e2e/game.spec.js`). 정적 서버(포트 4173)는 자동 실행. 브라우저 설치는 `npx playwright install chromium`, 이미 설치된 Chromium 을 쓰려면 `PW_CHROMIUM_PATH=/경로/chromium`
- 배포: master 푸시 시 `.github/workflows/pages.yml` 이 단위·E2E 테스트 통과 후 GitHub Pages 에 배포 (Pages 소스는 "GitHub Actions")
- 빌드/번들러 없음. 런타임 의존성 없음 (devDependency 는 `@playwright/test` 뿐). 의존성 추가 시 사용자 확인 먼저.

## 파일 구조

- `index.html` - 게임 화면(`#gameScreen`)과 결과/리더보드 화면(`#leaderboardScreen`)
- `logic.js` - 순수 게임 로직(보드/스트림 생성, 매치, 종료 판정, 저장 데이터 검증, 되돌리기 스냅샷, 리더보드 정렬). DOM/localStorage 사용 금지. 브라우저 전역 `SummingLogic` 및 Node `require` 둘 다 지원
- `game.js` - `LeaderboardManager` + `SummingGame`(DOM 렌더링, 입력, 애니메이션, 저장). 규칙 로직은 `logic.js` 에 추가
- `sw.js`, `manifest.webmanifest`, `icon.svg` - PWA. 캐시 우선(버전 단위 일괄 캐시)이라 캐시 대상 파일을 바꾸면 `sw.js` 의 `CACHE` 버전을 반드시 올리고 `SHELL`, `pages.yml` 의 복사 목록도 함께 수정
- `styles.css` - 반응형(세로/가로) 스타일, 타일 애니메이션 (모바일 터치 우선, 방향키 조작은 비목표)
- `tests/` - `node --test` 용 단위 테스트
- `e2e/`, `playwright.config.js` - Playwright E2E 테스트

## 게임 규칙 (변경 시 `logic.js` 와 `tests/` 도 함께 수정)

- 보드 9x9, 시작 시 가운데 7x7에 0~9 랜덤 숫자, 바깥 테두리는 비어 있음
- 스트림 5개. 첫 숫자가 현재 배치할 숫자. 배치 후 맨 앞 제거, 랜덤 1개 추가
- 빈 칸에만 배치 가능. 이동 처리 중(`isResolvingMove`)에는 입력 잠금
- 이웃은 8방향. 배치 후 채워진 이웃 합 `% 10` 이 배치한 숫자와 같으면 배치 타일 + 이웃 전부 제거. 채워진 이웃이 없으면 매치 불가
- 점수: 제거 타일 수 x 10, 보드 전체 클리어 시 +500
- 종료: `cleared`(타일 0개), `gameover`(81칸 가득)
- 되돌리기: 직전 1수만, 게임당 `UNDO_LIMIT`(3)회. 보드/스트림/점수/이동 수를 그대로 복원(감점 없음). 되돌린 뒤 다시 놓을 때 스트림에 붙는 숫자는 되돌리기 전과 같음(`pendingDigit`, 재추첨 방지). 이동 처리 중과 종료 후에는 불가(종료 이동은 스냅샷을 만들지 않음). 새 게임 시 횟수 초기화
- 힌트: 현재 숫자(`stream[0]`)가 매치되는 빈 칸 1곳을 하이라이트(`findHint`). 여러 곳이면 제거 타일이 가장 많은 칸, 동률이면 행 우선 첫 칸. 게임당 `HINT_LIMIT`(3)회, 감점 없음, 매치 칸이 없으면 횟수 차감 없이 안내만. 하이라이트는 일시적(저장 안 함)이며 배치/되돌리기/새 게임 시 해제. 이동 처리 중과 종료 후에는 불가. 이동 수/스냅샷/`pendingDigit` 에는 영향 없음. 새 게임 시 횟수 초기화

## 저장 데이터 (`localStorage`)

- `currentGame`: `board, stream, score, moves, gameStatus, savedAt`, 선택 필드 `undo`(직전 상태 스냅샷), `undosLeft`, `pendingDigit`, `hintsLeft`. `gameStatus === 'playing'` 일 때만 복원. JSON 손상 시 폐기 후 새 게임. 선택 필드가 없거나 손상되면 그 필드만 기본값(`undo` 없음, 3회, `pendingDigit` 없음)으로 되돌리고 게임은 유지(`readSavedUndo`; `hintsLeft` 는 `readSavedHints` 로 같은 방식, 기본 3회)
- `leaderboard`: 최대 20개. `{score, moves, remaining, status, date, timestamp}`. 정렬: 점수 높은 순 -> 이동 적은 순 -> 최신 순. 손상 시 폐기

## 코딩 컨벤션

- 4칸 들여쓰기, 작은따옴표, 세미콜론 사용 (기존 스타일 유지)
- 프레임워크/번들러 도입 금지 (비목표). 바닐라 JS 유지
- UI 문구는 한국어. `index.html` 의 정적 문구와 `game.js` 의 `TEXT`/`aria-label` 에 있음. 파일은 UTF-8(BOM 없음)
- 비목표: 계정, 온라인 리더보드, 멀티플레이, 오디오, 방향키 이동, 여러 수 되돌리기/다시 실행(redo)
- `game.js` 의 애니메이션 상수는 `styles.css` 의 duration 과 맞출 것

## 개선 과제

완료: 저장 데이터 검증, 종료 후 결과 화면 복원, 이동 즉시 저장, 이벤트 위임 + 셀 재사용 렌더, CSS(cqw) 기반 글자 크기, 리더보드 textContent 렌더, 로직 분리 + `node --test`, async 애니메이션 흐름, BOM 제거, `.gitignore`, 키보드/스크린리더 지원(`button` 셀, `aria-label`, `aria-live`), GitHub Pages 배포, 한글 UI, 최고 점수 표시, 게임 중 새 게임(진행 중이면 확인 대화상자)/기록 보기 버튼, PWA(manifest + service worker), MIT 라이선스, Playwright E2E 테스트와 CI, 새 게임 직후 결과 화면 덮어쓰기 경쟁 상태·저장 상태 불일치·다중 탭 기록 유실 수정, 서비스 워커 일괄 버전 캐시, 변경된 셀만 갱신하는 렌더와 `prefers-reduced-motion`, 확대(zoom) 허용, 되돌리기(Undo), 힌트.

남은 후보: 없음 (새 아이디어는 비목표 목록을 먼저 확인).

## 작업 원칙

- 규칙을 바꾸면 이 파일, README.md, `tests/` 를 함께 갱신
- 변경 후 `npm test` 와 `npm run test:e2e` 실행 (UI/흐름을 바꾸면 `e2e/` 도 갱신)
