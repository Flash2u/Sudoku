import './style.css';
import confetti from 'canvas-confetti';
import { generateSudoku, solveSudoku } from './sudokuGenerator.js';
import { Board } from './board.js';

// --- GAME STATE ---
let board = null;
let selectedRow = -1;
let selectedCol = -1;
let isNoteMode = false;
let showErrors = true;
let showSoleCandidateHint = true;
let showAutoNotes = false;
let checkedErrorCells = new Set();

// Timer State
let timerInterval = null;
let secondsElapsed = 0;
let isPaused = false;

// Game Stats Counters
let errorCount = 0;
let eraserCount = 0;
let hintCount = 0;

// Active filter (when no cell is selected, clicking a number highlights that number)
let activeNumberFilter = null;

// --- DOM ELEMENTS ---
const sudokuBoardEl = document.getElementById('sudoku-board');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnEraser = document.getElementById('btn-eraser');
const btnNote = document.getElementById('btn-note');
const btnHint = document.getElementById('btn-hint');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnNewGame = document.getElementById('btn-new-game');
const btnReset = document.getElementById('btn-reset');
const btnStats = document.getElementById('btn-stats');
const themeToggle = document.getElementById('theme-toggle');
const toggleErrors = document.getElementById('toggle-errors');
const toggleSoleCandidate = document.getElementById('toggle-sole-candidate');
const toggleAutoNotes = document.getElementById('toggle-auto-notes');
const btnHelp = document.getElementById('btn-help');
const btnShare = document.getElementById('btn-share');
const btnCheck = document.getElementById('btn-check');

// Modals
const modalHelp = document.getElementById('modal-help');
const btnCloseHelp = document.getElementById('btn-close-help');
const modalDifficulty = document.getElementById('modal-difficulty');
const btnCloseDifficulty = document.getElementById('btn-close-difficulty');
const modalStats = document.getElementById('modal-stats');
const btnCloseStats = document.getElementById('btn-close-stats');
const btnClearStats = document.getElementById('btn-clear-stats');
const modalWon = document.getElementById('modal-won');
const btnWonNew = document.getElementById('btn-won-new');
const btnWonClose = document.getElementById('btn-won-close');
const pauseOverlay = document.getElementById('pause-overlay');

// Text/Labels
const labelDifficulty = document.getElementById('label-difficulty');
const timerEl = document.getElementById('timer');

// --- LOCAL STORAGE KEYS ---
const STORAGE_GAME_KEY = 'sub_sudoku_active_game';
const STORAGE_STATS_KEY = 'sub_sudoku_stats';
const STORAGE_THEME_KEY = 'sub_sudoku_theme';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initStats();
  bindEvents();
  
  // Parse query parameters for shared level
  const urlParams = new URLSearchParams(window.location.search);
  const sharedPuzzleStr = urlParams.get('puzzle');
  const sharedDiff = urlParams.get('difficulty') || 'medium';

  let sharedLoaded = false;
  if (sharedPuzzleStr && sharedPuzzleStr.length === 81 && /^[0-9]+$/.test(sharedPuzzleStr)) {
    try {
      const puzzle = [];
      for (let i = 0; i < 9; i++) {
        const row = [];
        for (let j = 0; j < 9; j++) {
          row.push(parseInt(sharedPuzzleStr[i * 9 + j]));
        }
        puzzle.push(row);
      }

      const solution = solveSudoku(puzzle);
      if (solution) {
        board = new Board(puzzle, solution, sharedDiff);
        window.board = board;

        selectedRow = -1;
        selectedCol = -1;
        isNoteMode = false;
        activeNumberFilter = null;
        errorCount = 0;
        eraserCount = 0;
        hintCount = 0;
        updateCountersUI(false);
        secondsElapsed = 0;
        timerEl.textContent = '00:00';
        isPaused = false;
        btnPause.textContent = '⏸️';
        pauseOverlay.classList.add('hidden');

        const diffLabels = {
          easy: '🐱 簡單 (Easy)',
          medium: '🐶 中等 (Medium)',
          hard: '🐯 困難 (Hard)',
          expert: '🧙‍♂️ 專家 (Expert)'
        };
        labelDifficulty.textContent = diffLabels[sharedDiff] || sharedDiff;

        renderBoard();
        updateNumpadCounts();
        updateUndoRedoButtons();
        startTimer();
        saveCurrentGame();

        sharedLoaded = true;
        showToast('已成功加載分享的數獨關卡！', 'success');

        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else {
        showToast('加載失敗：該數獨無解。', 'warning');
      }
    } catch (e) {
      console.error('Error loading shared puzzle:', e);
      showToast('分享關卡解析錯誤。', 'warning');
    }
  }

  if (!sharedLoaded && !tryLoadGame()) {
    showDifficultyModal();
  }
});

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  else if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- COUNTER MANAGEMENT ---
function updateCountersUI(shouldAnimate = true) {
  const errEl = document.getElementById('count-errors');
  const eraEl = document.getElementById('count-erasures');
  const hntEl = document.getElementById('count-hints');

  if (errEl) {
    const oldVal = parseInt(errEl.textContent) || 0;
    errEl.textContent = errorCount;
    if (shouldAnimate && errorCount > oldVal) {
      triggerPopAnimation(errEl);
    }
  }
  if (eraEl) {
    const oldVal = parseInt(eraEl.textContent) || 0;
    eraEl.textContent = eraserCount;
    if (shouldAnimate && eraserCount > oldVal) {
      triggerPopAnimation(eraEl);
    }
  }
  if (hntEl) {
    const oldVal = parseInt(hntEl.textContent) || 0;
    hntEl.textContent = hintCount;
    if (shouldAnimate && hintCount > oldVal) {
      triggerPopAnimation(hntEl);
    }
  }
}

