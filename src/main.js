import './style.css';
import confetti from 'canvas-confetti';
import { generateSudoku, solveSudoku } from './sudokuGenerator.js';
import { Board } from './board.js';
import { soundManager } from './sound.js';
import { analyzeSmartHint } from './smartHint.js';
import { ACHIEVEMENTS, getAchievementData, checkGameWinAchievements } from './achievementManager.js';

// --- GAME STATE ---
let board = null;
let selectedRow = -1;
let selectedCol = -1;
let isNoteMode = false;
let hasUsedNotesThisGame = false;
let showErrors = true;
let showSoleCandidateHint = true;
let showCandidateHint = false;
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

// Completed Lines Tracker for Neon Sweep FX & Chords
let completedRows = new Set();
let completedCols = new Set();
let completedBoxes = new Set();

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
const btnAchievements = document.getElementById('btn-achievements');
const themeToggle = document.getElementById('theme-toggle');
const themeDropdownMenu = document.getElementById('theme-dropdown-menu');
const toggleErrors = document.getElementById('toggle-errors');
const toggleSoleCandidate = document.getElementById('toggle-sole-candidate');
const toggleCandidateHint = document.getElementById('toggle-candidate-hint');
const toggleAutoNotes = document.getElementById('toggle-auto-notes');
const toggleXMode = document.getElementById('toggle-x-mode');
const modeToggleCard = document.getElementById('mode-toggle-card');
const modeStatusText = document.getElementById('mode-status-text');
const btnHelp = document.getElementById('btn-help');
const btnShare = document.getElementById('btn-share');
const btnCheck = document.getElementById('btn-check');
const btnSound = document.getElementById('btn-sound');

// Achievement Banner & Modals DOM
const achievementBanner = document.getElementById('achievement-banner');
const achBannerIcon = document.getElementById('ach-banner-icon');
const achBannerTitle = document.getElementById('ach-banner-title');
const modalAchievements = document.getElementById('modal-achievements');
const btnCloseAchievements = document.getElementById('btn-close-achievements');
const achievementsList = document.getElementById('achievements-list');
const achievementsSummaryBadge = document.getElementById('achievements-summary-badge');
const achievementsStreakDays = document.getElementById('achievements-streak-days');
const wonAchievementsArea = document.getElementById('won-achievements-area');
const wonAchievementsBadges = document.getElementById('won-achievements-badges');

// Smart Hint DOM & State
const smartHintCard = document.getElementById('smart-hint-card');
const hintStageBadge = document.getElementById('hint-stage-badge');
const hintCardText = document.getElementById('hint-card-text');
const btnHintProceed = document.getElementById('btn-hint-proceed');
const btnCloseHintCard = document.getElementById('btn-close-hint-card');

let currentHintState = {
  active: false,
  stage: 0, // 0: inactive, 1: scope, 2: logic
  data: null
};

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
const badgeGameMode = document.getElementById('badge-game-mode');
const modeDescText = document.getElementById('mode-desc-text');
const timerEl = document.getElementById('timer');

// --- LOCAL STORAGE KEYS ---
const STORAGE_GAME_KEY = 'sub_sudoku_active_game';
const STORAGE_STATS_KEY = 'sub_sudoku_stats';
const STORAGE_THEME_KEY = 'sub_sudoku_theme';
const STORAGE_MODE_KEY = 'sub_sudoku_game_mode';
let selectedGameMode = localStorage.getItem(STORAGE_MODE_KEY) || 'standard'; // 'standard' | 'diagonal'

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initStats();
  updateSoundButtonUI();
  bindEvents();

  // 任意觸控或點擊解鎖 Web Audio Context
  const unlockAudio = () => {
    soundManager.initContext();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  
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
const THEMES_CONFIG = {
  dark: { name: '深邃暗夜', icon: '🌙' },
  light: { name: '晨曦明亮', icon: '☀️' },
  oled: { name: '極致純黑', icon: '🖤' },
  paper: { name: '復古紙質', icon: '📜' },
  matcha: { name: '森林抹茶', icon: '🍵' }
};

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
  applyTheme(savedTheme, false);
}

function applyTheme(themeName, showToastMsg = true) {
  const theme = THEMES_CONFIG[themeName] ? themeName : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_THEME_KEY, theme);
  
  if (themeToggle) {
    themeToggle.textContent = THEMES_CONFIG[theme].icon;
    themeToggle.title = `切換主題風格（目前：${THEMES_CONFIG[theme].name}）`;
  }

  // 更新選單選項 active 狀態
  const optionBtns = document.querySelectorAll('.theme-option-btn');
  optionBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === theme);
  });

  if (showToastMsg) {
    showToast(`已套用主題：${THEMES_CONFIG[theme].name}`, 'info');
  }
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

