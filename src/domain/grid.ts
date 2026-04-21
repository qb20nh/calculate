import { GridCell, ValidationResult } from './types';
import { isValidEquation } from './engine';

export const extractWordsFromGrid = (grid: GridCell[], cols: number): string[] => {
    let rows = grid.length / cols;
    let words: string[] = [];

    // Horizontal
    for (let r = 0; r < rows; r++) {
        let currentStr = "";
        for (let c = 0; c < cols; c++) {
            let cell = grid[r * cols + c];
            if (cell.type !== 'block' && cell.char) {
                currentStr += cell.char;
            } else {
                if (currentStr.length > 1) words.push(currentStr);
                currentStr = "";
            }
        }
        if (currentStr.length > 1) words.push(currentStr);
    }

    // Vertical
    for (let c = 0; c < cols; c++) {
        let currentStr = "";
        for (let r = 0; r < rows; r++) {
            let cell = grid[r * cols + c];
            if (cell.type !== 'block' && cell.char) {
                currentStr += cell.char;
            } else {
                if (currentStr.length > 1) words.push(currentStr);
                currentStr = "";
            }
        }
        if (currentStr.length > 1) words.push(currentStr);
    }

    return words;
};

export const validateGrid = (grid: GridCell[], cols: number): ValidationResult => {
    const words = extractWordsFromGrid(grid, cols);
    
    if (words.length === 0) {
        return { valid: false, reason: "No statements formed." };
    }

    for (let word of words) {
        const res = isValidEquation(word);
        if (!res.valid) return res;
    }

    return { valid: true };
};