function triggerPopAnimation(el) {
  el.classList.remove('counter-pop');
  // force reflow
  void el.offsetWidth;
  el.classList.add('counter-pop');
}

// --- THEME MANAGEMENT ---
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_THEME_KEY, newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// --- STATS MANAGEMENT ---
function initStats() {
  const stored = localStorage.getItem(STORAGE_STATS_KEY);
  if (!stored) {
    const initialStats = {
      totalGames: 0,
      totalWins: 0,
      bestTimes: {
        easy: null,
        medium: null,
        hard: null,
        expert: null
      },
      difficultyStats: {
        easy: { games: 0, wins: 0 },
        medium: { games: 0, wins: 0 },
        hard: { games: 0, wins: 0 },
        expert: { games: 0, wins: 0 }
      }
    };
    localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(initialStats));
  } else {
    try {
      const stats = JSON.parse(stored);
      let updated = false;
      if (!stats.difficultyStats) {
        stats.difficultyStats = {
          easy: { games: 0, wins: 0 },
          medium: { games: 0, wins: 0 },
          hard: { games: 0, wins: 0 },
          expert: { games: 0, wins: 0 }
        };
        updated = true;
      }
      if (updated) {
        localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
      }
    } catch (e) {
      // ignore
    }
  }
}

function getStats() {
  return JSON.parse(localStorage.getItem(STORAGE_STATS_KEY));
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
}

function updateStatsUI() {
  const stats = getStats();
  document.getElementById('stats-total-games').textContent = stats.totalGames;
  document.getElementById('stats-total-wins').textContent = stats.totalWins;
  
  const winRate = stats.totalGames > 0 ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;
  document.getElementById('stats-win-rate').textContent = `${winRate}%`;

  const difficulties = ['easy', 'medium', 'hard', 'expert'];
  difficulties.forEach(diff => {
    const bestEl = document.getElementById(`best-${diff}`);
    if (bestEl) {
      const time = stats.bestTimes[diff];
      bestEl.textContent = time ? formatTime(time) : '--:--';
    }
    
    const diffStat = stats.difficultyStats ? stats.difficultyStats[diff] : { games: 0, wins: 0 };
    const games = diffStat.games || 0;
    const wins = diffStat.wins || 0;
    const rate = games > 0 ? Math.round((wins / games) * 100) : 0;
    
    const gamesWinsEl = document.getElementById(`stats-games-${diff}`);
    if (gamesWinsEl) {
      gamesWinsEl.textContent = `${games} / ${wins}`;
    }
    
    const rateEl = document.getElementById(`stats-rate-${diff}`);
    if (rateEl) {
      rateEl.textContent = `${rate}%`;
    }
  });
}

function clearStats() {
  if (confirm('您確定要清除所有的歷史統計數據嗎？這項操作無法復原。')) {
    const clearedStats = {
      totalGames: 0,
      totalWins: 0,
      bestTimes: {
        easy: null,
        medium: null,
        hard: null,
        expert: null
      },
      difficultyStats: {
        easy: { games: 0, wins: 0 },
        medium: { games: 0, wins: 0 },
        hard: { games: 0, wins: 0 },
        expert: { games: 0, wins: 0 }
      }
    };
    saveStats(clearedStats);
    updateStatsUI();
  }
}

