import { beforeEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

const routes = [
  { path: "/game/easy?stage=1", label: "easy", text: "Easy - Stage 1" },
  { path: "/game/medium?stage=1", label: "medium", text: "Medium - Stage 1" },
  { path: "/game/hard?stage=1", label: "hard", text: "Hard - Stage 1" },
  { path: "/game/crossing?stage=1", label: "crossing", text: "Crossing - Stage 1" },
  { path: "/game/custom", label: "custom", text: "Custom Game" },
  { path: "/game", label: "game", text: "Page not found" },
  { path: "/game/", label: "game-slash", text: "Page not found" },
  { path: "/404", label: "404", text: "Page not found" },
  { path: "/does-not-exist", label: "fallback", text: "Page not found" },
] as const;

const directCustomGameUrl =
  "/game/custom?given=5&inventory=45&size=10&seed=1891305902&retryCount=20";

const browserCommands = () =>
  commands as unknown as {
    captureBrowserConsole(): Promise<void>;
    gotoRoute(path: string): Promise<void>;
    waitForAppSettled(text: string): Promise<void>;
    waitForRouteSettled(path: string, text: string): Promise<void>;
    clickButton(name: string): Promise<void>;
    clickButtonAndWaitForLoading(name: string): Promise<void>;
    clickTestId(testId: string): Promise<void>;
    getComputedStyleValue(selector: string, property: string): Promise<string>;
    fetchRouteHtmlSummary(path: string): Promise<{
      bodyText: string;
      firstAppClass: string;
      hasCriticalCss: boolean;
    }>;
    getLayoutShiftScore(): Promise<number>;
    resetAppState(): Promise<void>;
    drainBrowserConsoleErrors(): Promise<string[]>;
  };

const assertRouteQuiet = async ({ path, text, label }: (typeof routes)[number]) => {
  const browser = browserCommands();

  await browser.captureBrowserConsole();
  await browser.gotoRoute(path);
  await browser.waitForRouteSettled(path, text);

  expect(await browser.drainBrowserConsoleErrors(), `${label} should not emit page errors`).toEqual(
    [],
  );
};

describe("browser smoke", () => {
  beforeEach(async () => {
    const browser = browserCommands();
    await browser.captureBrowserConsole();
    await browser.gotoRoute("/");
    await browser.resetAppState();
    // After clearing storage, we need to reload or re-navigate to ensure the app picks up the default state
    await browser.gotoRoute("/");
    await browser.drainBrowserConsoleErrors();
  });
  it("keeps the root route quiet and supports menu navigation", async () => {
    const browser = browserCommands();

    await browser.gotoRoute("/");
    await browser.waitForRouteSettled("/", "Math Crossword");
    expect(await browser.getLayoutShiftScore(), "root should not shift during hydration").toBe(0);
    expect(await browser.drainBrowserConsoleErrors(), "root should not emit page errors").toEqual(
      [],
    );

    await browser.clickButton("Easy");
    await browser.waitForAppSettled("Easy");
    await browser.waitForAppSettled("Stage 1");
    expect(
      await browser.getComputedStyleValue('[data-testid="game-board-container"]', "flex-grow"),
      "game route should have full app-core styles after menu navigation",
    ).toBe("1");
    expect(
      await browser.getComputedStyleValue(".tile", "display"),
      "game tiles should keep route styles after menu navigation",
    ).toBe("flex");
    expect(
      await browser.getComputedStyleValue('[data-skeleton-button="back"]', "padding-top"),
      "game header controls should keep app-core styles after menu navigation",
    ).toBe("8px");
    expect(
      await browser.getComputedStyleValue(".board-container", "overflow-x"),
      "inventory should keep route styles after menu navigation",
    ).toBe("auto");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "menu navigation should not emit page errors",
    ).toEqual([]);

    await browser.clickButtonAndWaitForLoading("Back");
    await browser.resetAppState();
    await browser.waitForAppSettled("Math Crossword");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "back navigation should not emit page errors",
    ).toEqual([]);

    await browser.clickButton("Custom");
    await browser.waitForRouteSettled("/game/custom", "Custom Game");
    expect(
      await browser.getComputedStyleValue("#custom-given-count", "border-radius"),
      "custom route should keep form styles after menu navigation",
    ).toBe("16px");
  }, 30000);

  it("verifies theme and language toggles", async () => {
    const browser = browserCommands();

    await browser.captureBrowserConsole();
    await browser.gotoRoute("/");
    await browser.waitForRouteSettled("/", "Math Crossword");

    await browser.clickTestId("theme-toggle");
    await browser.clickTestId("theme-toggle");
    await browser.clickTestId("language-toggle");
    await browser.clickTestId("language-toggle");

    expect(
      await browser.drainBrowserConsoleErrors(),
      "theme/lang toggles should not emit page errors",
    ).toEqual([]);
  }, 30000);

  it("supports custom game generation and back navigation", async () => {
    const browser = browserCommands();

    await browser.captureBrowserConsole();
    await browser.gotoRoute("/game/custom");
    await browser.waitForRouteSettled("/game/custom", "Custom Game");

    await browser.clickButton("Start custom game");
    await browser.waitForAppSettled("Custom");
    expect(
      await browser.getComputedStyleValue('[data-testid="game-board-container"]', "flex-grow"),
      "custom generation should reach the playable game board",
    ).toBe("1");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "custom game generation should not emit page errors",
    ).toEqual([]);

    await browser.clickButton("Back");
    await browser.resetAppState();
    await browser.waitForAppSettled("Math Crossword");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "back from custom game should not emit page errors",
    ).toEqual([]);

    await browser.clickButton("Easy");
    await browser.waitForRouteSettled("/game/easy?stage=1", "Stage 1");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "menu should be interactive after returning from custom game",
    ).toEqual([]);
  }, 60000);

  it("supports crossing game menu navigation and back navigation", async () => {
    const browser = browserCommands();

    await browser.captureBrowserConsole();
    await browser.gotoRoute("/");
    await browser.waitForRouteSettled("/", "Math Crossword");

    await browser.clickButton("Crossing");
    await browser.waitForRouteSettled("/game/crossing?stage=1", "Crossing - Stage 1");
    expect(
      await browser.getComputedStyleValue('[data-testid="game-board-container"]', "flex-grow"),
      "crossing route should have full game layout styles after menu navigation",
    ).toBe("1");
    expect(
      await browser.getComputedStyleValue(".tile", "display"),
      "crossing tiles should keep route styles after menu navigation",
    ).toBe("flex");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "crossing menu navigation should not emit page errors",
    ).toEqual([]);

    await browser.clickButton("Back");
    await browser.resetAppState();
    await browser.waitForAppSettled("Math Crossword");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "back from crossing game should not emit page errors",
    ).toEqual([]);
  }, 30000);

  it("keeps split CSS styles on direct SSG route loads", async () => {
    const browser = browserCommands();

    await browser.captureBrowserConsole();
    await browser.gotoRoute("/game/easy?stage=1");
    await browser.waitForRouteSettled("/game/easy?stage=1", "Stage 1");
    expect(
      await browser.getComputedStyleValue('[data-skeleton-button="back"]', "padding-top"),
      "direct game header controls should keep app-core styles",
    ).toBe("8px");
    expect(
      await browser.getComputedStyleValue(".tile", "display"),
      "direct game tiles should keep split route styles",
    ).toBe("flex");
    expect(
      await browser.getComputedStyleValue(".board-container", "overflow-x"),
      "direct game inventory should keep split route styles",
    ).toBe("auto");

    await browser.gotoRoute("/game/crossing?stage=1");
    await browser.waitForRouteSettled("/game/crossing?stage=1", "Crossing - Stage 1");
    expect(
      await browser.getComputedStyleValue('[data-testid="game-board-container"]', "flex-grow"),
      "direct crossing route should use game layout styles",
    ).toBe("1");
    expect(
      await browser.getComputedStyleValue(".tile", "display"),
      "direct crossing tiles should keep split route styles",
    ).toBe("flex");
    expect(
      await browser.getComputedStyleValue(".board-container", "overflow-x"),
      "direct crossing inventory should keep split route styles",
    ).toBe("auto");

    await browser.gotoRoute("/game/custom");
    await browser.waitForRouteSettled("/game/custom", "Custom Game");
    expect(
      await browser.getLayoutShiftScore(),
      "direct custom route should not shift during hydration",
    ).toBe(0);
    expect(
      await browser.getComputedStyleValue(".theme-page-bg", "padding-top"),
      "direct custom route should load prerendered custom shell, not root fallback",
    ).toBe("16px");
    expect(
      await browser.getComputedStyleValue(".theme-page-bg", "overflow-y"),
      "custom setup shell should scroll vertically on short mobile viewports",
    ).toBe("auto");
    expect(
      await browser.getComputedStyleValue("#custom-given-count", "border-radius"),
      "direct custom route should keep form styles",
    ).toBe("16px");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "direct styled route loads should not emit page errors",
    ).toEqual([]);
  }, 30000);

  it("mounts direct custom game URLs without hydrating the prerendered setup shell", async () => {
    const browser = browserCommands();

    await browser.captureBrowserConsole();
    await browser.gotoRoute(directCustomGameUrl);
    await browser.waitForRouteSettled(directCustomGameUrl, "Custom");

    expect(
      await browser.getComputedStyleValue('[data-testid="game-board-container"]', "flex-grow"),
      "direct custom game board should use game layout styles",
    ).toBe("1");
    expect(
      await browser.getComputedStyleValue(".tile", "display"),
      "direct custom game tiles should keep split route styles",
    ).toBe("flex");
    expect(
      await browser.getComputedStyleValue(".board-container", "overflow-x"),
      "direct custom game inventory should keep split route styles",
    ).toBe("auto");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "direct custom game URL should not emit hydration/layout errors",
    ).toEqual([]);
  }, 30000);

  it("serves prerendered HTML for no-JS direct route loads", async () => {
    const browser = browserCommands();

    const easy = await browser.fetchRouteHtmlSummary("/game/easy?stage=1");
    expect(easy.hasCriticalCss).toBe(true);
    expect(easy.firstAppClass).toContain("theme-page-bg h-dvh w-full flex flex-col");
    expect(easy.bodyText).toContain("Easy");
    expect(easy.bodyText).toContain("Stage 1");

    const custom = await browser.fetchRouteHtmlSummary("/game/custom");
    expect(custom.hasCriticalCss).toBe(true);
    expect(custom.firstAppClass).toContain("theme-page-bg h-dvh w-full overflow-y-auto");
    expect(custom.bodyText).toContain("Custom Game");

    const crossing = await browser.fetchRouteHtmlSummary("/game/crossing?stage=1");
    expect(crossing.hasCriticalCss).toBe(true);
    expect(crossing.firstAppClass).toContain("theme-page-bg h-dvh w-full flex flex-col");
    expect(crossing.bodyText).toContain("Crossing");
    expect(crossing.bodyText).toContain("Stage 1");

    const easySlash = await browser.fetchRouteHtmlSummary("/game/easy/?stage=1");
    expect(easySlash.firstAppClass).toBe(easy.firstAppClass);

    const customSlash = await browser.fetchRouteHtmlSummary("/game/custom/");
    expect(customSlash.firstAppClass).toBe(custom.firstAppClass);

    const crossingSlash = await browser.fetchRouteHtmlSummary("/game/crossing/?stage=1");
    expect(crossingSlash.firstAppClass).toBe(crossing.firstAppClass);
  });

  it("verifies back navigation for all primary routes", async () => {
    const browser = browserCommands();
    const primaryRoutes = [
      { path: "/game/easy?stage=1", text: "Easy - Stage 1" },
      { path: "/game/medium?stage=1", text: "Medium - Stage 1" },
      { path: "/game/hard?stage=1", text: "Hard - Stage 1" },
      { path: "/game/crossing?stage=1", text: "Crossing - Stage 1" },
    ];

    for (const route of primaryRoutes) {
      await browser.captureBrowserConsole();
      await browser.gotoRoute(route.path);
      await browser.waitForRouteSettled(route.path, "Stage 1");

      await browser.clickButton("Back");
      await browser.resetAppState();
      await browser.waitForAppSettled("Math Crossword");
      expect(
        await browser.drainBrowserConsoleErrors(),
        `back from ${route.path} should not emit page errors`,
      ).toEqual([]);
    }
  }, 60000);

  routes.forEach((route) => {
    it(`keeps the ${route.label} route quiet`, async () => {
      await assertRouteQuiet(route);
    });
  });
});
