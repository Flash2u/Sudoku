/**
 * Sudoku Generator and Solver Utilities
 * Supports both Standard Sudoku and Diagonal X-Sudoku
 */

// Helper to check if a value can be placed in a cell
function isValid(grid, r, c, val, isDiagonal = false) {
  for (let i = 0; i < 9; i++) {
    if (grid[r][i] === val) return false;
    if (grid[i][c] === val) return false;
    
    const boxRow = 3 * Math.floor(r / 3) + Math.floor(i / 3);
    const boxCol = 3 * Math.floor(c / 3) + i % 3;
    if (grid[boxRow][boxCol] === val) return false;
  }

  // Diagonal X-Sudoku constraints
  if (isDiagonal) {
    // Diagonal 1: Top-Left to Bottom-Right (r === c)
    if (r === c) {
      for (let i = 0; i < 9; i++) {
        if (i !== r && grid[i][i] === val) return false;
      }
    }
    // Diagonal 2: Top-Right to Bottom-Left (r + c === 8)
    if (r + c === 8) {
      for (let i = 0; i < 9; i++) {
        if (i !== r && grid[i][8 - i] === val) return false;
      }
    }
  }

  return true;
}

// Get all possible values for a cell
function getPossibleValues(grid, r, c, isDiagonal = false) {
  const possibilities = [];
  for (let val = 1; val <= 9; val++) {
    if (isValid(grid, r, c, val, isDiagonal)) {
      possibilities.push(val);
    }
  }
  return possibilities;
}

// Shuffle an array (Fisher-Yates)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Fill a grid fully and randomly to generate a complete board
function fillGrid(grid, isDiagonal = false) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (let num of numbers) {
          if (isValid(grid, r, c, num, isDiagonal)) {
            grid[r][c] = num;
            if (fillGrid(grid, isDiagonal)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Checks if a Sudoku board can be solved using ONLY basic logical techniques:
 * 1. Naked Singles (Sole Candidate)
 * 2. Hidden Singles in Rows, Columns, 3x3 Boxes, and Diagonals (if X-Sudoku)
 */
function isBasicSolvable(grid, isDiagonal = false) {
  const g = grid.map(row => [...row]);
  let changed = true;

  while (changed) {
    changed = false;

    // 1. Naked Singles (Only one candidate fits in this cell)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          const cands = getPossibleValues(g, r, c, isDiagonal);
          if (cands.length === 1) {
            g[r][c] = cands[0];
            changed = true;
          }
        }
      }
    }

    if (changed) continue;

    // 2. Hidden Singles in Rows (Candidate only fits in one cell in this row)
    for (let r = 0; r < 9; r++) {
      for (let val = 1; val <= 9; val++) {
        let possibleCols = [];
        let alreadyInRow = false;
        for (let c = 0; c < 9; c++) {
          if (g[r][c] === val) {
            alreadyInRow = true;
            break;
          }
          if (g[r][c] === 0 && isValid(g, r, c, val, isDiagonal)) {
            possibleCols.push(c);
          }
        }
        if (!alreadyInRow && possibleCols.length === 1) {
          g[r][possibleCols[0]] = val;
          changed = true;
        }
      }
    }

    if (changed) continue;

    // 3. Hidden Singles in Columns (Candidate only fits in one cell in this column)
    for (let c = 0; c < 9; c++) {
      for (let val = 1; val <= 9; val++) {
        let possibleRows = [];
        let alreadyInCol = false;
        for (let r = 0; r < 9; r++) {
          if (g[r][c] === val) {
            alreadyInCol = true;
            break;
          }
          if (g[r][c] === 0 && isValid(g, r, c, val, isDiagonal)) {
            possibleRows.push(r);
          }
        }
        if (!alreadyInCol && possibleRows.length === 1) {
          g[possibleRows[0]][c] = val;
          changed = true;
        }
      }
    }

    if (changed) continue;

    // 4. Hidden Singles in 3x3 Boxes (Candidate only fits in one cell in this box)
    for (let b = 0; b < 9; b++) {
      const startRow = 3 * Math.floor(b / 3);
      const startCol = 3 * (b % 3);
      for (let val = 1; val <= 9; val++) {
        let possibleCells = [];
        let alreadyInBox = false;
        for (let r = startRow; r < startRow + 3; r++) {
          for (let c = startCol; c < startCol + 3; c++) {
            if (g[r][c] === val) {
              alreadyInBox = true;
              break;
            }
            if (g[r][c] === 0 && isValid(g, r, c, val, isDiagonal)) {
              possibleCells.push({ r, c });
            }
          }
          if (alreadyInBox) break;
        }
        if (!alreadyInBox && possibleCells.length === 1) {
          const { r, c } = possibleCells[0];
          g[r][c] = val;
          changed = true;
        }
      }
    }

    if (changed) continue;

    // 5. Hidden Singles in Diagonals (X-Sudoku)
    if (isDiagonal) {
      // Diagonal 1: Top-Left to Bottom-Right (r === c)
      for (let val = 1; val <= 9; val++) {
        let possibleDiag1 = [];
        let alreadyInDiag1 = false;
        for (let i = 0; i < 9; i++) {
          if (g[i][i] === val) {
            alreadyInDiag1 = true;
            break;
          }
          if (g[i][i] === 0 && isValid(g, i, i, val, true)) {
            possibleDiag1.push(i);
          }
        }
        if (!alreadyInDiag1 && possibleDiag1.length === 1) {
          const idx = possibleDiag1[0];
          g[idx][idx] = val;
          changed = true;
        }
      }

      if (changed) continue;

      // Diagonal 2: Top-Right to Bottom-Left (r + c === 8)
      for (let val = 1; val <= 9; val++) {
        let possibleDiag2 = [];
        let alreadyInDiag2 = false;
        for (let i = 0; i < 9; i++) {
          if (g[i][8 - i] === val) {
            alreadyInDiag2 = true;
            break;
          }
          if (g[i][8 - i] === 0 && isValid(g, i, 8 - i, val, true)) {
            possibleDiag2.push(i);
          }
        }
        if (!alreadyInDiag2 && possibleDiag2.length === 1) {
          const idx = possibleDiag2[0];
          g[idx][8 - idx] = val;
          changed = true;
        }
      }
    }
  }

  // Check if fully solved
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (g[r][c] === 0) return false;
    }
  }
  return true;
}

