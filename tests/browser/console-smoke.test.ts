import { describe, expect, it } from "vitest";
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
  it("keeps the root route quiet and supports menu navigation", async () => {
    const browser = browserCommands();

    await browser.captureBrowserConsole();
    await browser.gotoRoute("/");
    await browser.waitForRouteSettled("/", "Math Crossword");
    expect(await browser.drainBrowserConsoleErrors(), "root should not emit page errors").toEqual(
      [],
    );

    await browser.clickButton("Easy");
    await browser.waitForAppSettled("Easy — Stage 1");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "menu navigation should not emit page errors",
    ).toEqual([]);

    await browser.clickButton("Back");
    await browser.waitForAppSettled("Math Crossword");
    expect(
      await browser.drainBrowserConsoleErrors(),
      "back navigation should not emit page errors",
    ).toEqual([]);
  });

  routes.forEach((route) => {
    it(`keeps the ${route.label} route quiet`, async () => {
      await assertRouteQuiet(route);
    });
  });
});
