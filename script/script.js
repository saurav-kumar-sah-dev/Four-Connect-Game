'use strict';

// Dynamic board size
let ROWS = 6;
let COLS = 7;

// Game state
const board = [];     // 2D array: '' | 'red' | 'yellow'
let cells = [];       // 2D array of cell elements
let currentPlayer = 'red';
let gameOver = false;
let isAnimating = false;
let lastGhostCell = null;
let highlightedCol = null;
let kbdCol = null;
const history = [];   // undo
const redoStack = []; // redo
let statusTimer = null;
let isRedoing = false;

// Settings + AI + Score
const DEFAULT_SETTINGS = {
  mode: 'pvp',             // 'pvp' | 'pva'
  difficulty: 'medium',    // 'easy' | 'medium'
  playAs: 'red',           // 'red' | 'yellow' (only applies in 'pva')
  redName: 'Player 1',
  yellowName: 'Player 2',
  rows: 6,
  cols: 7,
  theme: 'dark'            // 'dark' | 'light'
};
let settings = { ...DEFAULT_SETTINGS };
let aiSide = null;         // null | 'red' | 'yellow'

// Scoreboard: per matchup and board size
const SCORE_KEY = 'cfour.score.v1';

// DOM
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const thinkingEl = document.getElementById('thinking');

// Settings DOM
const modeSelect = document.getElementById('mode');
const diffSelect = document.getElementById('difficulty');
const playAsSelect = document.getElementById('playAs');
const nameRedInput = document.getElementById('nameRed');
const nameYellowInput = document.getElementById('nameYellow');
const colsInput = document.getElementById('colsInput');
const rowsInput = document.getElementById('rowsInput');
const applyBtn = document.getElementById('apply');
const themeToggleBtn = document.getElementById('themeToggle');

// Size preset buttons
document.querySelectorAll('[data-preset]').forEach(btn =>
  btn.addEventListener('click', () => {
    const [c, r] = btn.dataset.preset.split('x').map(Number);
    if (colsInput) colsInput.value = c;
    if (rowsInput) rowsInput.value = r;
    updateSettingsSummary();
  })
);

// Scoreboard DOM
const scoreRedNameEl = document.getElementById('score-red-name');
const scoreYellowNameEl = document.getElementById('score-yellow-name');
const scoreRedEl = document.getElementById('score-red');
const scoreYellowEl = document.getElementById('score-yellow');
const scoreDrawsEl = document.getElementById('score-draws');
const scoreResetBtn = document.getElementById('scoreReset');

// Header/summary/footer DOM (new)
const openSettingsBtn = document.getElementById('openSettings');
const summaryModeEl = document.getElementById('summary-mode');
const summaryBoardEl = document.getElementById('summary-board');
const summaryDiffEl = document.getElementById('summary-difficulty');
const summaryPlayEl = document.getElementById('summary-playas');
const chipDiff = document.getElementById('chip-diff');
const chipPlay = document.getElementById('chip-play');
const footerThemeLabel = document.getElementById('footer-theme-label');

// Init
loadSettings();
applyTheme(settings.theme);
applySettingsToUI();
applyModeVisibility();
applyAndReset();
updateSettingsSummary();

// Listeners
boardEl.addEventListener('mousemove', onBoardMouseMove);
boardEl.addEventListener('mouseleave', onBoardMouseLeave);
boardEl.addEventListener('click', onBoardClick);

resetBtn.addEventListener('click', () => {
  resetGame();
  maybeStartAITurn();
});

undoBtn.addEventListener('click', () => {
  undoMove();
  if (!gameOver && !isHumanTurn()) scheduleAiTurn();
});

redoBtn.addEventListener('click', redoMove);

document.addEventListener('keydown', onKeyDown);

applyBtn.addEventListener('click', () => {
  readSettingsFromUI();
  saveSettings();
  applyAndReset();
  updateSettingsSummary();
});

themeToggleBtn.addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(settings.theme);
  themeToggleBtn.textContent = settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light';
  saveSettings();
  updateSettingsSummary();
});

modeSelect.addEventListener('change', () => {
  applyModeVisibility();
  updateSettingsSummary();
});
diffSelect.addEventListener('change', updateSettingsSummary);
playAsSelect.addEventListener('change', updateSettingsSummary);
colsInput.addEventListener('input', updateSettingsSummary);
rowsInput.addEventListener('input', updateSettingsSummary);

scoreResetBtn.addEventListener('click', () => {
  resetCurrentScore();
});

