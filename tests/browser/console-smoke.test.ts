import { beforeEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

const routes = [
  { path: "/game/easy?stage=1", label: "easy", text: "Easy — Stage 1" },
  { path: "/game/medium?stage=1", label: "medium", text: "Medium — Stage 1" },
  { path: "/game/hard?stage=1", label: "hard", text: "Hard — Stage 1" },
  { path: "/game/custom", label: "custom", text: "Custom Game" },
  { path: "/game", label: "game", text: "Page not found" },
  { path: "/game/", label: "game-slash", text: "Page not found" },
  { path: "/404", label: "404", text: "Page not found" },
  { path: "/does-not-exist", label: "fallback", text: "Page not found" },
] as const;

const browserCommands = () =>
  commands as unknown as {
    captureBrowserConsole(): Promise<void>;
    gotoRoute(path: string): Promise<void>;
    waitForAppSettled(text: string): Promise<void>;
    waitForRouteSettled(path: string, text: string): Promise<void>;
    clickButton(name: string): Promise<void>;
    clickTestId(testId: string): Promise<void>;
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
  });
  it("keeps the root route quiet and supports menu navigation", async () => {
    const browser = browserCommands();

    await browser.gotoRoute("/");
    await browser.waitForRouteSettled("/", "Math Crossword");
    expect(await browser.drainBrowserConsoleErrors(), "root should not emit page errors").toEqual(
      [],
    );

    await browser.clickButton("Easy");
    await browser.waitForAppSettled("Easy");
    await browser.waitForAppSettled("Stage 1");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "menu navigation should not emit page errors",
    ).toEqual([]);

    await browser.clickButton("Back");
    await browser.resetAppState();
    await browser.waitForAppSettled("Math Crossword");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "back navigation should not emit page errors",
    ).toEqual([]);
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
    await browser.waitForAppSettled("Stage 1");
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
  }, 30000);

  it("verifies back navigation for all primary routes", async () => {
    const browser = browserCommands();
    const primaryRoutes = [
      { path: "/game/easy?stage=1", text: "Easy — Stage 1" },
      { path: "/game/medium?stage=1", text: "Medium — Stage 1" },
      { path: "/game/hard?stage=1", text: "Hard — Stage 1" },
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
