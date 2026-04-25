import { describe, it, expect } from 'vitest';
import { generateGame, validateBoard } from './board';

describe('board service', () => {
	it('should generate a playable game', () => {
		const game = generateGame(1, 'Easy');
		expect(game.status).toBe('playing');
		expect(Object.keys(game.board).length).toBeGreaterThan(0);
		expect(game.bank.length).toBeGreaterThan(0);
	});

	it('should validate a correct board', () => {
		// A simple 2+3=5 horizontal board
		const board = {
			'0,0': { id: '1', val: '2', type: 'val' as const, isGiven: true },
			'0,1': { id: '2', val: '+', type: 'op' as const, isGiven: true },
			'0,2': { id: '3', val: '3', type: 'val' as const, isGiven: true },
			'0,3': { id: '4', val: '=', type: 'rel' as const, isGiven: true },
			'0,4': { id: '5', val: '5', type: 'val' as const, isGiven: true },
		};
		expect(validateBoard(board).valid).toBe(true);
	});

	it('should invalidate an incorrect board', () => {
		const board = {
			'0,0': { id: '1', val: '2', type: 'val' as const, isGiven: true },
			'0,1': { id: '2', val: '+', type: 'op' as const, isGiven: true },
			'0,2': { id: '3', val: '3', type: 'val' as const, isGiven: true },
			'0,3': { id: '4', val: '=', type: 'rel' as const, isGiven: true },
			'0,4': { id: '6', val: '6', type: 'val' as const, isGiven: true },
		};
		expect(validateBoard(board).valid).toBe(false);
	});

	it('should invalidate a disconnected board', () => {
		const board = {
			'0,0': { id: '1', val: '2', type: 'val' as const, isGiven: true },
			'0,1': { id: '2', val: '=', type: 'rel' as const, isGiven: true },
			'0,2': { id: '3', val: '2', type: 'val' as const, isGiven: true },
			'5,5': { id: '4', val: '1', type: 'val' as const, isGiven: true },
			'5,6': { id: '5', val: '=', type: 'rel' as const, isGiven: true },
			'5,7': { id: '6', val: '1', type: 'val' as const, isGiven: true },
		};
		const result = validateBoard(board);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('connected');
	});
});
