/**
 * Sudoku Board State Manager
 */

export class Board {
  constructor(puzzle, solution, difficulty) {
    this.difficulty = difficulty;
    // Initial clue board (0 = empty, 1-9 = clues)
    this.initialBoard = puzzle.map(row => [...row]);
    
    // Current state of cells (0 = empty, 1-9 = current values)
    this.currentBoard = puzzle.map(row => [...row]);
    
    // Notes/Pencil marks for each cell: 9x9 grid of arrays/Sets
    this.notes = Array.from({ length: 9 }, () => 
      Array.from({ length: 9 }, () => new Set())
    );
    
    // Solved puzzle
    this.solution = solution.map(row => [...row]);
    
    // History stacks for Undo / Redo
    this.history = [];
    this.redoHistory = [];
  }

  // Check if cell is an initial clue (read-only)
  isClue(row, col) {
    return this.initialBoard[row][col] !== 0;
  }

  // Get cell value
  getValue(row, col) {
    return this.currentBoard[row][col];
  }

  // Get notes for a cell
  getNotes(row, col) {
    return this.notes[row][col];
  }

  // Set cell value (with undo support)
  setCellValue(row, col, val, autoClearNotes = true) {
    if (this.isClue(row, col)) return false;
    
    const prevVal = this.currentBoard[row][col];
    const prevNotes = new Set(this.notes[row][col]);
    
    if (prevVal === val) return false; // No change

    this.pushHistory({
      type: 'value',
      row,
      col,
      prevVal,
      newVal: val,
      prevNotes
    });

    this.currentBoard[row][col] = val;
    // Clear notes when cell is filled
    if (val !== 0) {
      this.notes[row][col].clear();
      
      // Auto-clear notes in same row, column, and box
      if (autoClearNotes) {
        this.clearRelatedNotes(row, col, val);
      }
    }

    return true;
  }

  // Toggle notes (pencil marks)
  toggleNote(row, col, val) {
    if (this.isClue(row, col) || this.currentBoard[row][col] !== 0) return false;

    const prevNotes = new Set(this.notes[row][col]);
    const nextNotes = new Set(this.notes[row][col]);

    if (nextNotes.has(val)) {
      nextNotes.delete(val);
    } else {
      nextNotes.add(val);
    }

    this.pushHistory({
      type: 'notes',
      row,
      col,
      prevNotes,
      newNotes: nextNotes
    });

    this.notes[row][col] = nextNotes;
    return true;
  }

  // Clear value and/or notes
  clearCell(row, col) {
    if (this.isClue(row, col)) return false;

    const prevVal = this.currentBoard[row][col];
    const prevNotes = new Set(this.notes[row][col]);

    if (prevVal === 0 && prevNotes.size === 0) return false; // Already empty

    this.pushHistory({
      type: 'clear',
      row,
      col,
      prevVal,
      prevNotes
    });

    this.currentBoard[row][col] = 0;
    this.notes[row][col].clear();
    return true;
  }

