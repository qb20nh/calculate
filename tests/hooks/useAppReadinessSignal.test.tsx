import { cleanup, render, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { reportAppRenderError, useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";

function TestProbe({ ready, route }: { ready: boolean; route: string }) {
  useAppReadinessSignal(ready, route);
  return null;
}

describe("useAppReadinessSignal", () => {
  it("should publish readiness state and clear render errors when ready", async () => {
    window.__APP_RENDER_ERROR__ = "boom";

    const { rerender, unmount } = render(<TestProbe ready={true} route="game" />);

    await waitFor(() => {
      expect(window.__APP_READY__).toBe(true);
      expect(window.__APP_READY_ROUTE__).toBe("game");
      expect(window.__APP_RENDER_ERROR__).toBeUndefined();
    });

    rerender(<TestProbe ready={false} route="game" />);

    await waitFor(() => {
      expect(window.__APP_READY__).toBe(false);
      expect(window.__APP_READY_ROUTE__).toBe("game");
      expect(window.__APP_RENDER_ERROR__).toBeUndefined();
    });

    window.__APP_READY_ROUTE__ = "other";
    unmount();
    expect(window.__APP_READY__).toBe(false);
    cleanup();
  });

  it("should leave an existing render error when not ready", async () => {
    window.__APP_RENDER_ERROR__ = "persist";

    render(<TestProbe ready={false} route="custom" />);

    await waitFor(() => {
      expect(window.__APP_READY__).toBe(false);
      expect(window.__APP_READY_ROUTE__).toBe("custom");
      expect(window.__APP_RENDER_ERROR__).toBe("persist");
    });

    cleanup();
  });

  it("should ignore render errors when window is unavailable", () => {
    const originalWindow = global.window;
    // @ts-expect-error intentional SSR-style absence
    delete global.window;

    expect(() => reportAppRenderError(new Error("boom"))).not.toThrow();

    global.window = originalWindow;
  });

  it("should record render errors when window is available", () => {
    delete window.__APP_RENDER_ERROR__;
    reportAppRenderError(new Error("boom"));

    expect(window.__APP_READY__).toBe(false);
    expect(window.__APP_RENDER_ERROR__).toBe("boom");
  });

  it("should fall back to String(error) when message is empty", () => {
    delete window.__APP_RENDER_ERROR__;
    reportAppRenderError({ message: "" } as Error);

    expect(window.__APP_READY__).toBe(false);
    expect(window.__APP_RENDER_ERROR__).toBe("[object Object]");
  });

  it("should no-op the hook when window is unavailable", async () => {
    const originalWindow = global.window;
    // @ts-expect-error intentional SSR-style absence
    delete global.window;

    vi.resetModules();
    vi.doMock("preact/hooks", () => ({
      useEffect: (effect: () => void) => effect(),
    }));

    const { useAppReadinessSignal: mockedUseAppReadinessSignal } = await import(
      "@/hooks/useAppReadinessSignal"
    );

    expect(() => mockedUseAppReadinessSignal(true, "ssr")).not.toThrow();

    vi.unmock("preact/hooks");
    vi.resetModules();
    global.window = originalWindow;
  });
});
