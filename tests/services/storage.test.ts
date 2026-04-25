import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/services/storage";
import { loadGameState, loadProgress, saveGameState, saveProgress } from "@/services/storage";

describe("storage service", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const key in storage) delete storage[key];
      },
    });
    vi.clearAllMocks();
  });

  it("should save and load progress", () => {
    const progress = {
      Easy: { current: 5, max: 10 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    };
    saveProgress(progress);
    expect(loadProgress()).toEqual(progress);
  });

  it("should return default progress if none exists", () => {
    expect(loadProgress()).toEqual({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
  });

  it("should save and load game state", () => {
    const state: GameState = {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Easy",
      stage: 1,
    };
    saveGameState(state);
    expect(loadGameState()).toEqual(state);
  });

  it("should remove game state when saving null", () => {
    saveGameState({
      stage: 1,
      difficulty: "Easy",
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
    });
    saveGameState(null);
    expect(loadGameState()).toBeNull();
  });

  it("should no-op and return defaults when storage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(loadProgress()).toEqual({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    expect(loadGameState()).toBeNull();
    expect(() =>
      saveProgress({
        Easy: { current: 2, max: 3 },
        Medium: { current: 1, max: 1 },
        Hard: { current: 1, max: 1 },
      }),
    ).not.toThrow();
    expect(() => saveGameState(null)).not.toThrow();
  });
});