// --- TIMER FUNCTIONALITY ---
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      timerEl.textContent = formatTime(secondsElapsed);
      if (secondsElapsed % 5 === 0) {
        saveCurrentGame(); // Auto-save progress every 5 seconds
      }
    }
  }, 1000);
}

function pauseGame() {
  if (!board || isPaused) return;
  isPaused = true;
  btnPause.textContent = '▶️';
  btnPause.title = '繼續遊戲';
  pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
  if (!board || !isPaused) return;
  isPaused = false;
  btnPause.textContent = '⏸️';
  btnPause.title = '暫停遊戲';
  pauseOverlay.classList.add('hidden');
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- GAME LIFECYCLE ---
function startNewGame(difficulty) {
  // Reset UI and state
  selectedRow = -1;
  selectedCol = -1;
  isNoteMode = false;
  activeNumberFilter = null;
  btnNote.classList.remove('active');
  btnNote.querySelector('.tool-text').textContent = '筆記 (關)';
  
  // Reset Counters
  errorCount = 0;
  eraserCount = 0;
  hintCount = 0;
  updateCountersUI(false);
  
  // Set difficulty badge
  const diffLabels = {
    easy: '🐱 簡單 (Easy)',
    medium: '🐶 中等 (Medium)',
    hard: '🐯 困難 (Hard)',
    expert: '🧙‍♂️ 專家 (Expert)'
  };
  labelDifficulty.textContent = diffLabels[difficulty] || difficulty;

  // Generate Sudoku
  const { puzzle, solution } = generateSudoku(difficulty);
  board = new Board(puzzle, solution, difficulty);
  window.board = board;

  // Reset Timer
  secondsElapsed = 0;
  timerEl.textContent = '00:00';
  isPaused = false;
  btnPause.textContent = '⏸️';
  pauseOverlay.classList.add('hidden');

  // Stats increment
  const stats = getStats();
  stats.totalGames++;
  if (stats.difficultyStats && stats.difficultyStats[difficulty]) {
    stats.difficultyStats[difficulty].games++;
  }
  saveStats(stats);

  // Render & Start
  renderBoard();
  updateNumpadCounts();
  updateUndoRedoButtons();
  startTimer();
  saveCurrentGame();

  modalDifficulty.classList.add('hidden');
}

function resetGame() {
  if (!board) return;
  if (confirm('您確定要將棋盤回復到初始狀態嗎？所有的填寫進度與筆記將會被清除。')) {
    board = new Board(board.initialBoard, board.solution, board.difficulty);
    selectedRow = -1;
    selectedCol = -1;
    activeNumberFilter = null;
    secondsElapsed = 0;
    timerEl.textContent = '00:00';
    
    // Reset Counters
    errorCount = 0;
    eraserCount = 0;
    hintCount = 0;
    updateCountersUI(false);
    
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();
    saveCurrentGame();
  }
}

// --- SAVE AND LOAD GAME ---
function saveCurrentGame() {
  if (!board) return;
  const gameState = {
    board: board.serialize(),
    secondsElapsed,
    isPaused,
    showErrors,
    showSoleCandidateHint,
    showAutoNotes,
    errorCount,
    eraserCount,
    hintCount
  };
  localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify(gameState));
}

