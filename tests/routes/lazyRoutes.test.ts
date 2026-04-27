import { describe, expect, it } from "vitest";
import { isGameRoutePreloaded, preloadGameRoute } from "@/routes/lazyRoutes";

describe("lazyRoutes", () => {
  it("should preload game route", () => {
    preloadGameRoute();
  });

  it("should report game route preload state", async () => {
    expect(isGameRoutePreloaded()).toBe(false);
    await preloadGameRoute();
    expect(isGameRoutePreloaded()).toBe(true);
  });

  it("should not crash when preloading in non-browser environment", () => {
    const originalWindow = global.window;
    // @ts-expect-error
    delete global.window;
    preloadGameRoute();
    global.window = originalWindow;
  });
});