// Open settings panel from header chip
if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    if (panel && typeof panel.open !== 'undefined') {
      panel.open = true;
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// Core setup
function applyAndReset() {
  // Map settings to globals
  ROWS = clampInt(settings.rows, 4, 12);
  COLS = clampInt(settings.cols, 4, 12);
  aiSide = settings.mode === 'pva'
    ? (settings.playAs === 'red' ? 'yellow' : 'red')
    : null;

  // Names into scoreboard labels
  scoreRedNameEl.textContent = `${settings.redName} (🔴)`;
  scoreYellowNameEl.textContent = `${settings.yellowName} (🟡)`;

  // Rebuild board + reset game state
  resetGame(true);
  updateScoreboardUI();

  // AI might start if solo and user plays Yellow
  maybeStartAITurn();
}

function createBoard() {
  boardEl.style.setProperty('--cols', COLS);
  boardEl.style.setProperty('--rows', ROWS);
  boardEl.setAttribute('aria-colcount', String(COLS));
  boardEl.setAttribute('aria-rowcount', String(ROWS));
  boardEl.setAttribute('aria-label', `Connect Four board, ${COLS} columns by ${ROWS} rows. Click or use arrow keys to choose a column.`);

  boardEl.innerHTML = '';
  board.length = 0;
  cells.length = 0;

  for (let r = 0; r < ROWS; r++) {
    const rowArr = [];
    const cellRow = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', String(r + 1));
      cell.setAttribute('aria-colindex', String(c + 1));
      setCellAria(cell, '');
      boardEl.appendChild(cell);
      rowArr.push('');
      cellRow.push(cell);
    }
    board.push(rowArr);
    cells.push(cellRow);
  }

  gameOver = false;
  isAnimating = false;
  history.length = 0;
  redoStack.length = 0;
  kbdCol = null;
  lastGhostCell = null;
  highlightedCol = null;
}

function resetGame(silent = false) {
  currentPlayer = 'red';
  createBoard();
  if (!silent) updateStatus(`${playerLabel(currentPlayer)}'s Turn`);
  else updateStatus();
  clearGhost();
  clearHighlight();
  updateControls();
}

function onBoardMouseMove(e) {
  if (gameOver || isAnimating || !isHumanTurn()) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const col = Number(cell.dataset.col);
  showGhost(col);
}

function onBoardMouseLeave() {
  clearGhost();
  clearHighlight();
}

function onBoardClick(e) {
  if (gameOver || isAnimating || !isHumanTurn()) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const col = Number(cell.dataset.col);
  dropDisc(col);
}

function onKeyDown(e) {
  // Global shortcuts allowed even during AI turn
  const key = e.key;

  if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z' && e.shiftKey) {
    e.preventDefault();
    return redoMove();
  }
  if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') {
    e.preventDefault();
    undoMove();
    if (!gameOver && !isHumanTurn()) scheduleAiTurn();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'y') {
    e.preventDefault();
    return redoMove();
  }
  if (key.toLowerCase() === 'r') {
    e.preventDefault();
    resetGame();
    maybeStartAITurn();
    return;
  }

  // Movement and dropping only on human turn
  if (gameOver || isAnimating || !isHumanTurn()) return;

  if (key === 'ArrowLeft' || key === 'Left') {
    e.preventDefault();
    if (kbdCol === null) kbdCol = Math.floor(COLS / 2);
    kbdCol = (kbdCol - 1 + COLS) % COLS;
    showGhost(kbdCol);
  } else if (key === 'ArrowRight' || key === 'Right') {
    e.preventDefault();
    if (kbdCol === null) kbdCol = Math.floor(COLS / 2);
    kbdCol = (kbdCol + 1) % COLS;
    showGhost(kbdCol);
  } else if (key === 'Enter' || key === ' ') {
    e.preventDefault();
    const col = lastGhostCell ? Number(lastGhostCell.dataset.col) : (kbdCol ?? Math.floor(COLS / 2));
    dropDisc(col);
  } else if (/^[1-9]$/.test(key)) {
    const n = Number(key);
    if (n >= 1 && n <= COLS) {
      const col = n - 1;
      showGhost(col);
      dropDisc(col);
    }
  }
}

function getAvailableRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return null;
}

