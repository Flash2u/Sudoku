/**
 * 智慧提示推理演算法模組 (Smart Hints Engine)
 * 支援標準數獨與對角線 X-Sudoku 邏輯推理
 */

export function analyzeSmartHint(board, selectedRow = -1, selectedCol = -1) {
  if (!board) return null;

  // 1. 檢查是否有使用者填寫錯誤的格子，若有，優先提示修正錯誤
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = board.getValue(r, c);
      if (val !== 0 && !board.isClue(r, c) && !board.isCorrect(r, c)) {
        return {
          type: 'error_cell',
          row: r,
          col: c,
          value: board.solution[r][c],
          wrongValue: val,
          stage1: {
            title: '⚠️ 發現衝突 (1/3 範圍提示)',
            message: '第 ' + (r + 1) + ' 列第 ' + (c + 1) + ' 格目前填入的數字似乎有衝突！',
            highlightScope: [{ row: r, col: c }]
          },
          stage2: {
            title: '🔍 排除分析 (2/3 邏輯提示)',
            message: '此格填入的 ' + val + ' 與數獨解答或規則不符，建議擦除後重新推理（此格正確應為 ' + board.solution[r][c] + '）。',
            highlightTarget: { row: r, col: c },
            relatedCells: []
          },
          stage3: {
            fillValue: board.solution[r][c]
          }
        };
      }
    }
  }

  // 輔助函式：計算某格同儕格已有的數字與坐標
  function getPeerInfo(r, c) {
    const peers = new Map(); // val -> {row, col}
    // Row
    for (let col = 0; col < 9; col++) {
      if (col !== c) {
        const v = board.getValue(r, col);
        if (v !== 0 && !peers.has(v)) peers.set(v, { row: r, col });
      }
    }
    // Col
    for (let row = 0; row < 9; row++) {
      if (row !== r) {
        const v = board.getValue(row, c);
        if (v !== 0 && !peers.has(v)) peers.set(v, { row, col: c });
      }
    }
    // Box
    const startR = Math.floor(r / 3) * 3;
    const startC = Math.floor(c / 3) * 3;
    for (let row = startR; row < startR + 3; row++) {
      for (let col = startC; col < startC + 3; col++) {
        if (row !== r || col !== c) {
          const v = board.getValue(row, col);
          if (v !== 0 && !peers.has(v)) peers.set(v, { row, col });
        }
      }
    }
    // Diagonals (X-Sudoku)
    if (board.isDiagonal) {
      if (r === c) {
        for (let i = 0; i < 9; i++) {
          if (i !== r) {
            const v = board.getValue(i, i);
            if (v !== 0 && !peers.has(v)) peers.set(v, { row: i, col: i });
          }
        }
      }
      if (r + c === 8) {
        for (let i = 0; i < 9; i++) {
          if (i !== r) {
            const v = board.getValue(i, 8 - i);
            if (v !== 0 && !peers.has(v)) peers.set(v, { row: i, col: 8 - i });
          }
        }
      }
    }
    return peers;
  }

  // 2. 若玩家已選定某個有效空格，優先分析該格
  if (selectedRow !== -1 && selectedCol !== -1 && board.getValue(selectedRow, selectedCol) === 0) {
    const r = selectedRow;
    const c = selectedCol;
    const peers = getPeerInfo(r, c);
    const seenVals = Array.from(peers.keys()).sort((a, b) => a - b);
    const correctVal = board.solution[r][c];

    // 若 peers 已經排除了其他 8 個數字 (Naked Single)
    if (seenVals.length === 8 && !peers.has(correctVal)) {
      return buildNakedSingleHint(r, c, correctVal, peers, seenVals, board.isDiagonal);
    }
  }

  // 3. 全盤搜尋唯餘解 (Naked Single - 某格同行同列同宮同對角線排除了 8 個數字)
  const nakedSingles = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board.getValue(r, c) === 0) {
        const peers = getPeerInfo(r, c);
        const correctVal = board.solution[r][c];
        if (peers.size === 8 && !peers.has(correctVal)) {
          nakedSingles.push({ r, c, correctVal, peers });
        }
      }
    }
  }

  if (nakedSingles.length > 0) {
    const candidate = nakedSingles[0];
    const seenVals = Array.from(candidate.peers.keys()).sort((a, b) => a - b);
    return buildNakedSingleHint(candidate.r, candidate.c, candidate.correctVal, candidate.peers, seenVals, board.isDiagonal);
  }

  // 4. 全盤搜尋隱性唯一解 (Hidden Single in Row / Col / Box / Diagonal)
  // 4.1 搜尋列中的隱性唯一
  for (let r = 0; r < 9; r++) {
    for (let val = 1; val <= 9; val++) {
      let possibleCols = [];
      for (let c = 0; c < 9; c++) {
        if (board.getValue(r, c) === 0) {
          const peers = getPeerInfo(r, c);
          if (!peers.has(val) && board.solution[r][c] === val) {
            possibleCols.push(c);
          }
        }
      }
      if (possibleCols.length === 1) {
        const c = possibleCols[0];
        return buildHiddenSingleRowHint(r, c, val);
      }
    }
  }

  // 4.2 搜尋直行中的隱性唯一
  for (let c = 0; c < 9; c++) {
    for (let val = 1; val <= 9; val++) {
      let possibleRows = [];
      for (let r = 0; r < 9; r++) {
        if (board.getValue(r, c) === 0) {
          const peers = getPeerInfo(r, c);
          if (!peers.has(val) && board.solution[r][c] === val) {
            possibleRows.push(r);
          }
        }
      }
      if (possibleRows.length === 1) {
        const r = possibleRows[0];
        return buildHiddenSingleColHint(r, c, val);
      }
    }
  }

  // 4.3 搜尋九宮格中的隱性唯一
  for (let b = 0; b < 9; b++) {
    const startR = Math.floor(b / 3) * 3;
    const startC = (b % 3) * 3;
    for (let val = 1; val <= 9; val++) {
      let possibleCells = [];
      for (let r = startR; r < startR + 3; r++) {
        for (let c = startC; c < startC + 3; c++) {
          if (board.getValue(r, c) === 0) {
            const peers = getPeerInfo(r, c);
            if (!peers.has(val) && board.solution[r][c] === val) {
              possibleCells.push({ r, c });
            }
          }
        }
      }
      if (possibleCells.length === 1) {
        const target = possibleCells[0];
        return buildHiddenSingleBoxHint(target.r, target.c, val, b);
      }
    }
  }

  // 4.4 搜尋對角線中的隱性唯一 (X-Sudoku)
  if (board.isDiagonal) {
    // Diagonal 1
    for (let val = 1; val <= 9; val++) {
      let possibleIdx = [];
      for (let i = 0; i < 9; i++) {
        if (board.getValue(i, i) === 0) {
          const peers = getPeerInfo(i, i);
          if (!peers.has(val) && board.solution[i][i] === val) {
            possibleIdx.push(i);
          }
        }
      }
      if (possibleIdx.length === 1) {
        const idx = possibleIdx[0];
        return buildHiddenSingleDiagonalHint(idx, idx, val, 1);
      }
    }

    // Diagonal 2
    for (let val = 1; val <= 9; val++) {
      let possibleIdx = [];
      for (let i = 0; i < 9; i++) {
        if (board.getValue(i, 8 - i) === 0) {
          const peers = getPeerInfo(i, 8 - i);
          if (!peers.has(val) && board.solution[i][8 - i] === val) {
            possibleIdx.push(i);
          }
        }
      }
      if (possibleIdx.length === 1) {
        const idx = possibleIdx[0];
        return buildHiddenSingleDiagonalHint(idx, 8 - idx, val, 2);
      }
    }
  }

  // 5. Fallback 備用提示：找一個候選數最少的空格
  let bestCell = null;
  let minCandidates = 10;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board.getValue(r, c) === 0) {
        const peers = getPeerInfo(r, c);
        const candCount = 9 - peers.size;
        if (candCount < minCandidates) {
          minCandidates = candCount;
          bestCell = { r, c, val: board.solution[r][c], peers };
        }
      }
    }
  }

  if (bestCell) {
    const seenVals = Array.from(bestCell.peers.keys()).sort((a, b) => a - b);
    return {
      type: 'fallback_cell',
      row: bestCell.r,
      col: bestCell.c,
      value: bestCell.val,
      stage1: {
        title: '💡 提示 (1/3 範圍提示)',
        message: '觀察第 ' + (bestCell.r + 1) + ' 列與第 ' + (bestCell.c + 1) + ' 行交叉處的儲存格！',
        highlightScope: getRowCells(bestCell.r)
      },
      stage2: {
        title: '🔍 提示 (2/3 邏輯提示)',
        message: '此格同行同列同宮' + (board.isDiagonal ? '與同對角線' : '') + '已出現 ' + seenVals.join(', ') + '，只剩下少數可能，正解為 ' + bestCell.val + '！',
        highlightTarget: { row: bestCell.r, col: bestCell.c },
        relatedCells: Array.from(bestCell.peers.values())
      },
      stage3: {
        fillValue: bestCell.val
      }
    };
  }

  return null;
}

