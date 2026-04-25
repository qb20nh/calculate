import { useProgressBar } from "@/hooks/useProgressBar";
import { act, renderHook } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useProgressBar", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should handle basic loading lifecycle", () => {
		const { result, rerender } = renderHook(({ isLoading }) => useProgressBar({ isLoading }), {
			initialProps: { isLoading: true },
		});

		// Coordination timer (setTimeout 0)
		act(() => {
			vi.runOnlyPendingTimers();
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
			vi.runOnlyPendingTimers();
		});

		expect(result.current.progress).toBe(100);

		expect(result.current.isFading).toBe(true);

		// Final visibility reset after transition
		act(() => {
			vi.runAllTimers();
		});
		expect(result.current.isVisible).toBe(false);
	});

	it("should handle rapid reset", () => {
		const { result, rerender } = renderHook(({ isLoading }) => useProgressBar({ isLoading }), {
			initialProps: { isLoading: false },
		});

		expect(result.current.isVisible).toBe(false);

		// Start loading
		rerender({ isLoading: true });

		// Coordination timer
		act(() => {
			vi.runOnlyPendingTimers();
		});

		expect(result.current.isVisible).toBe(true);
		expect(result.current.progress).toBeGreaterThan(0);
	});

	it("should handle already 100% progress when not loading", () => {
		const { result } = renderHook(() => useProgressBar({ isLoading: false }));

		// It should stay invisible
		expect(result.current.isVisible).toBe(false);
	});
});
