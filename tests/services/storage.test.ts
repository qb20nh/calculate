import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/services/storage";
import {
  DEFAULT_PROGRESS,
  loadGameState,
  loadProgress,
  sanitizeStoredGameState,
  saveGameState,
  saveProgress,
} from "@/services/storage";

const createStorage = () => {
  const storage: Record<string, string> = {};
  return {
    storage,
    api: {
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
    },
  };
};

const validState: GameState = {
  board: {
    "0,0": { id: "g_0,0", val: "1", type: "val", isGiven: true },
  },
  bank: [{ id: "b_0,1", val: "+", type: "op" }],
  initialBankSize: 1,
  status: "playing",
  difficulty: "Easy",
  stage: 1,
  solvedAcknowledged: false,
};

describe("storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    const { api } = createStorage();
    vi.stubGlobal("localStorage", api);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should save and load bounded progress", () => {
    saveProgress({
      Easy: { current: 2, max: 3 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });

    expect(loadProgress().Easy).toEqual({ current: 2, max: 3 });

    localStorage.setItem(
      "math_scrabble_progress",
      JSON.stringify({ Easy: { current: Infinity, max: 3 } }),
    );
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("should sanitize saved game state shape", () => {
    expect(sanitizeStoredGameState(validState)).toEqual(validState);
    expect(sanitizeStoredGameState({ ...validState, stage: 0 })).toBeNull();
    expect(
      sanitizeStoredGameState({ ...validState, board: { "999,0": validState.board["0,0"] } }),
    ).toBeNull();
    expect(
      sanitizeStoredGameState({
        ...validState,
        bank: [{ id: "bad", val: "999", type: "val" }],
      }),
    ).toBeNull();
  });

  it("should reject oversized custom configs from storage", () => {
    const customState: GameState = {
      ...validState,
      difficulty: "Custom",
      customConfig: {
        givenCount: 60,
        inventoryCount: 61,
        sizeLimit: 20,
        seed: "x",
        limitSolutionSize: false,
      },
    };

    expect(sanitizeStoredGameState(customState)).toBeNull();
  });

  it("should load only sanitized game state", () => {
    saveGameState(validState);
    expect(loadGameState()).toEqual(validState);

    localStorage.setItem(
      "math_scrabble_state",
      JSON.stringify({ ...validState, board: { "not-a-key": validState.board["0,0"] } }),
    );
    expect(loadGameState()).toBeNull();
  });
});