function tryLoadGame() {
  const savedData = localStorage.getItem(STORAGE_GAME_KEY);
  if (!savedData) return false;

  try {
    const gameState = JSON.parse(savedData);
    board = Board.deserialize(gameState.board);
    window.board = board;
    secondsElapsed = gameState.secondsElapsed;
    isPaused = gameState.isPaused;
    showErrors = gameState.showErrors !== undefined ? gameState.showErrors : true;
    showSoleCandidateHint = gameState.showSoleCandidateHint !== undefined ? gameState.showSoleCandidateHint : true;
    showAutoNotes = gameState.showAutoNotes !== undefined ? gameState.showAutoNotes : false;
    
    // Restore counters
    errorCount = gameState.errorCount || 0;
    eraserCount = gameState.eraserCount || 0;
    hintCount = gameState.hintCount || 0;
    updateCountersUI(false);

    // Restore UI switches
    toggleErrors.checked = showErrors;
    toggleSoleCandidate.checked = showSoleCandidateHint;
    toggleAutoNotes.checked = showAutoNotes;
    if (showAutoNotes) {
      isNoteMode = false;
      btnNote.disabled = true;
      btnNote.classList.remove('active');
      btnNote.querySelector('.tool-text').textContent = '筆記 (自動)';
    } else {
      btnNote.disabled = false;
      btnNote.querySelector('.tool-text').textContent = `筆記 (${isNoteMode ? '開' : '關'})`;
    }

    // Restore difficulty badge
    const diffLabels = {
      easy: '🐱 簡單 (Easy)',
      medium: '🐶 中等 (Medium)',
      hard: '🐯 困難 (Hard)',
      expert: '🧙‍♂️ 專家 (Expert)'
    };
    labelDifficulty.textContent = diffLabels[board.difficulty] || board.difficulty;

    timerEl.textContent = formatTime(secondsElapsed);
    
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();

    if (isPaused) {
      btnPause.textContent = '▶️';
      pauseOverlay.classList.remove('hidden');
    } else {
      btnPause.textContent = '⏸️';
      pauseOverlay.classList.add('hidden');
    }
    
    startTimer();
    return true;
  } catch (e) {
    console.error('Failed to parse saved game state:', e);
    localStorage.removeItem(STORAGE_GAME_KEY);
    return false;
  }
}

// --- BOARD RENDERING ---
function renderBoard() {
  if (board && showAutoNotes) {
    board.populateAllAutoNotes();
  }
  sudokuBoardEl.innerHTML = '';
  
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cellEl = document.createElement('div');
      cellEl.className = 'sudoku-cell';
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;
      
      const val = board.getValue(r, c);
      const isClue = board.isClue(r, c);
      
      // Determine Cell Style Classes
      if (isClue) {
        cellEl.classList.add('clue');
      } else if (val !== 0) {
        cellEl.classList.add('user-value');
      }

      // Conflict/Error highlight
      if (val !== 0 && !isClue) {
        const key = `${r},${c}`;
        if (showErrors && !board.isCorrect(r, c)) {
          cellEl.classList.add('error');
        } else if (board.hasConflict(r, c, val)) {
          // Highlight syntax duplicate conflicts
          cellEl.classList.add('error');
        } else if (checkedErrorCells.has(key)) {
          cellEl.classList.add('error');
          cellEl.classList.add('shake-error');
        }
      }

      // Highlight Selection and Context
      if (r === selectedRow && c === selectedCol) {
        cellEl.classList.add('selected');
      } else if (
        r === selectedRow || 
        c === selectedCol || 
        (Math.floor(r / 3) === Math.floor(selectedRow / 3) && Math.floor(c / 3) === Math.floor(selectedCol / 3))
      ) {
        cellEl.classList.add('highlight-group');
        if (r === selectedRow) {
          cellEl.classList.add('highlight-row');
        }
        if (c === selectedCol) {
          cellEl.classList.add('highlight-col');
        }
        if (Math.floor(r / 3) === Math.floor(selectedRow / 3) && Math.floor(c / 3) === Math.floor(selectedCol / 3)) {
          cellEl.classList.add('highlight-box');
        }
      }

      // Highlight same number
      let highlightNum = 0;
      if (selectedRow !== -1 && selectedCol !== -1) {
        highlightNum = board.getValue(selectedRow, selectedCol);
      } else if (activeNumberFilter !== null) {
        highlightNum = activeNumberFilter;
      }

      if (highlightNum !== 0 && val === highlightNum) {
        cellEl.classList.add('highlight-same-num');
      }

      // Set Cell Content
      if (val !== 0) {
        const valEl = document.createElement('div');
        valEl.className = 'cell-value';
        valEl.textContent = val;
        cellEl.appendChild(valEl);
      } else {
        // Render Pencil Notes grid
        const notesGridEl = document.createElement('div');
        notesGridEl.className = 'cell-notes';
        const cellNotes = board.getNotes(r, c);
        
        for (let i = 1; i <= 9; i++) {
          const noteEl = document.createElement('span');
          noteEl.className = 'note-digit';
          if (cellNotes.has(i)) {
            noteEl.classList.add('active');
            noteEl.textContent = i;
          }
          notesGridEl.appendChild(noteEl);
        }
        cellEl.appendChild(notesGridEl);
      }

      sudokuBoardEl.appendChild(cellEl);
    }
  }

  // Update candidate highlight on numpad
  updateNumpadCandidates();
}