// Efficient solver that counts solutions (caps at 2 to avoid extra search)
function countSolutions(grid, limit = 2, isDiagonal = false) {
  let solutionsCount = 0;

  function backtrack(g) {
    if (solutionsCount >= limit) return;

    // Find the cell with the fewest possibilities (Minimum Remaining Values heuristic)
    let minPoss = 10;
    let bestRow = -1;
    let bestCol = -1;
    let bestVals = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          const vals = getPossibleValues(g, r, c, isDiagonal);
          if (vals.length < minPoss) {
            minPoss = vals.length;
            bestRow = r;
            bestCol = c;
            bestVals = vals;
          }
        }
      }
    }

    // If no empty cells, we found a solution
    if (bestRow === -1) {
      solutionsCount++;
      return;
    }

    if (minPoss === 0) return; // Dead end

    for (let val of bestVals) {
      g[bestRow][bestCol] = val;
      backtrack(g);
      g[bestRow][bestCol] = 0;
      if (solutionsCount >= limit) return;
    }
  }

  const gridCopy = grid.map(row => [...row]);
  backtrack(gridCopy);
  return solutionsCount;
}

/**
 * Generates a Sudoku board and its corresponding solution.
 * Difficulty mappings:
 * - 'easy': 38-42 clues (guaranteed solvable with basic logic)
 * - 'medium': 32-35 clues (guaranteed solvable with basic logic, fewer clues)
 * - 'hard': 26-29 clues (guaranteed unique solution, requires advanced logical techniques)
 * - 'expert': 21-24 clues (guaranteed unique solution, highly demanding)
 */
export function generateSudoku(difficulty = 'medium', isDiagonal = false) {
  // 1. Create a blank board
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  
  // 2. Fill it completely
  fillGrid(solution, isDiagonal);

  // 3. Clone solution to create the puzzle board
  const puzzle = solution.map(row => [...row]);

  // 4. Determine how many cells to attempt to remove
  let targetClues = 35;
  if (difficulty === 'easy') targetClues = 40;
  else if (difficulty === 'medium') targetClues = 33;
  else if (difficulty === 'hard') targetClues = 27;
  else if (difficulty === 'expert') targetClues = 22;

  // Create a list of all 81 positions and shuffle them
  const positions = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  shuffle(positions);

  let cluesCount = 81;

  // 5. Try removing numbers one by one, verifying uniqueness & solvability
  for (let i = 0; i < positions.length; i++) {
    if (cluesCount <= targetClues) break;

    const [r, c] = positions[i];
    const backup = puzzle[r][c];
    
    // Temporarily remove
    puzzle[r][c] = 0;

    // Check if the puzzle remains appropriate for the difficulty level
    let keepRemoved = false;
    if (difficulty === 'easy' || difficulty === 'medium') {
      keepRemoved = isBasicSolvable(puzzle, isDiagonal);
    } else {
      keepRemoved = countSolutions(puzzle, 2, isDiagonal) === 1;
    }

    if (keepRemoved) {
      cluesCount--;
    } else {
      // If not solvable/unique, restore
      puzzle[r][c] = backup;
    }
  }

  return {
    puzzle,
    solution,
    isDiagonal
  };
}

/**
 * Solves a Sudoku puzzle and returns the solved grid, or null if unsolvable.
 */
export function solveSudoku(grid, isDiagonal = false) {
  let solvedGrid = null;

  function backtrack(g) {
    let minPoss = 10;
    let bestRow = -1;
    let bestCol = -1;
    let bestVals = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          const vals = getPossibleValues(g, r, c, isDiagonal);
          if (vals.length < minPoss) {
            minPoss = vals.length;
            bestRow = r;
            bestCol = c;
            bestVals = vals;
          }
        }
      }
    }

    if (bestRow === -1) {
      solvedGrid = g.map(row => [...row]);
      return true;
    }

    if (minPoss === 0) return false;

    for (let val of bestVals) {
      g[bestRow][bestCol] = val;
      if (backtrack(g)) return true;
      g[bestRow][bestCol] = 0;
    }
    return false;
  }

  const gridCopy = grid.map(row => [...row]);
  backtrack(gridCopy);
  return solvedGrid;
}
