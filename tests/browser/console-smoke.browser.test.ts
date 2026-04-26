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

describe("browser smoke", () => {
  it("keeps routes quiet", async () => {
    const browserCommands = commands as unknown as {
      captureBrowserConsole(): Promise<void>;
      gotoRoute(path: string): Promise<void>;
      waitForText(text: string): Promise<void>;
      clickButton(name: string): Promise<void>;
      drainBrowserConsoleErrors(): Promise<string[]>;
    };

    await browserCommands.captureBrowserConsole();

    const visit = async (path: string, text: string, label: string) => {
      await browserCommands.gotoRoute(path);
      await browserCommands.waitForText(text);
      const errors = await browserCommands.drainBrowserConsoleErrors();
      expect(errors, `${label} should not emit page errors`).toEqual([]);
    };

    await visit("/", "Math Crossword", "root");
    await browserCommands.clickButton("Easy");
    await browserCommands.waitForText("Easy — Stage 1");
    expect(
      await browserCommands.drainBrowserConsoleErrors(),
      "menu navigation should not emit page errors",
    ).toEqual([]);
    await browserCommands.clickButton("Back");
    await browserCommands.waitForText("Math Crossword");
    expect(
      await browserCommands.drainBrowserConsoleErrors(),
      "back navigation should not emit page errors",
    ).toEqual([]);

    for (const route of routes) {
      await visit(route.path, route.text, route.label);
    }
  });
});