function dropDisc(col) {
  const row = getAvailableRow(col);
  if (row === null) {
    shake();
    flashStatus(`That column is full. Try another.`, 1000);
    vibrate(50);
    return;
  }

  clearWinHighlights();

  // Update state
  board[row][col] = currentPlayer;
  const cell = cellAt(row, col);

  // Visual + animation
  applyDropAnimation(cell, row);
  cell.classList.add(currentPlayer);
  setCellAria(cell, currentPlayer);

  // Save for undo/redo
  history.push({ row, col, player: currentPlayer });
  if (!isRedoing) redoStack.length = 0;

  const winning = getWinningCells(row, col);
  const isDraw = !winning && board.flat().every(Boolean);

  if (winning) {
    gameOver = true;
    updateStatus(`${playerLabel(currentPlayer)} Wins! 🎉`);
    recordResult(currentPlayer);
  } else if (isDraw) {
    gameOver = true;
    updateStatus(`It's a Draw! 😮`);
    recordResult('draw');
  } else {
    currentPlayer = otherColor(currentPlayer);
    updateStatus();
  }

  updateControls();

  isAnimating = true;
  cell.addEventListener('animationend', () => {
    isAnimating = false;
    cell.classList.remove('animate-drop');
    cell.style.removeProperty('--from-y');

    if (winning) {
      for (const [r, c] of winning) {
        cellAt(r, c).classList.add('win');
      }
      clearGhost();
      clearHighlight();
    } else {
      if (isHumanTurn()) {
        showGhost(col); // keep preview on same col for human
      } else {
        clearGhost();
        clearHighlight();
      }
      // If it's AI's turn now, go
      if (!gameOver && !isHumanTurn()) {
        scheduleAiTurn();
      }
    }
  }, { once: true });
}

function applyDropAnimation(cell, row) {
  const { cellSize, gap } = readSizeVars();
  const distance = (row + 1) * (cellSize + gap);
  cell.style.setProperty('--from-y', `-${distance}px`);
  cell.classList.remove('animate-drop');
  void cell.offsetWidth; // restart animation
  cell.classList.add('animate-drop');
}

function updateStatus(text) {
  clearTimeout(statusTimer);
  if (text) {
    statusEl.textContent = text;
  } else {
    const emoji = currentPlayer === 'red' ? '🔴' : '🟡';
    statusEl.textContent = `${playerName(currentPlayer)}'s Turn (${emoji} ${capitalize(currentPlayer)})`;
  }
}

function flashStatus(text, ms = 1000) {
  clearTimeout(statusTimer);
  const restore = !gameOver;
  statusEl.textContent = text;
  if (restore) {
    statusTimer = setTimeout(() => updateStatus(), ms);
  }
}

function playerName(color) {
  return color === 'red' ? settings.redName : settings.yellowName;
}

function playerLabel(player = currentPlayer) {
  return `${playerName(player)} (${player === 'red' ? '🔴 Red' : '🟡 Yellow'})`;
}

function showGhost(col) {
  if (gameOver || isAnimating) return;
  const row = getAvailableRow(col);
  clearGhost();
  highlightColumn(col);
  if (row === null) return;
  const cell = cellAt(row, col);
  cell.classList.add('ghost', `ghost-${currentPlayer}`);
  lastGhostCell = cell;
}

function clearGhost() {
  if (!lastGhostCell) return;
  lastGhostCell.classList.remove('ghost', 'ghost-red', 'ghost-yellow');
  lastGhostCell = null;
}

function highlightColumn(col) {
  if (highlightedCol === col) return;
  clearHighlight();
  for (let r = 0; r < ROWS; r++) {
    cellAt(r, col).classList.add('col-highlight');
  }
  highlightedCol = col;
}

function clearHighlight() {
  if (highlightedCol === null) return;
  for (let r = 0; r < ROWS; r++) {
    cellAt(r, highlightedCol).classList.remove('col-highlight');
  }
  highlightedCol = null;
}

function clearWinHighlights() {
  boardEl.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win'));
}

function shake() {
  boardEl.classList.remove('shake');
  void boardEl.offsetWidth;
  boardEl.classList.add('shake');
}

function cellAt(r, c) {
  return cells[r][c];
}

function getWinningCells(row, col) {
  const color = board[row][col];
  if (!color) return null;

  const dirs = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diag down-right
    [1, -1],  // diag down-left
  ];

  for (const [dr, dc] of dirs) {
    const line = [[row, col]];
    collect(line, row + dr, col + dc, dr, dc, color);
    collect(line, row - dr, col - dc, -dr, -dc, color);
    if (line.length >= 4) return line;
  }
  return null;

  function collect(arr, r, c, dr, dc, color) {
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
      arr.push([r, c]);
      r += dr; c += dc;
    }
  }
}

