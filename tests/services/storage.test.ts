import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_GAME_LIMITS } from "@/services/customGameConfig";
import { OP_DIV, OP_MINUS, OP_MULT, OP_PLUS, REL_EQ, REL_GT, REL_LT } from "@/services/math";
import type { CustomGameConfig, GameState, ProgressMode } from "@/services/storage";
import {
  clearClearedGameState,
  DEFAULT_PROGRESS,
  getClearedStateKey,
  loadClearedGameState,
  loadClearedGameStates,
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

const idChars = "abcdefghijklmnopqrstuvwxyz0123456789_,-".split("");
const seedChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".split("");
const tileValues = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  OP_PLUS,
  OP_MINUS,
  OP_MULT,
  OP_DIV,
  REL_EQ,
  REL_LT,
  REL_GT,
] as const;

const tileTypeForValue = (value: string): "val" | "op" | "rel" => {
  if (value === OP_PLUS || value === OP_MINUS || value === OP_MULT || value === OP_DIV) {
    return "op";
  }
  if (value === REL_EQ || value === REL_LT || value === REL_GT) return "rel";
  return "val";
};

const idArb = fc
  .array(fc.constantFrom(...idChars), { minLength: 1, maxLength: 24 })
  .map((chars) => chars.join(""));

const seedArb = fc
  .array(fc.constantFrom(...seedChars), { maxLength: CUSTOM_GAME_LIMITS.maxSeedLength })
  .map((chars) => chars.join(""));

const tileArb = fc
  .record({
    id: idArb,
    val: fc.constantFrom(...tileValues),
    isGiven: fc.boolean(),
  })
  .map(({ id, val, isGiven }) => ({
    id,
    val,
    type: tileTypeForValue(val),
    isGiven,
  }));

const boardKeyArb = fc
  .tuple(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }))
  .map(([row, col]) => `${row},${col}`);

const boardArb = fc
  .uniqueArray(
    fc.record({
      key: boardKeyArb,
      tile: tileArb,
    }),
    { maxLength: 12, selector: ({ key }) => key },
  )
  .map((entries) => Object.fromEntries(entries.map(({ key, tile }) => [key, tile])));

const customConfigArb: fc.Arbitrary<CustomGameConfig> = fc
  .integer({ min: CUSTOM_GAME_LIMITS.minSizeLimit, max: CUSTOM_GAME_LIMITS.maxSizeLimit })
  .chain((sizeLimit) => {
    const maxTotalTiles = Math.min(CUSTOM_GAME_LIMITS.maxTotalTiles, sizeLimit * sizeLimit);
    return fc
      .integer({ min: CUSTOM_GAME_LIMITS.minTotalTiles, max: maxTotalTiles })
      .chain((totalTiles) =>
        fc.integer({ min: 1, max: totalTiles - 1 }).chain((givenCount) =>
          fc
            .record({
              seed: seedArb,
              limitSolutionSize: fc.boolean(),
              attempt: fc.option(
                fc.integer({
                  min: CUSTOM_GAME_LIMITS.minRetryCount,
                  max: CUSTOM_GAME_LIMITS.maxRetryCount,
                }),
                { nil: undefined },
              ),
            })
            .map(({ seed, limitSolutionSize, attempt }) => ({
              givenCount,
              inventoryCount: totalTiles - givenCount,
              sizeLimit,
              seed,
              limitSolutionSize,
              ...(attempt === undefined ? {} : { attempt }),
            })),
        ),
      );
  });

const gameStateCoreArb = fc.record({
  board: boardArb,
  bank: fc.array(tileArb, { maxLength: 12 }),
  initialBankSize: fc.integer({ min: 0, max: CUSTOM_GAME_LIMITS.maxTotalTiles }),
  status: fc.constantFrom("playing" as const, "won" as const),
  stage: fc.integer({ min: 1, max: CUSTOM_GAME_LIMITS.maxRetryCount }),
  solvedAcknowledged: fc.boolean(),
});

const progressModeArb = fc.constantFrom<ProgressMode>("Easy", "Medium", "Hard", "Crossing");

const gameStateArb: fc.Arbitrary<GameState> = gameStateCoreArb.chain((core) =>
  fc.oneof(
    progressModeArb.map(
      (difficulty): GameState => ({
        ...core,
        difficulty,
      }),
    ),
    customConfigArb.map(
      (customConfig): GameState => ({
        ...core,
        difficulty: "Custom",
        customConfig,
      }),
    ),
  ),
);

const progressGameStateArb: fc.Arbitrary<GameState> = gameStateCoreArb.chain((core) =>
  progressModeArb.map(
    (difficulty): GameState => ({
      ...core,
      difficulty,
    }),
  ),
);

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

    localStorage.setItem("math_scrabble_state", "{not-json");
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

  it("should save and load valid game states", () => {
    fc.assert(
      fc.property(gameStateArb, (state) => {
        localStorage.clear();

        saveGameState(state);

        expect(loadGameState()).toEqual(state);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject invalid mutations of otherwise valid game states", () => {
    fc.assert(
      fc.property(gameStateArb, customConfigArb, (state, customConfig) => {
        expect(
          sanitizeStoredGameState({
            ...state,
            board: { "not-a-key": validState.board["0,0"] },
          }),
        ).toBeNull();
        expect(sanitizeStoredGameState({ ...state, stage: 0 })).toBeNull();
        expect(
          sanitizeStoredGameState({
            ...state,
            difficulty: "Easy",
            customConfig,
          }),
        ).toBeNull();
        expect(
          sanitizeStoredGameState({
            ...state,
            difficulty: "Custom",
            customConfig: { ...customConfig, givenCount: 0 },
          }),
        ).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("should load only cleared states with matching progress keys", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(progressGameStateArb, {
          maxLength: 8,
          selector: (state) => getClearedStateKey(state.difficulty as ProgressMode, state.stage),
        }),
        customConfigArb,
        (states, customConfig) => {
          const expected = Object.fromEntries(
            states.map((state) => [
              getClearedStateKey(state.difficulty as ProgressMode, state.stage),
              state,
            ]),
          );
          localStorage.setItem(
            "math_scrabble_cleared_states",
            JSON.stringify({
              ...expected,
              "Easy:0": { ...validState, difficulty: "Easy", stage: 1 },
              "Custom:1": {
                ...validState,
                difficulty: "Custom",
                customConfig,
              },
              "bad-key": validState,
            }),
          );

          expect(loadClearedGameStates()).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
