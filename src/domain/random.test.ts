import { describe, expect,it } from 'vitest';

import { getRandomInt,seededRandom, setSeed } from './random';

describe('random utilities', () => {
    it('should be deterministic with the same seed', () => {
        setSeed(123);
        const val1 = seededRandom();
        setSeed(123);
        const val2 = seededRandom();
        expect(val1).toBe(val2);
    });

    it('should produce different values with different seeds', () => {
        setSeed(1);
        const val1 = seededRandom();
        setSeed(2);
        const val2 = seededRandom();
        expect(val1).not.toBe(val2);
    });

    it('should return integers within range', () => {
        setSeed(456);
        for (let i = 0; i < 100; i++) {
            const val = getRandomInt(5, 10);
            expect(val).toBeGreaterThanOrEqual(5);
            expect(val).toBeLessThanOrEqual(10);
            expect(Number.isInteger(val)).toBe(true);
        }
    });
});