// --- ACHIEVEMENTS MANAGEMENT ---
function showAchievementBanner(ach) {
  if (!achievementBanner) return;
  achBannerIcon.textContent = ach.icon;
  achBannerTitle.textContent = `${ach.title}：${ach.description}`;
  achievementBanner.classList.add('show');
  soundManager.playTone(880, 0.25, 'triangle', 0.2);
  setTimeout(() => {
    achievementBanner.classList.remove('show');
  }, 4000);
}

function renderAchievementsModal() {
  const data = getAchievementData();
  const unlockedKeys = Object.keys(data.unlocked || {});
  const unlockedCount = unlockedKeys.length;
  
  if (achievementsSummaryBadge) {
    achievementsSummaryBadge.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length} 解鎖`;
  }
  if (achievementsStreakDays) {
    achievementsStreakDays.textContent = data.streak?.currentStreak || 0;
  }
  
  if (achievementsList) {
    achievementsList.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
      const isUnlocked = !!data.unlocked[ach.id];
      const card = document.createElement('div');
      card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      
      const unlockDate = isUnlocked ? data.unlocked[ach.id].unlockedAt : null;

      card.innerHTML = `
        <div class="achievement-icon-wrap">
          <span>${ach.icon}</span>
        </div>
        <div class="achievement-info">
          <div class="achievement-header">
            <span class="achievement-title">${ach.title}</span>
            <span class="achievement-status-badge">${isUnlocked ? '✓ 已解鎖' : '🔒 未達成'}</span>
          </div>
          <div class="achievement-desc">${ach.description}</div>
          ${isUnlocked && unlockDate ? `<div class="achievement-date">🏆 解鎖於：${unlockDate}</div>` : ''}
        </div>
      `;
      achievementsList.appendChild(card);
    });
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
  dismissHint();
  modalDifficulty.classList.add('hidden');
  const modalLoading = document.getElementById('modal-loading');
  if (modalLoading) {
    modalLoading.classList.remove('hidden');
  }

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

  // Initialize Web Worker for background generation
  const isDiagonal = selectedGameMode === 'diagonal';
  const worker = new Worker(new URL('./sudokuWorker.js', import.meta.url), { type: 'module' });
  worker.postMessage({ difficulty, isDiagonal });
  
  worker.onmessage = function (e) {
    const { success, result, error } = e.data;
    
    if (modalLoading) {
      modalLoading.classList.add('hidden');
    }
    worker.terminate();

    if (success) {
      const { puzzle, solution } = result;
      board = new Board(puzzle, solution, difficulty, isDiagonal);
      window.board = board;
      updateModeUI();

      // Set difficulty badge
      const diffLabels = {
        easy: '🐱 簡單 (Easy)',
        medium: '🐶 中等 (Medium)',
        hard: '🐯 困難 (Hard)',
        expert: '🧙‍♂️ 專家 (Expert)'
      };
      labelDifficulty.textContent = diffLabels[difficulty] || difficulty;

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
      completedRows.clear();
      completedCols.clear();
      completedBoxes.clear();
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      checkLineCompletions(false);
      startTimer();
      saveCurrentGame();
    } else {
      console.error('Failed to generate Sudoku:', error);
      showToast('生成數獨失敗，請重試。', 'warning');
    }
  };
}

function resetGame() {
  if (!board) return;
  if (confirm('您確定要將棋盤回復到初始狀態嗎？所有的填寫進度與筆記將會被清除。')) {
    board = new Board(board.initialBoard, board.solution, board.difficulty, board.isDiagonal);
    updateModeUI();
    selectedRow = -1;
    selectedCol = -1;
    activeNumberFilter = null;
    secondsElapsed = 0;
    timerEl.textContent = '00:00';
    
    // Reset Counters & Notes Flag
    errorCount = 0;
    eraserCount = 0;
    hintCount = 0;
    hasUsedNotesThisGame = false;
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
    showCandidateHint,
    showAutoNotes,
    hasUsedNotesThisGame,
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
    showCandidateHint = gameState.showCandidateHint !== undefined ? gameState.showCandidateHint : false;
    showAutoNotes = gameState.showAutoNotes !== undefined ? gameState.showAutoNotes : false;
    hasUsedNotesThisGame = gameState.hasUsedNotesThisGame !== undefined ? gameState.hasUsedNotesThisGame : false;
    
    // Restore counters
    errorCount = gameState.errorCount || 0;
    eraserCount = gameState.eraserCount || 0;
    hintCount = gameState.hintCount || 0;
    updateCountersUI(false);

    // Restore UI switches
    toggleErrors.checked = showErrors;
    toggleSoleCandidate.checked = showSoleCandidateHint;
    toggleCandidateHint.checked = showCandidateHint;
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
    
    updateModeUI();
    completedRows.clear();
    completedCols.clear();
    completedBoxes.clear();
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();
    checkLineCompletions(false);

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

function updateModeUI() {
  if (!board) return;
  const isDiag = !!board.isDiagonal;
  if (badgeGameMode) {
    if (isDiag) {
      badgeGameMode.classList.remove('hidden');
      badgeGameMode.textContent = '⚔️ X-Sudoku';
    } else {
      badgeGameMode.classList.add('hidden');
    }
  }
  if (toggleXMode) {
    toggleXMode.checked = isDiag;
  }
  if (modeToggleCard) {
    modeToggleCard.classList.toggle('active', isDiag);
  }
  if (modeStatusText) {
    modeStatusText.textContent = isDiag ? '⚔️ X 模式已啟用 (雙對角線約束)' : '🌟 標準模式 (點擊開關啟用)';
  }
  // 同步難度選擇彈窗內的分頁按鈕
  const modeTabs = document.querySelectorAll('.mode-tab');
  modeTabs.forEach(t => {
    if (t.dataset.mode === (isDiag ? 'diagonal' : 'standard')) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
}

// --- SMART HINTS SYSTEM ---
function dismissHint() {
  currentHintState.active = false;
  currentHintState.stage = 0;
  currentHintState.data = null;
  if (smartHintCard) smartHintCard.classList.add('hidden');
  if (btnHint) {
    btnHint.classList.remove('hint-active');
    const textEl = btnHint.querySelector('.tool-text');
    if (textEl) textEl.textContent = '提示';
  }
  renderBoard();
}

// --- SOUND & NEON SWEEP LINE COMPLETION ---
function updateSoundButtonUI() {
  if (!btnSound) return;
  const enabled = soundManager.isEnabled();
  btnSound.textContent = enabled ? '🔊' : '🔇';
  btnSound.title = enabled ? '切換音效（目前：開啟，快捷鍵 S）' : '切換音效（目前：靜音，快捷鍵 S）';
  btnSound.classList.toggle('muted', !enabled);
}

function checkLineCompletions(triggerFx = true) {
  if (!board) return;

  const newCompletedCells = new Set();
  let newlyCompletedLines = 0;

  // 1. 檢查 9 橫列
  for (let r = 0; r < 9; r++) {
    let complete = true;
    for (let c = 0; c < 9; c++) {
      const val = board.getValue(r, c);
      if (val === 0 || val !== board.solution[r][c]) {
        complete = false;
        break;
      }
    }
    if (complete) {
      if (!completedRows.has(r)) {
        completedRows.add(r);
        newlyCompletedLines++;
        for (let c = 0; c < 9; c++) {
          newCompletedCells.add(r + ',' + c);
        }
      }
    } else {
      completedRows.delete(r);
    }
  }

  // 2. 檢查 9 直行
  for (let c = 0; c < 9; c++) {
    let complete = true;
    for (let r = 0; r < 9; r++) {
      const val = board.getValue(r, c);
      if (val === 0 || val !== board.solution[r][c]) {
        complete = false;
        break;
      }
    }
    if (complete) {
      if (!completedCols.has(c)) {
        completedCols.add(c);
        newlyCompletedLines++;
        for (let r = 0; r < 9; r++) {
          newCompletedCells.add(r + ',' + c);
        }
      }
    } else {
      completedCols.delete(c);
    }
  }

  // 3. 檢查 9 個 3x3 九宮格
  for (let b = 0; b < 9; b++) {
    const startR = Math.floor(b / 3) * 3;
    const startC = (b % 3) * 3;
    let complete = true;
    for (let r = startR; r < startR + 3; r++) {
      for (let c = startC; c < startC + 3; c++) {
        const val = board.getValue(r, c);
        if (val === 0 || val !== board.solution[r][c]) {
          complete = false;
          break;
        }
      }
      if (!complete) break;
    }
    if (complete) {
      if (!completedBoxes.has(b)) {
        completedBoxes.add(b);
        newlyCompletedLines++;
        for (let r = startR; r < startR + 3; r++) {
          for (let c = startC; c < startC + 3; c++) {
            newCompletedCells.add(r + ',' + c);
          }
        }
      }
    } else {
      completedBoxes.delete(b);
    }
  }

  // 觸發音效與霓虹流光動畫
  if (triggerFx && newlyCompletedLines > 0 && newCompletedCells.size > 0) {
    soundManager.playLineComplete();
    triggerNeonSweep(Array.from(newCompletedCells));
  }
}

function triggerNeonSweep(cellKeys) {
  cellKeys.forEach((key, idx) => {
    const parts = key.split(',');
    const r = parts[0];
    const c = parts[1];
    const cellEl = sudokuBoardEl.querySelector('.sudoku-cell[data-row="' + r + '"][data-col="' + c + '"]');
    if (cellEl) {
      cellEl.classList.remove('neon-sweep');
      cellEl.style.setProperty('--sweep-delay', ((idx % 9) * 0.045) + 's');
      void cellEl.offsetWidth; // force reflow
      cellEl.classList.add('neon-sweep');

      setTimeout(() => {
        cellEl.classList.remove('neon-sweep');
        cellEl.style.removeProperty('--sweep-delay');
      }, 900);
    }
  });
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

      // Diagonal styling (X-Sudoku 雙對角線幾何視覺)
      if (board && board.isDiagonal) {
        if (r === c || r + c === 8) {
          cellEl.classList.add('cell-diagonal');
          if (r === 4 && c === 4) {
            cellEl.classList.add('cell-diagonal-center');
          }
        }
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
      let isSameDiagonal = false;
      if (board && board.isDiagonal && selectedRow !== -1 && selectedCol !== -1) {
        const selOnMain = (selectedRow === selectedCol);
        const selOnAnti = (selectedRow + selectedCol === 8);
        const cellOnMain = (r === c);
        const cellOnAnti = (r + c === 8);
        if ((selOnMain && cellOnMain) || (selOnAnti && cellOnAnti)) {
          isSameDiagonal = true;
        }
      }

      if (r === selectedRow && c === selectedCol) {
        cellEl.classList.add('selected');
      } else if (
        r === selectedRow || 
        c === selectedCol || 
        (Math.floor(r / 3) === Math.floor(selectedRow / 3) && Math.floor(c / 3) === Math.floor(selectedCol / 3)) ||
        isSameDiagonal
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
        if (isSameDiagonal) {
          cellEl.classList.add('highlight-diagonal');
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
      checkLineCompletions(false);
    }
  });

  btnRedo.addEventListener('click', () => {
    if (isPaused || !board) return;
    if (board.redo()) {
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
      checkLineCompletions(false);
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

  toggleCandidateHint.addEventListener('change', (e) => {
    showCandidateHint = e.target.checked;
    updateNumpadCandidates();
    saveCurrentGame();
  });

  // 主畫面常駐對角線 X-Sudoku 模式開關
  if (toggleXMode) {
    toggleXMode.addEventListener('change', (e) => {
      const wantDiag = e.target.checked;
      const currentDiag = board ? !!board.isDiagonal : false;
      if (wantDiag === currentDiag) return;

      const modeName = wantDiag ? '對角線 X-Sudoku' : '標準數獨';
      if (confirm(`切換為「${modeName}」模式將開啟新局，確定要開始新遊戲嗎？`)) {
        selectedGameMode = wantDiag ? 'diagonal' : 'standard';
        localStorage.setItem(STORAGE_MODE_KEY, selectedGameMode);
        startNewGame(board ? board.difficulty : 'medium');
      } else {
        // 使用者取消操作，還原開關狀態
        toggleXMode.checked = currentDiag;
      }
    });
  }

  // Keyboard navigation & inputs
  document.addEventListener('keydown', handleKeyDown);

  // Mode selection tabs (難度彈窗內的模式切換分頁)
  const modeTabs = document.querySelectorAll('.mode-tab');
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedGameMode = tab.dataset.mode;
      localStorage.setItem(STORAGE_MODE_KEY, selectedGameMode);
      if (modeDescText) {
        modeDescText.textContent = selectedGameMode === 'diagonal'
          ? '⚔️ 對角線規則：每列、每行、九宮格以及兩條主對角線 1~9 均不重複'
          : '🌟 經典規則：每橫列、每直行與九宮格數字均為 1~9 不重複';
      }
      // 聯動同步主畫面的開關與外觀
      const isDiag = selectedGameMode === 'diagonal';
      if (toggleXMode) toggleXMode.checked = isDiag;
      if (modeToggleCard) modeToggleCard.classList.toggle('active', isDiag);
      if (modeStatusText) {
        modeStatusText.textContent = isDiag ? '⚔️ X 模式已啟用 (雙對角線約束)' : '🌟 標準模式 (點擊開關啟用)';
      }
    });
  });

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

  // Achievements Modal
  if (btnAchievements) {
    btnAchievements.addEventListener('click', () => {
      renderAchievementsModal();
      modalAchievements.classList.remove('hidden');
    });
  }
  if (btnCloseAchievements) {
    btnCloseAchievements.addEventListener('click', () => modalAchievements.classList.add('hidden'));
  }

  // Theme Picker Dropdown & Selection
  if (themeToggle && themeDropdownMenu) {
    themeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      themeDropdownMenu.classList.toggle('show');
    });

    themeDropdownMenu.addEventListener('click', (e) => {
      const optBtn = e.target.closest('.theme-option-btn');
      if (!optBtn) return;
      const themeVal = optBtn.dataset.themeVal;
      applyTheme(themeVal);
      themeDropdownMenu.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
      if (!themeDropdownMenu.contains(e.target) && e.target !== themeToggle) {
        themeDropdownMenu.classList.remove('show');
      }
    });
  }

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
      hasUsedNotesThisGame = true;
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

  // Sound Toggle
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      const enabled = soundManager.toggle();
      updateSoundButtonUI();
      showToast(enabled ? '🔊 音效已開啟' : '🔇 音效已靜音', 'info');
    });
  }

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
    soundManager.playNumber(autoFilledVal);
    board.setCellValue(r, c, autoFilledVal);
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();
    saveCurrentGame();
    checkLineCompletions(true);

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
      hasUsedNotesThisGame = true;
      board.toggleNote(selectedRow, selectedCol, val);
      soundManager.playTone(440, 0.08, 'sine', 0.1);
    } else {
      const correctVal = board.solution[selectedRow][selectedCol];
      const prevVal = board.getValue(selectedRow, selectedCol);
      if (val !== correctVal && val !== prevVal) {
        errorCount++;
        updateCountersUI();
        soundManager.playError();
      } else {
        soundManager.playNumber(val);
      }
      board.setCellValue(selectedRow, selectedCol, val);
    }
    
    renderBoard();
    updateNumpadCounts();
    updateUndoRedoButtons();
    saveCurrentGame();
    checkLineCompletions(true);

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
      soundManager.playErase();
      renderBoard();
      updateNumpadCounts();
      updateUndoRedoButtons();
      saveCurrentGame();
      checkLineCompletions(false);
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
  soundManager.playNumber(correctVal);
  board.setCellValue(selectedRow, selectedCol, correctVal);
  renderBoard();
  updateNumpadCounts();
  updateUndoRedoButtons();
  saveCurrentGame();
  checkLineCompletions(true);

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
  
  if (!showCandidateHint || selectedRow === -1 || selectedCol === -1 || !board || board.isClue(selectedRow, selectedCol)) {
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
      !modalAchievements.classList.contains('hidden') || 
      !modalHelp.classList.contains('hidden') ||
      !modalWon.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      modalDifficulty.classList.add('hidden');
      modalStats.classList.add('hidden');
      modalAchievements.classList.add('hidden');
      modalHelp.classList.add('hidden');
      modalWon.classList.add('hidden');
      if (themeDropdownMenu) themeDropdownMenu.classList.remove('show');
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
      checkLineCompletions(false);
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
      checkLineCompletions(false);
    }
    e.preventDefault();
  }

  // Sound toggle (S)
  else if (e.key === 's' || e.key === 'S') {
    const enabled = soundManager.toggle();
    updateSoundButtonUI();
    showToast(enabled ? '🔊 音效已開啟' : '🔇 音效已靜音', 'info');
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
  soundManager.playWin();
  
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

  // Check Achievements
  const newlyUnlocked = checkGameWinAchievements({
    difficulty: board.difficulty,
    secondsElapsed,
    errorCount,
    eraserCount,
    hintCount,
    notesUsed: hasUsedNotesThisGame,
    showAutoNotes
  });

  if (newlyUnlocked.length > 0) {
    showAchievementBanner(newlyUnlocked[0]);
    if (wonAchievementsArea && wonAchievementsBadges) {
      wonAchievementsArea.classList.remove('hidden');
      wonAchievementsBadges.innerHTML = '';
      newlyUnlocked.forEach(ach => {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.background = 'linear-gradient(135deg, #eab308, #f59e0b)';
        badge.style.color = '#000';
        badge.style.fontWeight = '700';
        badge.textContent = `${ach.icon} ${ach.title}`;
        wonAchievementsBadges.appendChild(badge);
      });
    }
  } else {
    if (wonAchievementsArea) wonAchievementsArea.classList.add('hidden');
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
