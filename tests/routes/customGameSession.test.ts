import { describe, expect, it } from "vitest";
import { getCustomGameUrlSyncPath, resolveCustomGameSession } from "@/routes/customGameSession";
import type { CustomGameConfig, GameState } from "@/services/storage";

describe("custom game session", () => {
  const config: CustomGameConfig = {
    givenCount: 6,
    inventoryCount: 10,
    sizeLimit: 10,
    seed: "123",
    limitSolutionSize: false,
    attempt: 37,
  };
  const savedState: GameState = {
    board: {},
    bank: [],
    initialBankSize: 0,
    status: "playing",
    difficulty: "Custom",
    stage: 1,
    customConfig: config,
  };

  it("should resolve custom URL config and saved resume intent", () => {
    const session = resolveCustomGameSession({
      isHydrated: true,
      locationUrl: "/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=37",
      savedState,
    });

    expect(session.parsedConfig).toEqual(config);
    expect(session.parsedRetryCount).toBe(37);
    expect(session.hasRetryCountInUrl).toBe(true);
    expect(session.resumeSavedGame).toBe(savedState);
    expect(session.invalidUrl).toBe(false);
  });

  it("should not resume saved games before hydration or on invalid URLs", () => {
    expect(
      resolveCustomGameSession({
        isHydrated: false,
        locationUrl: "/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=37",
        savedState,
      }).resumeSavedGame,
    ).toBe(null);

    const invalid = resolveCustomGameSession({
      isHydrated: true,
      locationUrl: "/game/custom?given=abc",
      savedState,
    });

    expect(invalid.parsedConfig).toBe(null);
    expect(invalid.resumeSavedGame).toBe(null);
    expect(invalid.invalidUrl).toBe(true);
  });

  it("should return a sync path only when the current custom URL differs", () => {
    const currentPath = "/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=37";

    expect(getCustomGameUrlSyncPath(config, 37, currentPath)).toBe(null);
    expect(getCustomGameUrlSyncPath(config, 38, currentPath)).toBe(
      "/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=38",
    );
  });
});
