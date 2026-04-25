import { describe, it, expect } from 'vitest';
import { evaluateExpression, getHashSeed, mulberry32, generateValidStatement } from './math';

describe('math service', () => {
	it('should generate consistent hashes', () => {
		expect(getHashSeed('test')).toBe(getHashSeed('test'));
		expect(getHashSeed('test')).not.toBe(getHashSeed('other'));
	});

	it('should produce deterministic random numbers with mulberry32', () => {
		const prng1 = mulberry32(12345);
		const prng2 = mulberry32(12345);
		expect(prng1()).toBe(prng2());
		expect(prng1()).toBe(prng2());
	});

	it('should evaluate simple expressions correctly', () => {
		expect(evaluateExpression('2+3')).toBe(5);
		expect(evaluateExpression('10-4')).toBe(6);
		expect(evaluateExpression('3*4')).toBe(12);
		expect(evaluateExpression('12/3')).toBe(4);
	});

	it('should respect operator precedence', () => {
		expect(evaluateExpression('2+3*4')).toBe(14);
		expect(evaluateExpression('10-4/2')).toBe(8);
	});

	it('should return null for invalid expressions', () => {
		expect(evaluateExpression('2++3')).toBeNull();
		expect(evaluateExpression('2+')).toBeNull();
		expect(evaluateExpression('+2')).toBeNull();
		expect(evaluateExpression('2/0')).toBeNull();
		expect(evaluateExpression('7/3')).toBeNull(); // Only integer division
		expect(evaluateExpression('01+2')).toBeNull(); // No leading zeros
	});

	it('should generate valid statements', () => {
		const prng = mulberry32(99);
		for (let i = 0; i < 20; i++) {
			const tokens = generateValidStatement(prng);
			expect(tokens.length).toBeGreaterThanOrEqual(5);
			expect(tokens.length).toBeLessThanOrEqual(10);
		}
	});
});
