# Four Connect 🔴🟡

A polished, accessible, and responsive Connect Four game for the browser. Play locally with a friend or against a simple AI. Smooth animations, keyboard controls, sticky header with theme toggle, and a persistent scoreboard.

No build tools. No dependencies. Just HTML + CSS + JavaScript.

---

## Features

- Game modes
  - Two Players (local)
  - Solo vs AI (Easy, Medium) with choice to play as Red or Yellow
- Dynamic board size
  - Adjustable 4–12 columns and 4–12 rows
  - Presets: 7×6 Classic, 7×7, 8×8
- Smooth UX
  - Ghost preview, column highlight, drop animation, win pulse, shake on full column
  - Sticky header with brand + Dark/Light theme toggle
  - Settings summary chips + “Settings” quick open
- Keyboard & accessibility
  - Full keyboard play: ←/→ move, Enter/Space drop, 1–9 quick drop, R restart
  - Undo/Redo: Ctrl/Cmd+Z, Ctrl+Y / Ctrl+Shift+Z
  - Screen reader friendly: grid roles, ARIA labels, live status
- Persistent scoreboard
  - Tracks wins/losses/draws in localStorage by matchup and board size
- Mobile-friendly
  - Responsive layout, large touch targets, subtle focus rings

---

## Quick Start

Option 1: Just open it
- Double-click `index.html` to play offline in your browser.

Option 2: Run a local server (recommended)
- Python:
  - `python3 -m http.server 8080`
  - Open http://localhost:8080
- Node (serve):
  - `npx serve`
  - Open the printed URL (e.g., http://localhost:3000)
- VS Code:
  - Use the “Live Server” extension on `index.html`

No install. It’s all static files.

---

## How to Play

Connect four of your discs in a row (horizontal, vertical, or diagonal) before your opponent.

- Mouse/touch: Click or tap a column to drop a disc.
- Keyboard:
  - Arrow Left/Right: Move selection
  - Enter or Space: Drop
  - Keys 1–9: Quick drop in that column
  - R: Restart match
  - Ctrl/Cmd+Z: Undo
  - Ctrl+Y or Ctrl+Shift+Z: Redo

The “AI thinking…” indicator shows when the AI is picking a move.

---

## Settings

Open the Settings panel:
- Click the “⚙️ Settings” chip under the title, or
- Expand the “Game Settings” section.

Available options:
- Game Mode: Two Players or Solo vs AI
- AI Difficulty: Easy or Medium
- Play As: Red (first) or Yellow (second)
- Player Names: Customize Red and Yellow names
- Board Size: Set columns/rows, or use a preset
- Apply & New Game: Applies settings and restarts

Theme:
- Dark/Light toggle is in the sticky header (top-right).
- Your settings are saved in localStorage and loaded next time.

---

## AI Details

- Easy: Picks a random valid column.
- Medium:
  - Plays a winning move if available.
  - Otherwise blocks the opponent’s immediate win.
  - Prefers safe center-ish moves that don’t allow an immediate opponent win.
  - Otherwise chooses a center-preferred column.

---

## Scoreboard & Persistence

- The scoreboard shows wins for Red and Yellow plus total draws.
- Scores are stored in localStorage per matchup and board size:
  - Key: `cfour.score.v1`
  - Matchup key format: `ROWSxCOLS|RedName|YellowName`
- Use “Reset Score” to clear the current matchup.

Settings persistence:
- Stored under localStorage key: `cfour.settings.v1`

To completely reset:
- Clear browser site data or remove the above keys from localStorage.

---

## Accessibility

- `role="grid"` for the board; cells use `role="gridcell"`
- `aria-rowcount` / `aria-colcount` and per-cell ARIA labels
- Live status updates via `aria-live`
- Fully keyboard accessible with visible focus states
- Dark/Light themes tuned for contrast
