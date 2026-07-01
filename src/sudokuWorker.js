import { generateSudoku } from './sudokuGenerator.js';

self.onmessage = function (e) {
  const { difficulty } = e.data;
  try {
    const result = generateSudoku(difficulty);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
