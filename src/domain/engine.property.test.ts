import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { getGroupedTiles, getNormalizedRelations, isValidEquation, normalizeExpr } from './engine';
import { TileItem } from './types';

describe('engine.ts (property-based)', () => {
  describe('normalizeExpr', () => {
    it('should be idempotent', () => {
      fc.assert(
        fc.property(fc.string(), (expr) => {
          const first = normalizeExpr(expr);
          const second = normalizeExpr(first);
          expect(first).toBe(second);
        })
      );
    });

    it('should result in the same value for simple commutative additions', () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer(), (a, b) => {
          const expr1 = `${a}+${b}`;
          const expr2 = `${b}+${a}`;
          expect(normalizeExpr(expr1)).toBe(normalizeExpr(expr2));
        })
      );
    });
  });

  describe('isValidEquation', () => {
    it('should never throw an unhandled exception for any string input', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          try {
            isValidEquation(input);
            return true;
          } catch {
            console.error('Failed with input:', input);
            return false;
          }
        })
      );
    });

    it('should fail for strings with leading zeros in any expression', () => {
      const leadingZeroDigit = fc.integer({ min: 0, max: 9 }).map(String);
      const otherDigits = fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1 }).map(arr => arr.join(''));
      const leadingZeroNumber = fc.tuple(leadingZeroDigit, otherDigits).map(([_z, rest]) => `0${rest}`);

      fc.assert(
        fc.property(leadingZeroNumber, (num) => {
          const equation = `${num}+1=2`;
          const result = isValidEquation(equation);
          return !result.valid && result.reason === "Leading zeros not allowed.";
        })
      );
    });

    it('should fail for expressions with double operators (except those JS allows like ++ or +-) if we want strictness', () => {
      const opArb = fc.constantFrom('+', '−', '×', '÷');
      const doubleOpArb = fc.tuple(opArb, opArb).map(([o1, o2]) => `1${o1}${o2}1=2`);

      fc.assert(
        fc.property(doubleOpArb, (equation) => {
          const result = isValidEquation(equation);
          // If it's valid, it means our engine is too lenient (using JS eval)
          // For this test, we want to see if we can catch these "leaky" abstractions
          if (result.valid) return false;

          return !result.valid;
        })
      );
    });
  });

  describe('getNormalizedRelations', () => {
    it('should produce the same relations for "a=b" and "b=a"', () => {
      // Use alphanumeric strings without comparators to avoid complex parsing issues
      const partArb = fc.string({ minLength: 1 }).filter(s => !/[=<>!]/.test(s));

      fc.assert(
        fc.property(partArb, partArb, (a, b) => {
          const res1 = getNormalizedRelations(`${a}=${b}`);
          const res2 = getNormalizedRelations(`${b}=${a}`);
          expect(res1).toEqual(res2);
        })
      );
    });

    it('should produce consistent relations for "a<b" and "b>a"', () => {
      const partArb = fc.string({ minLength: 1 }).filter(s => !/[=<>!]/.test(s));

      fc.assert(
        fc.property(partArb, partArb, (a, b) => {
          const res1 = getNormalizedRelations(`${a}<${b}`);
          const res2 = getNormalizedRelations(`${b}>${a}`);
          expect(res1).toEqual(res2);
        })
      );
    });
  });

  describe('getGroupedTiles', () => {
    it('should preserve total count and character set', () => {
      const tileArb: fc.Arbitrary<TileItem> = fc.record({
        char: fc.string({ minLength: 1, maxLength: 1 }),
        id: fc.integer(),
        status: fc.constant('normal' as const)
      });

      fc.assert(
        fc.property(fc.array(tileArb), (tiles) => {
          const grouped = getGroupedTiles(tiles);

          const totalInGrouped = grouped.reduce((sum, g) => sum + g.count, 0);
          expect(totalInGrouped).toBe(tiles.length);

          const uniqueCharsInInput = new Set(tiles.map(t => t.char));
          expect(grouped.length).toBe(uniqueCharsInInput.size);
        })
      );
    });
  });
});
