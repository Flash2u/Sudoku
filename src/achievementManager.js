// ----------------------------------------------------
// 本地勳章成就系統 (Achievements Manager)
// 定義成就條件、進度檢查、連續天數紀錄與 LocalStorage 存取
// ----------------------------------------------------

export const ACHIEVEMENTS = [
  {
    id: 'speed_demon',
    icon: '🏆',
    title: '數獨快手',
    description: '5 分鐘內完成簡單關卡。',
    check: (stats, context) => {
      return context.difficulty === 'easy' && context.secondsElapsed <= 300;
    }
  },
  {
    id: 'pure_mind',
    icon: '🧠',
    title: '純腦力運算',
    description: '在不開啟任何筆記與提示下完成困難或專家關卡。',
    check: (stats, context) => {
      const isHardOrExpert = context.difficulty === 'hard' || context.difficulty === 'expert';
      return isHardOrExpert && !context.notesUsed && context.hintCount === 0 && !context.showAutoNotes;
    }
  },
  {
    id: 'flawless',
    icon: '🎯',
    title: '毫無破綻',
    description: '通關且 0 錯誤、0 擦除。',
    check: (stats, context) => {
      return context.errorCount === 0 && context.eraserCount === 0;
    }
  },
  {
    id: 'consistent_7d',
    icon: '📅',
    title: '持之以恆',
    description: '連續完成 7 天每日遊玩挑戰。',
    check: (stats, context) => {
      return (stats.streak?.currentStreak || 0) >= 7;
    }
  }
];

const STORAGE_ACHIEVEMENTS_KEY = 'sub_sudoku_achievements';

/**
 * 取得所有成就資料與當前連續遊玩天數
 */
export function getAchievementData() {
  const stored = localStorage.getItem(STORAGE_ACHIEVEMENTS_KEY);
  if (!stored) {
    return {
      unlocked: {},
      streak: {
        currentStreak: 0,
        lastWinDate: null,
        winDates: []
      }
    };
  }
  try {
    const data = JSON.parse(stored);
    if (!data.unlocked) data.unlocked = {};
    if (!data.streak) {
      data.streak = { currentStreak: 0, lastWinDate: null, winDates: [] };
    }
    return data;
  } catch (e) {
    console.error('Failed to parse achievement data:', e);
    return {
      unlocked: {},
      streak: { currentStreak: 0, lastWinDate: null, winDates: [] }
    };
  }
}

/**
 * 儲存成就資料
 */
export function saveAchievementData(data) {
  localStorage.setItem(STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(data));
}

/**
 * 更新每日通關連續天數
 */
function updateDailyStreak(data) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  if (!data.streak) {
    data.streak = { currentStreak: 0, lastWinDate: null, winDates: [] };
  }

  const { lastWinDate, currentStreak, winDates } = data.streak;

  if (lastWinDate === todayStr) {
    // 今天已經獲勝過，保持連續天數
    return data.streak.currentStreak;
  }

  if (!winDates.includes(todayStr)) {
    winDates.push(todayStr);
  }

  if (!lastWinDate) {
    // 第一次獲勝
    data.streak.currentStreak = 1;
    data.streak.lastWinDate = todayStr;
  } else {
    // 計算與上次獲勝相差的天數
    const lastDate = new Date(lastWinDate);
    const currentDate = new Date(todayStr);
    const diffTime = Math.abs(currentDate - lastDate);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // 連續下一天
      data.streak.currentStreak = (currentStreak || 0) + 1;
      data.streak.lastWinDate = todayStr;
    } else if (diffDays === 0) {
      // 同一天
    } else {
      // 中斷，重新起算
      data.streak.currentStreak = 1;
      data.streak.lastWinDate = todayStr;
    }
  }

  return data.streak.currentStreak;
}

/**
 * 於通關時檢驗並解鎖成就
 * @param {Object} context 遊戲通關情境數據
 * @returns {Array} 本次新解鎖的成就列表
 */
export function checkGameWinAchievements(context) {
  const data = getAchievementData();
  
  // 1. 更新連續天數
  updateDailyStreak(data);

  const newlyUnlocked = [];
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 2. 檢驗所有未解鎖之成就
  ACHIEVEMENTS.forEach(ach => {
    if (!data.unlocked[ach.id]) {
      if (ach.check(data, context)) {
        data.unlocked[ach.id] = {
          unlockedAt: dateStr,
          timestamp: Date.now()
        };
        newlyUnlocked.push(ach);
      }
    }
  });

  if (newlyUnlocked.length > 0 || true) {
    saveAchievementData(data);
  }

  return newlyUnlocked;
}
