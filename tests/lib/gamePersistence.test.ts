import { describe, expect, it } from "vitest";
import {
  type GamePersistenceModel,
  getStageRestoreFromModel,
  reduceGamePersistenceModel,
} from "@/lib/gamePersistence";
import { DEFAULT_PROGRESS, type GameState, getClearedStateKey } from "@/services/storage";

const makeModel = (overrides: Partial<GamePersistenceModel> = {}): GamePersistenceModel => ({
  isHydrated: true,
  progress: DEFAULT_PROGRESS,
  activeState: null,
  clearedStates: {},
  ...overrides,
});

const makeState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    board: {},
    bank: [],
    initialBankSize: 0,
    status: "playing",
    difficulty: "Easy",
    stage: 1,
    ...overrides,
  }) as GameState;

describe("game persistence model", () => {
  it("keeps unsolved active save available beside a cleared stage save", () => {
    const activeStage = makeState({
      difficulty: "Easy",
      stage: 2,
      status: "playing",
      initialBankSize: 1,
    });
    const clearedStage = makeState({
      difficulty: "Easy",
      stage: 1,
      status: "won",
      solvedAcknowledged: true,
    });
    const model = makeModel({
      activeState: activeStage,
      clearedStates: {
        [getClearedStateKey("Easy", 1)]: clearedStage,
      },
    });

    expect(getStageRestoreFromModel(model, "Easy", 1)).toEqual({
      state: clearedStage,
      source: "cleared",
      persistInitialState: false,
    });
    expect(getStageRestoreFromModel(model, "Easy", 2)).toEqual({
      state: activeStage,
      source: "active",
      persistInitialState: true,
    });
  });

  it("returns an empty restore when no active or cleared save matches", () => {
    expect(getStageRestoreFromModel(makeModel(), "Medium", 4)).toEqual({
      state: null,
      source: "none",
      persistInitialState: false,
    });
  });

  it("hydrates progress, active state, and cleared states together", () => {
    const activeState = makeState({ stage: 2 });
    const clearedState = makeState({ status: "won", solvedAcknowledged: true });
    const next = reduceGamePersistenceModel(makeModel(), {
      type: "hydrate",
      model: {
        progress: {
          ...DEFAULT_PROGRESS,
          Easy: { current: 2, max: 2 },
        },
        activeState,
        clearedStates: {
          [getClearedStateKey("Easy", 1)]: clearedState,
        },
      },
    });

    expect(next).toMatchObject({
      isHydrated: true,
      progress: { Easy: { current: 2, max: 2 } },
      activeState,
    });
    expect(next.clearedStates[getClearedStateKey("Easy", 1)]).toBe(clearedState);
  });

  it("updates current progress without unlocking and unlocks only higher stages", () => {
    const moved = reduceGamePersistenceModel(
      makeModel({
        progress: {
          ...DEFAULT_PROGRESS,
          Easy: { current: 1, max: 3 },
        },
      }),
      { type: "set-current-stage", mode: "Easy", stage: 2, unlock: false },
    );
    const unlocked = reduceGamePersistenceModel(moved, {
      type: "unlock-stage",
      mode: "Easy",
      stage: 4,
    });

    expect(moved.progress.Easy).toEqual({ current: 2, max: 3 });
    expect(unlocked.progress.Easy).toEqual({ current: 2, max: 4 });
  });

  it("saves won stages as both active state and cleared state", () => {
    const wonState = makeState({ status: "won" });
    const next = reduceGamePersistenceModel(makeModel(), {
      type: "save-stage-state",
      state: wonState,
    });

    expect(next.activeState).toBe(wonState);
    expect(next.clearedStates[getClearedStateKey("Easy", 1)]).toBe(wonState);
  });

  it("saves acknowledged solved stages without overwriting existing cleared state", () => {
    const existingClearedState = makeState({ status: "won", solvedAcknowledged: true });
    const acknowledgedState = makeState({
      status: "playing",
      solvedAcknowledged: true,
      initialBankSize: 1,
    });
    const fresh = reduceGamePersistenceModel(makeModel(), {
      type: "save-stage-state",
      state: acknowledgedState,
    });
    const next = reduceGamePersistenceModel(
      makeModel({
        clearedStates: {
          [getClearedStateKey("Easy", 1)]: existingClearedState,
        },
      }),
      {
        type: "save-stage-state",
        state: acknowledgedState,
      },
    );

    expect(fresh.clearedStates[getClearedStateKey("Easy", 1)]).toBe(acknowledgedState);
    expect(next.activeState).toBe(acknowledgedState);
    expect(next.clearedStates[getClearedStateKey("Easy", 1)]).toBe(existingClearedState);
  });

  it("clears a saved solved stage only after reset causes new tile placement", () => {
    const existingClearedState = makeState({ status: "won", solvedAcknowledged: true });
    const dirtyPlayingState = makeState({
      status: "playing",
      solvedAcknowledged: false,
      initialBankSize: 1,
    });
    const next = reduceGamePersistenceModel(
      makeModel({
        clearedStates: {
          [getClearedStateKey("Easy", 1)]: existingClearedState,
        },
      }),
      {
        type: "save-stage-state",
        state: dirtyPlayingState,
        context: { clearedResetTilePlaced: true },
      },
    );

    expect(next.activeState).toBe(dirtyPlayingState);
    expect(next.clearedStates[getClearedStateKey("Easy", 1)]).toBeUndefined();
  });

  it("keeps custom games out of cleared stage saves", () => {
    const customState = makeState({
      difficulty: "Custom",
      customConfig: {
        givenCount: 8,
        inventoryCount: 12,
        sizeLimit: 10,
        seed: "custom",
        limitSolutionSize: false,
      },
    });
    const next = reduceGamePersistenceModel(makeModel(), {
      type: "save-stage-state",
      state: customState,
      context: { clearedResetTilePlaced: true },
    });

    expect(next.activeState).toBe(customState);
    expect(next.clearedStates).toEqual({});
  });

  it("stores custom active state directly", () => {
    const customState = makeState({ difficulty: "Custom" });
    const next = reduceGamePersistenceModel(makeModel(), {
      type: "save-active-state",
      state: customState,
    });

    expect(next.activeState).toBe(customState);
  });
});
