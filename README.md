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
- Browser test page for basic logic checks
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

## Test Page

Open the lightweight browser test page at:

```text
http://localhost:8000/test.html
```

The current test page checks:

- board initialization
- stream length
- match detection
- non-match detection
- clear scoring without bonus leakage
- clear-state bonus handling

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- game.js
|-- test.html
|-- README.md
`-- CLAUDE.md
```

## Known Limitations

- No undo or hint system
- No server-backed leaderboard
- No keyboard controls
- UI copy is currently in English only

## Recent Fixes

- fixed broken HTML/test page markup caused by encoding issues
- fixed move-lock sequencing so repeated placements work
- fixed match animation flow to avoid premature rerender
- added recovery for corrupted saved game and leaderboard data