// --- INTERACTIVE EVENT BINDINGS ---
function bindEvents() {
  // Cell selection Click
  sudokuBoardEl.addEventListener('click', (e) => {
    if (isPaused) return;
    const cell = e.target.closest('.sudoku-cell');
    if (!cell) return;

    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);

    selectCell(r, c);
  });

  // Numpad clicks
  document.querySelector('.numpad').addEventListener('click', (e) => {
    if (isPaused || !board) return;
    const btn = e.target.closest('.num-btn');
    if (!btn || btn.classList.contains('completed')) return;

    const val = parseInt(btn.dataset.value);
    handleInputNumber(val);
  });

  // Tools Actions
  btnUndo.addEventListener('click', () => {
    if (isPaused || !board) return;
    if (board.undo()) {
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
    }
  });

  btnRedo.addEventListener('click', () => {
    if (isPaused || !board) return;
    if (board.redo()) {
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
    }
  });

  btnEraser.addEventListener('click', () => {
    if (isPaused || !board) return;
    eraseSelectedCell();
  });

  btnNote.addEventListener('click', () => {
    isNoteMode = !isNoteMode;
    btnNote.classList.toggle('active', isNoteMode);
    btnNote.querySelector('.tool-text').textContent = `筆記 (${isNoteMode ? '開' : '關'})`;
  });

  btnHint.addEventListener('click', () => {
    if (isPaused || !board) return;
    applyHint();
  });

  // Pause / Resume
  btnPause.addEventListener('click', () => {
    if (isPaused) resumeGame();
    else pauseGame();
  });

  btnResume.addEventListener('click', resumeGame);

  // New Game Dialog
  btnNewGame.addEventListener('click', showDifficultyModal);
  btnCloseDifficulty.addEventListener('click', () => modalDifficulty.classList.add('hidden'));

  // Reset Board
  btnReset.addEventListener('click', resetGame);

  // Settings
  toggleErrors.addEventListener('change', (e) => {
    showErrors = e.target.checked;
    renderBoard();
    saveCurrentGame();
  });

  toggleSoleCandidate.addEventListener('change', (e) => {
    showSoleCandidateHint = e.target.checked;
    saveCurrentGame();
  });

  // Keyboard navigation & inputs
  document.addEventListener('keydown', handleKeyDown);

  // Difficulty selection clicks
  document.querySelector('.difficulty-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.diff-opt-btn');
    if (!btn) return;
    const diff = btn.dataset.difficulty;
    startNewGame(diff);
  });

  // Stats Modal
  btnStats.addEventListener('click', () => {
    updateStatsUI();
    modalStats.classList.remove('hidden');
  });
  btnCloseStats.addEventListener('click', () => modalStats.classList.add('hidden'));
  btnClearStats.addEventListener('click', clearStats);

  // Help Modal
  btnHelp.addEventListener('click', () => {
    modalHelp.classList.remove('hidden');
  });
  btnCloseHelp.addEventListener('click', () => {
    modalHelp.classList.add('hidden');
  });

  // Game Won Modal
  btnWonNew.addEventListener('click', () => {
    modalWon.classList.add('hidden');
    showDifficultyModal();
  });
  btnWonClose.addEventListener('click', () => {
    modalWon.classList.add('hidden');
  });

  // Auto Notes Toggle
  toggleAutoNotes.addEventListener('change', (e) => {
    showAutoNotes = e.target.checked;
    if (showAutoNotes) {
      isNoteMode = false;
      btnNote.disabled = true;
      btnNote.classList.remove('active');
      btnNote.querySelector('.tool-text').textContent = '筆記 (自動)';
      if (board) {
        board.populateAllAutoNotes();
      }
    } else {
      btnNote.disabled = false;
      btnNote.querySelector('.tool-text').textContent = `筆記 (${isNoteMode ? '開' : '關'})`;
    }
    renderBoard();
    saveCurrentGame();
  });

  // Share level
  btnShare.addEventListener('click', () => {
    if (!board) return;
    const url = new URL(window.location.href);
    url.searchParams.set('puzzle', board.initialBoard.flat().join(''));
    url.searchParams.set('difficulty', board.difficulty);
    const urlStr = url.toString();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlStr).then(() => {
        showToast('關卡連結已複製到剪貼簿！分享給好友來挑戰吧！', 'success');
      }).catch(err => {
        fallbackCopyText(urlStr);
      });
    } else {
      fallbackCopyText(urlStr);
    }
  });

  function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast('關卡連結已複製到剪貼簿！分享給好友來挑戰吧！', 'success');
      } else {
        showToast('複製連結失敗，請手動複製網址。', 'warning');
      }
    } catch (err) {
      showToast('複製連結失敗，請手動複製網址。', 'warning');
    }
    document.body.removeChild(textArea);
  }

  // Check Board
  btnCheck.addEventListener('click', () => {
    if (isPaused || !board) return;

    const incorrects = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board.getValue(r, c);
        if (val !== 0 && !board.isClue(r, c) && !board.isCorrect(r, c)) {
          incorrects.push(`${r},${c}`);
        }
      }
    }

    if (incorrects.length > 0) {
      checkedErrorCells = new Set(incorrects);
      renderBoard();
      showToast(`發現了 ${incorrects.length} 處錯誤！已為您標出。`, 'warning');

      setTimeout(() => {
        if (checkedErrorCells.size > 0) {
          checkedErrorCells.clear();
          renderBoard();
        }
      }, 3000);
    } else {
      checkedErrorCells.clear();
      renderBoard();
      showToast('沒有發現任何錯誤，非常完美！', 'success');
    }
  });

  // Theme Toggle
  themeToggle.addEventListener('click', toggleTheme);
}