// 產生整列 9 格坐標
function getRowCells(r) {
  const cells = [];
  for (let c = 0; c < 9; c++) cells.push({ row: r, col: c });
  return cells;
}

// 產生整行 9 格坐標
function getColCells(c) {
  const cells = [];
  for (let r = 0; r < 9; r++) cells.push({ row: r, col: c });
  return cells;
}

// 產生九宮格 9 格坐標
function getBoxCells(boxIdx) {
  const startR = Math.floor(boxIdx / 3) * 3;
  const startC = (boxIdx % 3) * 3;
  const cells = [];
  for (let r = startR; r < startR + 3; r++) {
    for (let c = startC; c < startC + 3; c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

// 產生對角線 9 格坐標
function getDiagonalCells(diagType) {
  const cells = [];
  if (diagType === 1) {
    for (let i = 0; i < 9; i++) cells.push({ row: i, col: i });
  } else {
    for (let i = 0; i < 9; i++) cells.push({ row: i, col: 8 - i });
  }
  return cells;
}

// 建構「唯餘解 (Naked Single)」三段式提示
function buildNakedSingleHint(r, c, val, peers, seenVals, isDiagonal = false) {
  return {
    type: 'naked_single',
    row: r,
    col: c,
    value: val,
    stage1: {
      title: '💡 提示 (1/3 範圍提示)',
      message: '第 ' + (r + 1) + ' 列存在一個唯一可填的位置！',
      highlightScope: getRowCells(r)
    },
    stage2: {
      title: '🔍 提示 (2/3 邏輯提示)',
      message: '觀察第 ' + (r + 1) + ' 列第 ' + (c + 1) + ' 格！因為其同行、同列與九宮格' + (isDiagonal && (r === c || r + c === 8) ? '（及對角線）' : '') + '已經包含了 ' + seenVals.join(', ') + '，所以只能填入 ' + val + '！',
      highlightTarget: { row: r, col: c },
      relatedCells: Array.from(peers.values())
    },
    stage3: {
      fillValue: val
    }
  };
}

// 建構「列隱性唯一 (Hidden Single in Row)」三段式提示
function buildHiddenSingleRowHint(r, c, val) {
  return {
    type: 'hidden_single_row',
    row: r,
    col: c,
    value: val,
    stage1: {
      title: '💡 提示 (1/3 範圍提示)',
      message: '第 ' + (r + 1) + ' 列中，有一個數字在整列中只有一個位置能放！',
      highlightScope: getRowCells(r)
    },
    stage2: {
      title: '🔍 提示 (2/3 邏輯提示)',
      message: '在第 ' + (r + 1) + ' 列中，其他空格都因垂直行或九宮格已有 ' + val + ' 而被排除，因此第 ' + (c + 1) + ' 格必定是 ' + val + '！',
      highlightTarget: { row: r, col: c },
      relatedCells: getColCells(c).filter(pos => pos.row !== r)
    },
    stage3: {
      fillValue: val
    }
  };
}

// 建構「行隱性唯一 (Hidden Single in Col)」三段式提示
function buildHiddenSingleColHint(r, c, val) {
  return {
    type: 'hidden_single_col',
    row: r,
    col: c,
    value: val,
    stage1: {
      title: '💡 提示 (1/3 範圍提示)',
      message: '第 ' + (c + 1) + ' 直行中，有一個數字在整行中只有一個位置能放！',
      highlightScope: getColCells(c)
    },
    stage2: {
      title: '🔍 提示 (2/3 邏輯提示)',
      message: '在第 ' + (c + 1) + ' 行中，其他空格都因橫列或九宮格已有 ' + val + ' 而被排除，因此第 ' + (r + 1) + ' 格必定是 ' + val + '！',
      highlightTarget: { row: r, col: c },
      relatedCells: getRowCells(r).filter(pos => pos.col !== c)
    },
    stage3: {
      fillValue: val
    }
  };
}

// 建構「宮隱性唯一 (Hidden Single in Box)」三段式提示
function buildHiddenSingleBoxHint(r, c, val, boxIdx) {
  const boxNames = ['左上', '中上', '右上', '左中', '正中', '右中', '左下', '中下', '右下'];
  const name = boxNames[boxIdx] || ('第 ' + (boxIdx + 1) + ' 個');
  return {
    type: 'hidden_single_box',
    row: r,
    col: c,
    value: val,
    stage1: {
      title: '💡 提示 (1/3 範圍提示)',
      message: name + '九宮格中，有一個數字在該宮內只有一個位置能放！',
      highlightScope: getBoxCells(boxIdx)
    },
    stage2: {
      title: '🔍 提示 (2/3 邏輯提示)',
      message: '在' + name + '九宮格中，其他空格都與周圍衝突，因此第 ' + (r + 1) + ' 列第 ' + (c + 1) + ' 格必定是 ' + val + '！',
      highlightTarget: { row: r, col: c },
      relatedCells: [{ row: r, col: c }]
    },
    stage3: {
      fillValue: val
    }
  };
}

// 建構「對角線隱性唯一 (Hidden Single in Diagonal)」三段式提示
function buildHiddenSingleDiagonalHint(r, c, val, diagType) {
  const name = diagType === 1 ? '主對角線 ↘（左上到右下）' : '次對角線 ↗（右上到左下）';
  return {
    type: 'hidden_single_diagonal',
    row: r,
    col: c,
    value: val,
    stage1: {
      title: '💡 提示 (1/3 範圍提示)',
      message: name + '中，有一個數字在該對角線上只有唯一一個位置能放！',
      highlightScope: getDiagonalCells(diagType)
    },
    stage2: {
      title: '🔍 提示 (2/3 邏輯提示)',
      message: '在' + name + '中，其他空格都因同行同列已有 ' + val + ' 而被排除，因此第 ' + (r + 1) + ' 列第 ' + (c + 1) + ' 格必定是 ' + val + '！',
      highlightTarget: { row: r, col: c },
      relatedCells: [{ row: r, col: c }]
    },
    stage3: {
      fillValue: val
    }
  };
}
