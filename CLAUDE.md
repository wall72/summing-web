# CLAUDE.md

Summing Mobile: 9x9 숫자 배치 퍼즐 게임. 빌드 단계 없는 정적 HTML/CSS/바닐라 JS, 저장은 `localStorage`만 사용 (백엔드 없음).

## 실행 / 테스트

- 실행: `python -m http.server 8000` 후 `http://localhost:8000` (index.html 직접 열기도 가능)
- 테스트: `http://localhost:8000/test.html` 을 브라우저에서 열어 확인 (현재 CI 불가, 아래 개선 과제 참고)
- 빌드, 린트, 패키지 매니저 없음. 의존성 추가 시 사용자 확인 먼저.

## 파일 구조

- `index.html` - 게임 화면(`#gameScreen`)과 결과/리더보드 화면(`#leaderboardScreen`)
- `game.js` - `LeaderboardManager`(리더보드 저장/정렬) + `SummingGame`(규칙, 상태, 렌더링, 저장)
- `styles.css` - 반응형(세로/가로) 스타일, 타일 애니메이션
- `test.html` - 브라우저 기반 로직 테스트 페이지

## 게임 규칙 (변경 시 test.html 도 함께 수정)

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

## 개선 과제 (우선순위 순)

### 버그 / 안정성
1. 저장된 게임 복원 시 데이터 형태 검증이 없음 (`board` 9x9, `stream` 길이, 숫자 범위). 손상된 값이면 크래시 가능 -> 검증 후 실패 시 새 게임
2. 종료(`cleared`/`gameover`) 직후 새로고침하면 결과 화면 없이 새 게임이 시작됨 (점수는 리더보드에 저장되어 있음). 결과 화면 복원 또는 의도 명확화
3. 이동 처리 중(애니메이션 약 1.2초) 새로고침하면 그 이동이 사라짐. 저장 시점을 배치 직후로 앞당기거나 상태를 일관되게 정리
4. `render()` 가 매번 보드 전체 DOM과 클릭 리스너를 재생성함. 이벤트 위임(보드에 리스너 1개)과 `new-tile` 클래스가 다음 렌더에서 사라지는 문제 정리
5. 창 크기 변경/회전 시 `render()` 가 호출되지 않아 셀 폰트 크기가 갱신되지 않음 (`resize` 핸들러 또는 CSS로 이전)
6. `renderLeaderboard()` 가 `innerHTML` 로 localStorage 값을 삽입함 -> `textContent` 사용 또는 숫자 검증
7. `continueBtn` 은 항상 숨겨져 있어 사실상 죽은 코드. 제거하거나 기능 구현

### 구조 / 테스트
8. 순수 게임 로직(보드, 이웃, 매치, 점수, 종료 판정)을 DOM/타이머/localStorage 와 분리 (예: `logic.js`). `game.js` 는 렌더링과 입력만 담당
9. 분리 후 Node 내장 테스트 러너(`node --test`)로 CI 가능한 자동 테스트 추가, `test.html` 은 대체 또는 유지 결정
10. 이동 중 `setTimeout` 중첩(300/500/400ms)을 하나의 흐름(Promise/async)으로 정리하고 CSS 애니메이션 시간과 상수 공유
11. 파일 선두의 BOM 제거 (`index.html`, `game.js`, `README.md`, `test.html` 등)
12. `.gitignore` 추가

### 기능 / UX
13. 키보드 조작과 접근성 (셀 `button`/`aria-label`, 포커스 이동, `aria-live` 로 점수/상태 안내)
14. 한글 UI 복원 (UTF-8 검증) 및 언어 문구 분리
15. 최고 점수 표시, 새 게임 확인 대화상자(진행 중 게임 보호), 게임 중 리더보드 보기
16. PWA(manifest + service worker)로 모바일 홈 화면 설치 지원
17. 진행 불가능한 상태(스트림 숫자로 매치가 절대 불가) 판정은 하지 않음 - 비목표 취급

## 작업 원칙

- 규칙을 바꾸면 이 파일, README.md, test.html 을 함께 갱신
- 변경 후에는 test.html 을 열어 통과 여부 확인 (자동화 전까지)
