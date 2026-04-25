import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useProgressBar } from './useProgressBar';

describe('useProgressBar', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should handle basic loading lifecycle', () => {
		const { result, rerender } = renderHook(({ isLoading }) => useProgressBar({ isLoading }), {
			initialProps: { isLoading: true },
		});

		// Coordination timer (setTimeout 0)
		act(() => {
			vi.advanceTimersByTime(0);
		});

		expect(result.current.isVisible).toBe(true);
		expect(result.current.progress).toBe(20);

		// Advance time to trickle
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current.progress).toBeGreaterThan(20);

		// Stop loading
		rerender({ isLoading: false });
		
		// Coordination timer
		act(() => {
			vi.advanceTimersByTime(0);
		});
		
		expect(result.current.progress).toBe(100);

		// Advance time for fade out
		act(() => {
			vi.advanceTimersByTime(transitionMs);
		});
		expect(result.current.isFading).toBe(true);

		// Final visibility reset
		act(() => {
			vi.advanceTimersByTime(transitionMs);
		});
		expect(result.current.isVisible).toBe(false);
	});

	it('should handle rapid reset', () => {
		const { result, rerender } = renderHook(({ isLoading }) => useProgressBar({ isLoading }), {
			initialProps: { isLoading: false },
		});

		expect(result.current.isVisible).toBe(false);

		// Start loading
		rerender({ isLoading: true });
		
		// Coordination timer
		act(() => {
			vi.advanceTimersByTime(0);
		});
		
		expect(result.current.isVisible).toBe(true);
		expect(result.current.progress).toBeGreaterThan(0);
	});
});