function findMissingNumber(arr) {
  for (let i = 1; i <= 9; i++) {
    if (!arr.includes(i)) return i;
  }
  return 0;
}

function checkAndAutoFillSoleCandidate(r, c) {
  if (!board || r === -1 || c === -1) return;
  if (board.getValue(r, c) !== 0 || board.isClue(r, c)) return;

  // Row check
  let rowVals = [];
  let rowEmptyCount = 0;
  for (let col = 0; col < 9; col++) {
    const val = board.getValue(r, col);
    if (val !== 0) {
      rowVals.push(val);
    } else {
      rowEmptyCount++;
    }
  }

  // Column check
  let colVals = [];
  let colEmptyCount = 0;
  for (let row = 0; row < 9; row++) {
    const val = board.getValue(row, c);
    if (val !== 0) {
      colVals.push(val);
    } else {
      colEmptyCount++;
    }
  }

  // Box check
  let boxVals = [];
  let boxEmptyCount = 0;
  const startRow = 3 * Math.floor(r / 3);
  const startCol = 3 * Math.floor(c / 3);
  for (let row = startRow; row < startRow + 3; row++) {
    for (let col = startCol; col < startCol + 3; col++) {
      const val = board.getValue(row, col);
      if (val !== 0) {
        boxVals.push(val);
      } else {
        boxEmptyCount++;
      }
    }
  }

  let autoFilledVal = 0;

  if (rowEmptyCount === 1) {
    const uniqueRowVals = [...new Set(rowVals)];
    if (uniqueRowVals.length === 8) {
      autoFilledVal = findMissingNumber(uniqueRowVals);
    }
  }

  if (autoFilledVal === 0 && colEmptyCount === 1) {
    const uniqueColVals = [...new Set(colVals)];
    if (uniqueColVals.length === 8) {
      autoFilledVal = findMissingNumber(uniqueColVals);
    }
  }

  if (autoFilledVal === 0 && boxEmptyCount === 1) {
    const uniqueBoxVals = [...new Set(boxVals)];
    if (uniqueBoxVals.length === 8) {
      autoFilledVal = findMissingNumber(uniqueBoxVals);
    }
  }

  if (autoFilledVal !== 0) {
    board.setCellValue(r, c, autoFilledVal);
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();
    saveCurrentGame();

    if (board.checkWin()) {
      handleWin();
    }
  }
}

function selectCell(r, c) {
  if (checkedErrorCells.size > 0) {
    checkedErrorCells.clear();
  }

  if (selectedRow === r && selectedCol === c) {
    // Deselect if clicking already selected
    selectedRow = -1;
    selectedCol = -1;
    activeNumberFilter = null;
  } else {
    selectedRow = r;
    selectedCol = c;
    activeNumberFilter = null; // Clear filter when cell is selected
    
    if (showSoleCandidateHint) {
      checkAndAutoFillSoleCandidate(r, c);
    }
  }
  
  // Highlight active number in pad
  updateActiveFilterUI();
  renderBoard();
}

