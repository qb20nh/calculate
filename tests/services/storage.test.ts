import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OP_PLUS } from "@/services/math";
import type { GameState } from "@/services/storage";
import {
  clearClearedGameState,
  DEFAULT_PROGRESS,
  loadClearedGameState,
  loadGameState,
  loadProgress,
  sanitizeStoredGameState,
  saveClearedGameState,
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
  bank: [{ id: "b_0,1", val: OP_PLUS, type: "op" }],
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
    expect(
      sanitizeStoredGameState({
        ...validState,
        board: { "-1,0": validState.board["0,0"] },
      }),
    ).toEqual({
      ...validState,
      board: { "-1,0": validState.board["0,0"] },
    });
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

  it("should save cleared game states per level", () => {
    const easyState = { ...validState, status: "won" as const, stage: 1 };
    const crossingState: GameState = {
      ...validState,
      status: "won",
      difficulty: "Crossing",
      stage: 2,
    };

    saveClearedGameState(easyState);
    saveClearedGameState(crossingState);

    expect(loadClearedGameState("Easy", 1)).toEqual(easyState);
    expect(loadClearedGameState("Crossing", 2)).toEqual(crossingState);
    expect(loadClearedGameState("Easy", 2)).toBeNull();
  });

  it("should clear one saved cleared level without touching others", () => {
    const easyState = { ...validState, status: "won" as const, stage: 1 };
    const hardState: GameState = {
      ...validState,
      status: "won",
      difficulty: "Hard",
      stage: 2,
    };
    saveClearedGameState(easyState);
    saveClearedGameState(hardState);

    clearClearedGameState("Easy", 1);

    expect(loadClearedGameState("Easy", 1)).toBeNull();
    expect(loadClearedGameState("Hard", 2)).toEqual(hardState);
  });

  it("should sanitize cleared game state entries", () => {
    localStorage.setItem(
      "math_scrabble_cleared_states",
      JSON.stringify({
        "Easy:1": { ...validState, status: "won" },
        "Easy:2": { ...validState, status: "won", board: { "not-a-key": validState.board["0,0"] } },
        "Hard:7": { ...validState, status: "won", difficulty: "Hard", stage: 3 },
      }),
    );

    expect(loadClearedGameState("Easy", 1)).toEqual({ ...validState, status: "won" });
    expect(loadClearedGameState("Easy", 2)).toBeNull();
    expect(loadClearedGameState("Hard", 3)).toBeNull();
  });
});
