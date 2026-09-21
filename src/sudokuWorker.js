import { generateSudoku } from './sudokuGenerator.js';

self.onmessage = function (e) {
  const { difficulty, isDiagonal = false } = e.data;
  try {
    const result = generateSudoku(difficulty, isDiagonal);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
