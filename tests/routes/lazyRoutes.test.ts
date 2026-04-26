import { describe, it } from "vitest";
import { preloadGameRoute } from "@/routes/lazyRoutes";

describe("lazyRoutes", () => {
  it("should preload game route", () => {
    preloadGameRoute();
  });

  it("should not crash when preloading in non-browser environment", () => {
    const originalWindow = global.window;
    // @ts-expect-error
    delete global.window;
    preloadGameRoute();
    global.window = originalWindow;
  });
});