function handleInputNumber(val) {
  if (checkedErrorCells.size > 0) {
    checkedErrorCells.clear();
  }
  if (selectedRow !== -1 && selectedCol !== -1) {
    const isClue = board.isClue(selectedRow, selectedCol);
    if (isClue) return;

    if (isNoteMode) {
      board.toggleNote(selectedRow, selectedCol, val);
    } else {
      const correctVal = board.solution[selectedRow][selectedCol];
      const prevVal = board.getValue(selectedRow, selectedCol);
      if (val !== correctVal && val !== prevVal) {
        errorCount++;
        updateCountersUI();
      }
      board.setCellValue(selectedRow, selectedCol, val);
    }
    
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();
    saveCurrentGame();

    // Check if the board is solved
    if (board.checkWin()) {
      handleWin();
    }
  } else {
    // Number filtering mode (no cell is selected)
    if (activeNumberFilter === val) {
      activeNumberFilter = null; // Toggle off filter
    } else {
      activeNumberFilter = val;
    }
    updateActiveFilterUI();
    renderBoard();
  }
}

function eraseSelectedCell() {
  if (checkedErrorCells.size > 0) {
    checkedErrorCells.clear();
  }
  if (selectedRow !== -1 && selectedCol !== -1) {
    if (board.clearCell(selectedRow, selectedCol)) {
      eraserCount++;
      updateCountersUI();
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
    }
  }
}

function applyHint() {
  if (selectedRow === -1 || selectedCol === -1) {
    alert('請先在棋盤上選擇一個空白的格子，再點擊「提示」！');
    return;
  }

  if (board.isClue(selectedRow, selectedCol)) {
    return;
  }

  const correctVal = board.solution[selectedRow][selectedCol];
  const currentVal = board.getValue(selectedRow, selectedCol);

  if (currentVal === correctVal) {
    alert('此格子填寫的數字已經是正確的囉！');
    return;
  }

  // 20-second penalty for using hint
  secondsElapsed += 20;
  timerEl.textContent = formatTime(secondsElapsed);

  // Set the correct value
  hintCount++;
  updateCountersUI();
  board.setCellValue(selectedRow, selectedCol, correctVal);
  renderBoard();
  updateNumpadCounts();
  updateUndoRedoButtons();
  saveCurrentGame();

  if (board.checkWin()) {
    handleWin();
  }
}

function updateActiveFilterUI() {
  const numBtns = document.querySelectorAll('.num-btn');
  numBtns.forEach(btn => {
    const val = parseInt(btn.dataset.value);
    if (activeNumberFilter === val && selectedRow === -1) {
      btn.classList.add('active-filter');
    } else {
      btn.classList.remove('active-filter');
    }
  });
}

function updateNumpadCounts() {
  if (!board) return;
  const counts = board.getCorrectNumberCounts();
  const numBtns = document.querySelectorAll('.num-btn');
  
  numBtns.forEach(btn => {
    const val = parseInt(btn.dataset.value);
    const count = counts[val];
    const remaining = 9 - count;
    
    const badge = btn.querySelector('.badge-count');
    
    if (remaining <= 0) {
      btn.classList.add('completed');
      badge.textContent = '✓';
      badge.classList.add('completed-badge');
    } else {
      btn.classList.remove('completed');
      badge.textContent = remaining;
      badge.classList.remove('completed-badge');
    }
  });
}

function updateNumpadCandidates() {
  const numBtns = document.querySelectorAll('.num-btn');
  
  if (selectedRow === -1 || selectedCol === -1 || !board || board.isClue(selectedRow, selectedCol)) {
    numBtns.forEach(btn => btn.classList.remove('invalid-candidate'));
    return;
  }

  const invalidNumbers = new Set();
  
  // 1. Check Row
  for (let col = 0; col < 9; col++) {
    const val = board.getValue(selectedRow, col);
    if (val !== 0) invalidNumbers.add(val);
  }

  // 2. Check Column
  for (let row = 0; row < 9; row++) {
    const val = board.getValue(row, selectedCol);
    if (val !== 0) invalidNumbers.add(val);
  }

  // 3. Check Box
  const startRow = 3 * Math.floor(selectedRow / 3);
  const startCol = 3 * Math.floor(selectedCol / 3);
  for (let row = startRow; row < startRow + 3; row++) {
    for (let col = startCol; col < startCol + 3; col++) {
      const val = board.getValue(row, col);
      if (val !== 0) invalidNumbers.add(val);
    }
  }

  numBtns.forEach(btn => {
    const val = parseInt(btn.dataset.value);
    if (invalidNumbers.has(val)) {
      btn.classList.add('invalid-candidate');
    } else {
      btn.classList.remove('invalid-candidate');
    }
  });
}

function updateUndoRedoButtons() {
  if (!board) return;
  btnUndo.disabled = board.history.length === 0;
  btnRedo.disabled = board.redoHistory.length === 0;
}

