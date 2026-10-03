# Summing Mobile

Summing Mobile is a small browser puzzle game inspired by classic number-placement gameplay. You place the current number on a 9x9 board and clear tiles when the last digit of the neighbour sum matches the placed number.

## Gameplay

- Board size: 9x9
- Initial state: the centered 7x7 area is filled with random digits from 0 to 9
- Stream length: 5 numbers
- Neighbours: all 8 surrounding tiles count
- Match rule: after placing a number, sum all filled neighbouring tiles; if `sum % 10` equals the placed number, the placed tile and those neighbours are removed
- Score: `10 * cleared tile count`
- Clear bonus: `+500` when the board becomes empty
- Game over: the board reaches 81 filled tiles

## Current Features

- Responsive single-page layout for portrait and landscape play
- Animated tile placement, match, and removal states
- Local leaderboard stored in `localStorage`
- Saved in-progress game restored from `localStorage`
- Automated logic tests (`npm test`)
- Keyboard and screen-reader friendly board
- Auto-deploy to GitHub Pages
- Defensive recovery when saved JSON is corrupted

## Run Locally

You can open `index.html` directly in a browser, but serving the files over a local HTTP server is recommended.

### Python

```bash
python -m http.server 8000
```

### Node.js

```bash
npx http-server -p 8000
```

Then open:

```text
http://localhost:8000
```

## Tests

```bash
npm test
```

Runs `tests/logic.test.js` with Node's built-in test runner (Node 18+). It covers board and stream creation, match and non-match detection, end-state detection, saved-data validation, and leaderboard ordering.

## Play Online

The game is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `master`: https://wall72.github.io/summing-web/

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- logic.js        pure game logic (no DOM)
|-- game.js         rendering, input, animation, storage
|-- tests/
|-- .github/workflows/pages.yml
|-- package.json
|-- README.md
`-- CLAUDE.md
```

## Known Limitations

- No undo or hint system
- No server-backed leaderboard
- UI copy is currently in English only

## Recent Changes

- split pure game logic into `logic.js` and added automated tests
- saved games are validated before being restored; a finished game reopens on its result screen
- moves are saved immediately, so reloading mid-animation no longer loses a move
- board cells are real buttons (keyboard + screen reader), rendered once and updated in place