  // Clear candidate note in row, col, and box
  clearRelatedNotes(row, col, val) {
    const affected = [];

    // Row & Col
    for (let i = 0; i < 9; i++) {
      if (i !== col && this.notes[row][i].has(val)) {
        this.notes[row][i].delete(val);
        affected.push({ row, col: i });
      }
      if (i !== row && this.notes[i][col].has(val)) {
        this.notes[i][col].delete(val);
        affected.push({ row: i, col });
      }
    }

    // 3x3 Box
    const startRow = 3 * Math.floor(row / 3);
    const startCol = 3 * Math.floor(col / 3);
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        if ((r !== row || c !== col) && this.notes[r][c].has(val)) {
          this.notes[r][c].delete(val);
          affected.push({ row: r, col: c });
        }
      }
    }

    // Add notes cleanup info to last history state if it was a value change
    if (this.history.length > 0 && affected.length > 0) {
      const lastState = this.history[this.history.length - 1];
      if (lastState.row === row && lastState.col === col && lastState.newVal === val) {
        lastState.notesCleared = affected.map(pos => ({
          row: pos.row,
          col: pos.col,
          val
        }));
      }
    }
  }

  // History management
  pushHistory(state) {
    this.history.push(state);
    this.redoHistory = []; // Clear redo stack on new action
  }

  undo() {
    if (this.history.length === 0) return false;

    const action = this.history.pop();
    const redoState = { ...action };

    // Apply inverse
    if (action.type === 'value') {
      this.currentBoard[action.row][action.col] = action.prevVal;
      this.notes[action.row][action.col] = new Set(action.prevNotes);
      
      // Restore cleared notes in other cells
      if (action.notesCleared) {
        for (let note of action.notesCleared) {
          this.notes[note.row][note.col].add(note.val);
        }
      }
    } else if (action.type === 'notes') {
      this.notes[action.row][action.col] = new Set(action.prevNotes);
    } else if (action.type === 'clear') {
      this.currentBoard[action.row][action.col] = action.prevVal;
      this.notes[action.row][action.col] = new Set(action.prevNotes);
    }

    this.redoHistory.push(redoState);
    return true;
  }

  redo() {
    if (this.redoHistory.length === 0) return false;

    const action = this.redoHistory.pop();
    
    // Apply forward action
    if (action.type === 'value') {
      this.currentBoard[action.row][action.col] = action.newVal;
      this.notes[action.row][action.col].clear();
      
      // Re-clear notes in other cells
      if (action.notesCleared) {
        for (let note of action.notesCleared) {
          this.notes[note.row][note.col].delete(note.val);
        }
      }
    } else if (action.type === 'notes') {
      this.notes[action.row][action.col] = new Set(action.newNotes);
    } else if (action.type === 'clear') {
      this.currentBoard[action.row][action.col] = 0;
      this.notes[action.row][action.col].clear();
    }

    this.history.push(action);
    return true;
  }

  // Check if grid conflicts with other cells in row, col, or box
  hasConflict(row, col, val) {
    if (val === 0) return false;

    // Check Row
    for (let c = 0; c < 9; c++) {
      if (c !== col && this.currentBoard[row][c] === val) return true;
    }

    // Check Column
    for (let r = 0; r < 9; r++) {
      if (r !== row && this.currentBoard[r][col] === val) return true;
    }

    // Check 3x3 Box
    const startRow = 3 * Math.floor(row / 3);
    const startCol = 3 * Math.floor(col / 3);
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        if ((r !== row || c !== col) && this.currentBoard[r][c] === val) return true;
      }
    }

    return false;
  }

  // Returns whether cell value matches solution (can be used for hints or error checks)
  isCorrect(row, col) {
    const val = this.currentBoard[row][col];
    return val === 0 || val === this.solution[row][col];
  }

  // Check if game is completed and fully correct
  checkWin() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] !== this.solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  }

  // Count how many times each number 1-9 is placed on the board
  getNumberCounts() {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentBoard[r][c];
        if (val !== 0) {
          counts[val]++;
        }
      }
    }
    return counts;
  }

  // Count how many times each number 1-9 is CORRECTLY placed on the board
  getCorrectNumberCounts() {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentBoard[r][c];
        if (val !== 0 && val === this.solution[r][c]) {
          counts[val]++;
        }
      }
    }
    return counts;
  }

  // Get all valid candidates (1-9) for a cell based on current board state
  getValidCandidates(row, col) {
    if (this.currentBoard[row][col] !== 0) return [];

    const used = new Set();

    // Row
    for (let c = 0; c < 9; c++) {
      const val = this.currentBoard[row][c];
      if (val !== 0) used.add(val);
    }

    // Col
    for (let r = 0; r < 9; r++) {
      const val = this.currentBoard[r][col];
      if (val !== 0) used.add(val);
    }

    // Box
    const startRow = 3 * Math.floor(row / 3);
    const startCol = 3 * Math.floor(col / 3);
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        const val = this.currentBoard[r][c];
        if (val !== 0) used.add(val);
      }
    }

    const candidates = [];
    for (let v = 1; v <= 9; v++) {
      if (!used.has(v)) {
        candidates.push(v);
      }
    }
    return candidates;
  }

  // Populate auto notes for all empty cells
  populateAllAutoNotes() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] === 0) {
          const candidates = this.getValidCandidates(r, c);
          this.notes[r][c] = new Set(candidates);
        } else {
          this.notes[r][c].clear();
        }
      }
    }
  }

  // Serialize board state for storage
  serialize() {
    return {
      difficulty: this.difficulty,
      initialBoard: this.initialBoard,
      currentBoard: this.currentBoard,
      notes: this.notes.map(row => row.map(set => Array.from(set))),
      solution: this.solution,
      history: this.history.map(action => ({
        ...action,
        prevNotes: Array.from(action.prevNotes || []),
        newNotes: action.newNotes ? Array.from(action.newNotes) : undefined
      })),
      redoHistory: this.redoHistory.map(action => ({
        ...action,
        prevNotes: Array.from(action.prevNotes || []),
        newNotes: action.newNotes ? Array.from(action.newNotes) : undefined
      }))
    };
  }

  // Reconstruct board state from serialized format
  static deserialize(data) {
    const board = new Board(data.initialBoard, data.solution, data.difficulty);
    board.currentBoard = data.currentBoard.map(row => [...row]);
    board.notes = data.notes.map(row => row.map(arr => new Set(arr)));
    board.history = data.history.map(action => ({
      ...action,
      prevNotes: new Set(action.prevNotes || []),
      newNotes: action.newNotes ? new Set(action.newNotes) : undefined
    }));
    board.redoHistory = data.redoHistory.map(action => ({
      ...action,
      prevNotes: new Set(action.prevNotes || []),
      newNotes: action.newNotes ? new Set(action.newNotes) : undefined
    }));
    return board;
  }
}