// Keyboard key handler
function handleKeyDown(e) {
  if (isPaused || !board) return;
  
  // Ignore keyboard actions if user is focused inside input elements (none currently, but standard practice)
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Modals open ignore game keybinds
  if (!modalDifficulty.classList.contains('hidden') || 
      !modalStats.classList.contains('hidden') || 
      !modalHelp.classList.contains('hidden') ||
      !modalWon.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      modalDifficulty.classList.add('hidden');
      modalStats.classList.add('hidden');
      modalHelp.classList.add('hidden');
      modalWon.classList.add('hidden');
    }
    return;
  }

  // 1-9 inputs
  if (e.key >= '1' && e.key <= '9') {
    handleInputNumber(parseInt(e.key));
    e.preventDefault();
  }
  
  // Clear/Erase
  else if (e.key === 'Backspace' || e.key === 'Delete') {
    eraseSelectedCell();
    e.preventDefault();
  }

  // Undo (Ctrl+Z or U)
  else if ((e.ctrlKey && e.key === 'z') || e.key === 'u' || e.key === 'U') {
    if (board.undo()) {
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
    }
    e.preventDefault();
  }

  // Redo (Ctrl+Y or Shift+Ctrl+Z or R)
  else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z') || e.key === 'r' || e.key === 'R') {
    if (board.redo()) {
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
    }
    e.preventDefault();
  }

  // Note mode toggle (N)
  else if (e.key === 'n' || e.key === 'N') {
    if (showAutoNotes) {
      showToast('自動筆記模式已開啟，無法手動修改筆記。', 'warning');
    } else {
      isNoteMode = !isNoteMode;
      btnNote.classList.toggle('active', isNoteMode);
      btnNote.querySelector('.tool-text').textContent = `筆記 (${isNoteMode ? '開' : '關'})`;
    }
    e.preventDefault();
  }

  // Hint (H)
  else if (e.key === 'h' || e.key === 'H') {
    applyHint();
    e.preventDefault();
  }

  // Arrow key navigation
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (selectedRow === -1 || selectedCol === -1) {
      selectedRow = 4;
      selectedCol = 4;
    } else {
      if (e.key === 'ArrowUp') selectedRow = (selectedRow - 1 + 9) % 9;
      if (e.key === 'ArrowDown') selectedRow = (selectedRow + 1) % 9;
      if (e.key === 'ArrowLeft') selectedCol = (selectedCol - 1 + 9) % 9;
      if (e.key === 'ArrowRight') selectedCol = (selectedCol + 1) % 9;
    }
    activeNumberFilter = null;
    updateActiveFilterUI();
    renderBoard();
    e.preventDefault();
  }

  // Escape to deselect
  else if (e.key === 'Escape') {
    selectedRow = -1;
    selectedCol = -1;
    activeNumberFilter = null;
    updateActiveFilterUI();
    renderBoard();
    e.preventDefault();
  }
}

// --- WIN SCENE ---
function handleWin() {
  clearInterval(timerInterval);
  
  // Clear saved game
  localStorage.removeItem(STORAGE_GAME_KEY);

  // Update statistics
  const stats = getStats();
  stats.totalWins++;
  if (stats.difficultyStats && stats.difficultyStats[board.difficulty]) {
    stats.difficultyStats[board.difficulty].wins++;
  }
  
  const currentBest = stats.bestTimes[board.difficulty];
  let isNewRecord = false;
  if (currentBest === null || secondsElapsed < currentBest) {
    stats.bestTimes[board.difficulty] = secondsElapsed;
    isNewRecord = true;
  }
  
  saveStats(stats);

  // Trigger Fireworks/Confetti!
  triggerConfetti();

  // Populate Victory Modal
  const diffNames = {
    easy: '簡單 (Easy)',
    medium: '中等 (Medium)',
    hard: '困難 (Hard)',
    expert: '專家 (Expert)'
  };
  document.getElementById('won-difficulty').textContent = diffNames[board.difficulty] || board.difficulty;
  document.getElementById('won-time').textContent = formatTime(secondsElapsed);
  
  const recordEl = document.getElementById('won-new-record');
  if (isNewRecord) {
    recordEl.classList.remove('hidden');
  } else {
    recordEl.classList.add('hidden');
  }

  // Display Modal after a short delay
  setTimeout(() => {
    modalWon.classList.remove('hidden');
  }, 1000);
}

function triggerConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

function showDifficultyModal() {
  modalDifficulty.classList.remove('hidden');
}
