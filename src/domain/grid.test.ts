import { describe, expect,it } from 'vitest';

import { extractWordsFromGrid, validateGrid } from './grid';
import { GridCell } from './types';

describe('grid logic', () => {
    const emptyCell: GridCell = { type: 'empty', char: null };
    const blockCell: GridCell = { type: 'block', char: null };

    it('should extract horizontal words', () => {
        const grid: GridCell[] = [
            { type: 'empty', char: '1' }, { type: 'empty', char: '+' }, { type: 'empty', char: '2' }, { type: 'empty', char: '=' }, { type: 'empty', char: '3' },
            blockCell, blockCell, blockCell, blockCell, blockCell
        ];
        const words = extractWordsFromGrid(grid, 5);
        expect(words).toContain('1+2=3');
    });

    it('should extract vertical words', () => {
        const grid: GridCell[] = [
            { type: 'empty', char: '1' }, blockCell,
            { type: 'empty', char: '+' }, blockCell,
            { type: 'empty', char: '2' }, blockCell,
            { type: 'empty', char: '=' }, blockCell,
            { type: 'empty', char: '3' }, blockCell,
        ];
        const words = extractWordsFromGrid(grid, 2);
        expect(words).toContain('1+2=3');
    });

    it('should validate a correct grid', () => {
        const grid: GridCell[] = [
            { type: 'empty', char: '1' }, { type: 'empty', char: '+' }, { type: 'empty', char: '2' }, { type: 'empty', char: '=' }, { type: 'empty', char: '3' },
        ];
        const result = validateGrid(grid, 5);
        expect(result.valid).toBe(true);
    });

    it('should fail an empty grid', () => {
        const grid: GridCell[] = [emptyCell, emptyCell];
        const result = validateGrid(grid, 2);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('No statements formed.');
    });

    it('should fail a grid with an invalid equation', () => {
        const grid: GridCell[] = [
            { type: 'empty', char: '1' }, { type: 'empty', char: '+' }, { type: 'empty', char: '1' }, { type: 'empty', char: '=' }, { type: 'empty', char: '3' },
        ];
        const result = validateGrid(grid, 5);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Mathematically false');
    });
});