function undoMove() {
  if (isAnimating || history.length === 0) return;
  const last = history.pop();
  const { row, col, player } = last;

  // Push to redo stack
  redoStack.push(last);

  board[row][col] = '';
  const cell = cellAt(row, col);
  cell.classList.remove('red', 'yellow', 'win');
  cell.style.removeProperty('--from-y');
  setCellAria(cell, '');

  gameOver = false;
  currentPlayer = player; // back to the player who made the undone move
  clearWinHighlights();
  updateStatus();
  if (isHumanTurn()) showGhost(col);
  updateControls();
}

function redoMove() {
  if (isAnimating || redoStack.length === 0) return;
  const move = redoStack.pop();
  isRedoing = true;
  currentPlayer = move.player;
  dropDisc(move.col);
  isRedoing = false;
  updateControls();
}

function updateControls() {
  undoBtn.disabled = history.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function readSizeVars() {
  const firstCell = boardEl.querySelector('.cell');
  let cellSize = 60;
  if (firstCell) {
    const rect = firstCell.getBoundingClientRect();
    cellSize = rect.height || rect.width || 60;
  }
  const styles = getComputedStyle(boardEl);
  let gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
  return { cellSize, gap };
}

function vibrate(ms = 30) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function setCellAria(cell, value) {
  const r = Number(cell.dataset.row) + 1;
  const c = Number(cell.dataset.col) + 1;
  const state = value === '' ? 'Empty' : (value === 'red' ? 'Red' : 'Yellow');
  cell.setAttribute('aria-label', `Row ${r}, Column ${c}: ${state}`);
}

// AI helpers
function isHumanTurn() {
  if (settings.mode === 'pvp') return true;
  return currentPlayer !== aiSide;
}

function maybeStartAITurn() {
  if (settings.mode === 'pva' && currentPlayer === aiSide && !gameOver) {
    scheduleAiTurn(400);
  }
}

function scheduleAiTurn(delay = 300) {
  thinkingEl.hidden = false;
  setTimeout(() => {
    if (gameOver || isAnimating || currentPlayer !== aiSide) {
      thinkingEl.hidden = true;
      return;
    }
    const col = chooseAiColumn(settings.difficulty, aiSide);
    dropDisc(col);
    thinkingEl.hidden = true;
  }, delay);
}

function chooseAiColumn(difficulty, aiColor) {
  const cols = validCols();
  // Medium: win if possible, otherwise block opponent’s win, otherwise center preference
  if (difficulty === 'medium') {
    // 1) Winning move
    for (const c of cols) {
      if (wouldWin(c, aiColor)) return c;
    }
    // 2) Block opponent's immediate win
    const opp = otherColor(aiColor);
    for (const c of cols) {
      if (wouldWin(c, opp)) return c;
    }
    // 3) Prefer center-most safe moves (that don't allow immediate opponent win)
    const safe = cols.filter(c => !givesOpponentImmediateWin(c, aiColor));
    if (safe.length) return centerPreferred(safe)[0];
    return centerPreferred(cols)[0];
  }
  // Easy: random among valid columns
  return cols[Math.floor(Math.random() * cols.length)];
}

function validCols() {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    if (getAvailableRow(c) !== null) cols.push(c);
  }
  return cols;
}

function wouldWin(col, color) {
  const row = getAvailableRow(col);
  if (row === null) return false;
  board[row][col] = color;
  const win = !!getWinningCells(row, col);
  board[row][col] = '';
  return win;
}

// After playing col as 'color', does opponent have an immediate winning reply?
function givesOpponentImmediateWin(col, color) {
  const row = getAvailableRow(col);
  if (row === null) return false;
  board[row][col] = color;
  const opp = otherColor(color);
  const oppWins = validCols().some(c => wouldWin(c, opp));
  board[row][col] = '';
  return oppWins;
}

function centerPreferred(cols) {
  const center = (COLS - 1) / 2;
  return cols.slice().sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}

function otherColor(color) {
  return color === 'red' ? 'yellow' : 'red';
}

