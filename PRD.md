# Summing Mobile PRD

## 1. Product Summary

- Product: Summing Mobile
- Platform: modern desktop and mobile browsers
- Genre: number-placement puzzle
- Implementation: static HTML, CSS, and vanilla JavaScript
- Storage: browser `localStorage`

## 2. Product Goal

Deliver a lightweight browser game that is easy to open locally, plays well on mobile screens, and preserves basic player progress without any backend.

## 3. Core Rules

### 3.1 Board

- The board is a 9x9 grid.
- A new game starts with the centered 7x7 area filled.
- Filled cells contain random digits from 0 to 9.
- The outer ring starts empty.

### 3.2 Number Stream

- The visible stream contains 5 digits.
- The first digit is the active number to place.
- After each move, the active digit is removed and one new random digit is appended.

### 3.3 Placement

- The player may place the active number only on an empty cell.
- While a move is resolving, further input is locked.

### 3.4 Match Resolution

- Neighbours include the 8 surrounding cells.
- After placement, gather all filled neighbours.
- Compute the sum of neighbour digits.
- If `sum % 10` equals the placed digit, the placed cell and all filled neighbours are cleared.
- If there are no filled neighbours, the move cannot match.

### 3.5 Scoring

- Clearing tiles grants `10 * cleared tile count` points.
- Clearing the entire board grants an additional `500` points.

### 3.6 End Conditions

- `cleared`: no filled tiles remain on the board.
- `gameover`: all 81 board cells are filled.

## 4. Persistence Requirements

### 4.1 Saved Game

Store these fields in `localStorage` under `currentGame`:

- `board`
- `stream`
- `score`
- `moves`
- `gameStatus`
- `savedAt`

Behaviour:

- restore only saved games whose status is `playing`
- if saved JSON is corrupted, discard it and start a new game

### 4.2 Leaderboard

Store leaderboard entries in `localStorage` under `leaderboard`.

Entry schema:

```json
{
  "score": 0,
  "moves": 0,
  "remaining": 0,
  "status": "cleared",
  "date": "2026-03-16T00:00:00.000Z",
  "timestamp": 0
}
```

Rules:

- keep at most 20 entries
- sort by higher score first
- break ties by fewer moves
- break remaining ties by newer timestamp
- if leaderboard JSON is corrupted, discard and recreate it

## 5. UI Requirements

### 5.1 Main Game Screen

Show:

- title
- score
- moves
- remaining tile count
- 5-number stream
- interactive board

### 5.2 Result Screen

Show:

- final title (`Cleared!` or `Game Over`)
- final score
- move count
- remaining tiles
- top leaderboard entries
- new game button

### 5.3 Responsive Behaviour

- support portrait and landscape layouts
- keep the board square
- reduce visible preview count through CSS on narrower screens
- preserve touch-friendly tap targets

## 6. Animation and Input Behaviour

- tile placement uses a short appear animation
- matched tiles animate before removal
- rerender only after the board state is finalized for a resolving move
- input must remain disabled until the resolving move finishes

## 7. Testing Requirements

Maintain a browser-based test page that covers at least:

- board initialization
- stream initialization
- match detection
- non-match detection
- clear scoring
- clear bonus handling

## 8. Non-Goals

These are intentionally out of scope for the current version:

- account system
- online leaderboard
- multiplayer
- audio
- undo and hints
- framework migration

## 9. Current Risks

- logic and rendering are still coupled in one file
- automated tests are browser-page based rather than CI-friendly
- localization is not yet restored after the encoding cleanup

## 10. Next Candidates

- separate pure game logic from DOM rendering
- add a real automated test runner
- restore Korean copy with verified UTF-8 source files
- add keyboard and accessibility support
