import { describe, it, expect } from 'vitest';
import { isValidEquation, normalizeExpr, getNormalizedRelations, getGroupedTiles } from './engine';

describe('isValidEquation', () => {
    it('should validate a simple correct equation', () => {
        const result = isValidEquation('1+2=3');
        expect(result.valid).toBe(true);
    });

    it('should fail an equation with no operator on either side', () => {
        const result = isValidEquation('3=3');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('neither side of \'=\' contains an operator');
    });

    it('should fail an invalid mathematical result', () => {
        const result = isValidEquation('1+1=3');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Mathematically false');
    });

    it('should validate chained comparators', () => {
        const result = isValidEquation('1+2=3<4+5');
        expect(result.valid).toBe(true);
    });

    it('should fail if any part of a chain is false', () => {
        expect(isValidEquation('1+2=3<2+1').valid).toBe(false);
        expect(isValidEquation('5>2+1=4').valid).toBe(false);
        expect(isValidEquation('1+1<>2').valid).toBe(false);
    });

    it('should support not equal operator', () => {
        const result = isValidEquation('1+1<>3');
        expect(result.valid).toBe(true);
    });

    it('should fail leading zeros', () => {
        const result = isValidEquation('01+2=3');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Leading zeros not allowed.');
    });

    it('should fail misplaced comparators', () => {
        expect(isValidEquation('1+=2').valid).toBe(false);
        expect(isValidEquation('=1+2=3').valid).toBe(false);
        expect(isValidEquation('1==2').valid).toBe(false);
    });

    it('should fail syntax errors', () => {
        expect(isValidEquation('1++1=2').valid).toBe(false);
        expect(isValidEquation('1+*1=2').valid).toBe(false);
    });

    it('should fail infinite values', () => {
        expect(isValidEquation('1/0=1').valid).toBe(false);
    });
});

describe('normalizeExpr', () => {
    it('should normalize commutative addition and multiplication', () => {
        expect(normalizeExpr('3+2')).toBe('2+3');
        expect(normalizeExpr('2×5+1')).toBe('1+2×5');
        expect(normalizeExpr('b×a+c')).toBe('a×b+c');
    });
});

describe('getNormalizedRelations', () => {
    it('should normalize relations for comparison', () => {
        const rels = getNormalizedRelations('1+2=3');
        expect(rels).toEqual(['1+2=3']);
    });

    it('should handle not equal relations', () => {
        const rels = getNormalizedRelations('3<>1+1');
        expect(rels).toEqual(['1+1<>3']);
    });

    it('should flip greater than to less than', () => {
        const rels = getNormalizedRelations('5>2+1');
        expect(rels).toEqual(['1+2<5']);
    });

    it('should handle chained relations', () => {
        const rels = getNormalizedRelations('1+2=3<4');
        expect(rels).toContain('1+2=3');
        expect(rels).toContain('3<4');
    });
});

describe('getGroupedTiles', () => {
    it('should group tiles and sort them by SORT_ORDER', () => {
        const tiles = [
            { id: 1, char: '2' },
            { id: 2, char: '+' },
            { id: 3, char: '2' },
            { id: 4, char: '1' }
        ];
        const grouped = getGroupedTiles(tiles);
        expect(grouped).toEqual([
            { char: '1', count: 1 },
            { char: '2', count: 2 },
            { char: '+', count: 1 }
        ]);
    });
});