// Settings + Theme
function loadSettings() {
  try {
    const raw = localStorage.getItem('cfour.settings.v1');
    if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
}

function saveSettings() {
  try {
    localStorage.setItem('cfour.settings.v1', JSON.stringify(settings));
  } catch { /* ignore */ }
}

function applySettingsToUI() {
  modeSelect.value = settings.mode;
  diffSelect.value = settings.difficulty;
  playAsSelect.value = settings.playAs;
  nameRedInput.value = settings.redName;
  nameYellowInput.value = settings.yellowName;
  colsInput.value = settings.cols;
  rowsInput.value = settings.rows;
  if (themeToggleBtn) {
    themeToggleBtn.textContent = settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light';
  }
}

function readSettingsFromUI() {
  const mode = modeSelect.value;
  const difficulty = diffSelect.value;
  const playAs = playAsSelect.value;
  const redName = nameRedInput.value.trim() || DEFAULT_SETTINGS.redName;
  const yellowName = nameYellowInput.value.trim() || DEFAULT_SETTINGS.yellowName;
  const cols = clampInt(parseInt(colsInput.value, 10) || 7, 4, 12);
  const rows = clampInt(parseInt(rowsInput.value, 10) || 6, 4, 12);

  settings = { ...settings, mode, difficulty, playAs, redName, yellowName, cols, rows };
}

function applyModeVisibility() {
  const isSolo = modeSelect.value === 'pva';
  diffSelect.disabled = !isSolo;
  playAsSelect.disabled = !isSolo;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (footerThemeLabel) {
    footerThemeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }
}

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Settings summary (header) + footer label updater
function updateSettingsSummary() {
  if (summaryModeEl) {
    const txt = modeSelect.options[modeSelect.selectedIndex]?.textContent || (settings.mode === 'pva' ? 'Solo vs AI' : 'Two Players');
    summaryModeEl.textContent = txt;
  }
  if (summaryBoardEl) {
    const c = colsInput?.value || settings.cols;
    const r = rowsInput?.value || settings.rows;
    summaryBoardEl.textContent = `${c}×${r}`;
  }
  const isSolo = modeSelect.value === 'pva';
  if (chipDiff) chipDiff.classList.toggle('disabled', !isSolo);
  if (chipPlay) chipPlay.classList.toggle('disabled', !isSolo);

  if (summaryDiffEl) {
    const txt = diffSelect.options[diffSelect.selectedIndex]?.textContent || (settings.difficulty === 'easy' ? 'Easy' : 'Medium');
    summaryDiffEl.textContent = txt;
  }

  if (summaryPlayEl) {
    const txt = playAsSelect.options[playAsSelect.selectedIndex]?.textContent || (settings.playAs === 'red' ? '🔴 Red (first)' : '🟡 Yellow (second)');
    summaryPlayEl.textContent = txt.replace(/\s*KATEX_INLINE_OPEN.*?KATEX_INLINE_CLOSE\s*/, '').trim();
  }

  if (footerThemeLabel) {
    const theme = document.documentElement.getAttribute('data-theme');
    footerThemeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }
}

// Scoreboard
function getMatchKey() {
  return `${ROWS}x${COLS}|${settings.redName}|${settings.yellowName}`;
}

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return { matchups: {} };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.matchups) return { matchups: {} };
    return obj;
  } catch {
    return { matchups: {} };
  }
}

function saveScores(obj) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function getCurrentScore() {
  const all = loadScores();
  const key = getMatchKey();
  if (!all.matchups[key]) {
    all.matchups[key] = {
      rows: ROWS,
      cols: COLS,
      redName: settings.redName,
      yellowName: settings.yellowName,
      winsRed: 0,
      winsYellow: 0,
      draws: 0,
    };
    saveScores(all);
  }
  return all.matchups[key];
}

function setCurrentScore(score) {
  const all = loadScores();
  all.matchups[getMatchKey()] = score;
  saveScores(all);
}

function updateScoreboardUI() {
  const s = getCurrentScore();
  scoreRedEl.textContent = String(s.winsRed);
  scoreYellowEl.textContent = String(s.winsYellow);
  scoreDrawsEl.textContent = String(s.draws);
  scoreRedNameEl.textContent = `${settings.redName} (🔴)`;
  scoreYellowNameEl.textContent = `${settings.yellowName} (🟡)`;
}

function recordResult(result) {
  const s = getCurrentScore();
  if (result === 'red') s.winsRed++;
  else if (result === 'yellow') s.winsYellow++;
  else s.draws++;
  setCurrentScore(s);
  updateScoreboardUI();
}

function resetCurrentScore() {
  const s = getCurrentScore();
  s.winsRed = 0;
  s.winsYellow = 0;
  s.draws = 0;
  setCurrentScore(s);
  updateScoreboardUI();
}