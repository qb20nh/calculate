import { act, renderHook } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProgressBar } from "@/hooks/useProgressBar";

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

  it("should stay idle when loading never starts", () => {
    const { result } = renderHook(() => useProgressBar({ isLoading: false }));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current.progress).toBe(0);
    expect(result.current.isVisible).toBe(false);
  });

  it("should stop trickle progress at 90% and not reset to 20 when already in progress", () => {
    const { result, rerender } = renderHook(({ isLoading }) => useProgressBar({ isLoading }), {
      initialProps: { isLoading: true },
    });

    // Kick off coordination timer → progress jumps to 20
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(result.current.progress).toBe(20);

    // Advance many trickle intervals to push progress toward 90
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current.progress).toBeGreaterThanOrEqual(80);

    // Complete loading and fully reset
    rerender({ isLoading: false });
    act(() => {
      vi.runAllTimers();
    });

    // Start loading again — progress resets to 0 then jumps to 20 via the prev===0 branch
    rerender({ isLoading: true });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(result.current.progress).toBe(20);
  });

  it("should keep progress when loading restarts during fade out", () => {
    const { result, rerender } = renderHook(({ isLoading }) => useProgressBar({ isLoading }), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(result.current.progress).toBe(20);

    rerender({ isLoading: false });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(result.current.progress).toBe(100);
    expect(result.current.isFading).toBe(true);

    rerender({ isLoading: true });
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current.progress).toBe(100);
    expect(result.current.isFading).toBe(true);
  });

  it("should initialize with __INITIAL_PROGRESS__", () => {
    window.__INITIAL_PROGRESS__ = 50;
    const { result } = renderHook(() => useProgressBar({ isLoading: true }));
    expect(result.current.progress).toBe(50);
    delete window.__INITIAL_PROGRESS__;
  });

  it("should clear __PROGRESS_INTERVAL__ on mount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    window.__PROGRESS_INTERVAL__ = 123;
    renderHook(() => useProgressBar({ isLoading: true }));
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);
    delete window.__PROGRESS_INTERVAL__;
    clearIntervalSpy.mockRestore();
  });
});
