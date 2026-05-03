import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  advanceProgress,
  getLatestUnlockedStage,
  isStageLocked,
  unlockStage,
} from "@/services/progress";
import {
  DEFAULT_PROGRESS,
  type GameState,
  getClearedStateKey,
  loadClearedGameStates,
  loadGameState,
  loadProgress,
  type Progress,
  type ProgressMode,
  saveClearedGameStates,
  saveGameState,
  saveProgress,
} from "@/services/storage";

type StageRestoreSource = "active" | "cleared" | "none";

type StageRestore = Readonly<{
  state: GameState | null;
  source: StageRestoreSource;
  persistInitialState: boolean;
}>;

type StageStateChangeContext = Readonly<{
  clearedResetTilePlaced?: boolean;
}>;

export type GamePersistenceModel = Readonly<{
  isHydrated: boolean;
  progress: Progress;
  activeState: GameState | null;
  clearedStates: Readonly<Record<string, GameState>>;
}>;

type GamePersistenceAction =
  | Readonly<{ type: "hydrate"; model: Omit<GamePersistenceModel, "isHydrated"> }>
  | Readonly<{
      type: "set-current-stage";
      mode: ProgressMode;
      stage: number;
      unlock: boolean;
    }>
  | Readonly<{ type: "unlock-stage"; mode: ProgressMode; stage: number }>
  | Readonly<{
      type: "save-stage-state";
      state: GameState;
      context?: StageStateChangeContext;
    }>
  | Readonly<{ type: "save-active-state"; state: GameState | null }>;

type GamePersistenceValue = Readonly<{
  isHydrated: boolean;
  progress: Progress;
  activeState: GameState | null;
  getStageRestore: (mode: ProgressMode, stage: number) => StageRestore;
  getLatestUnlockedStage: (mode: ProgressMode) => number;
  isStageLocked: (mode: ProgressMode, stage: number) => boolean;
  setCurrentStage: (
    mode: ProgressMode,
    stage: number,
    options?: Readonly<{ unlock?: boolean }>,
  ) => void;
  unlockStage: (mode: ProgressMode, stage: number) => void;
  saveStageState: (state: GameState, context?: StageStateChangeContext) => void;
  saveActiveState: (state: GameState | null) => void;
}>;

export const EMPTY_STAGE_RESTORE: StageRestore = {
  state: null,
  source: "none",
  persistInitialState: false,
};

const createInitialGamePersistenceModel = (): GamePersistenceModel => ({
  isHydrated: false,
  progress: DEFAULT_PROGRESS,
  activeState: null,
  clearedStates: {},
});

const isProgressMode = (mode: GameState["difficulty"]): mode is ProgressMode => mode !== "Custom";

const hydrateGamePersistenceModel = (): GamePersistenceModel => ({
  isHydrated: true,
  progress: loadProgress(),
  activeState: loadGameState(),
  clearedStates: loadClearedGameStates(),
});

export const getStageRestoreFromModel = (
  model: GamePersistenceModel,
  mode: ProgressMode,
  stage: number,
): StageRestore => {
  const activeState = model.activeState;
  if (activeState?.difficulty === mode && activeState.stage === stage) {
    return {
      state: activeState,
      source: "active",
      persistInitialState: true,
    };
  }

  const clearedState = model.clearedStates[getClearedStateKey(mode, stage)];
  if (clearedState) {
    return {
      state: clearedState,
      source: "cleared",
      persistInitialState: false,
    };
  }

  return EMPTY_STAGE_RESTORE;
};

const withClearedStage = (clearedStates: Readonly<Record<string, GameState>>, state: GameState) => {
  if (!isProgressMode(state.difficulty)) return clearedStates;

  return {
    ...clearedStates,
    [getClearedStateKey(state.difficulty, state.stage)]: state,
  };
};

const withoutClearedStage = (
  clearedStates: Readonly<Record<string, GameState>>,
  state: GameState,
) => {
  if (!isProgressMode(state.difficulty)) return clearedStates;

  const clearedStateKey = getClearedStateKey(state.difficulty, state.stage);
  return Object.fromEntries(
    Object.entries(clearedStates).filter(([key]) => key !== clearedStateKey),
  );
};

const updateClearedStatesForStageState = (
  clearedStates: Readonly<Record<string, GameState>>,
  state: GameState,
  context?: StageStateChangeContext,
) => {
  if (!isProgressMode(state.difficulty)) return clearedStates;

  const clearedStateKey = getClearedStateKey(state.difficulty, state.stage);
  const afterSave =
    state.status === "won" || (state.solvedAcknowledged && !clearedStates[clearedStateKey])
      ? withClearedStage(clearedStates, state)
      : clearedStates;

  return context?.clearedResetTilePlaced ? withoutClearedStage(afterSave, state) : afterSave;
};

export const reduceGamePersistenceModel = (
  model: GamePersistenceModel,
  action: GamePersistenceAction,
): GamePersistenceModel => {
  switch (action.type) {
    case "hydrate":
      return { ...action.model, isHydrated: true };
    case "set-current-stage":
      return {
        ...model,
        progress: advanceProgress(model.progress, action.mode, action.stage, action.unlock),
      };
    case "unlock-stage":
      return {
        ...model,
        progress: unlockStage(model.progress, action.mode, action.stage),
      };
    case "save-stage-state":
      return {
        ...model,
        activeState: action.state,
        clearedStates: updateClearedStatesForStageState(
          model.clearedStates,
          action.state,
          action.context,
        ),
      };
    case "save-active-state":
      return {
        ...model,
        activeState: action.state,
      };
  }
};

const persistModelChange = (previous: GamePersistenceModel, next: GamePersistenceModel) => {
  if (previous.progress !== next.progress) saveProgress(next.progress);
  if (previous.activeState !== next.activeState) saveGameState(next.activeState);
  if (previous.clearedStates !== next.clearedStates) {
    saveClearedGameStates({ ...next.clearedStates });
  }
};

const GamePersistenceContext = createContext<GamePersistenceValue | null>(null);

export function GamePersistenceProvider({ children }: Readonly<{ children: ComponentChildren }>) {
  const modelRef = useRef<GamePersistenceModel>(createInitialGamePersistenceModel());
  const [model, setModel] = useState<GamePersistenceModel>(modelRef.current);

  useEffect(() => {
    const hydratedModel = hydrateGamePersistenceModel();
    modelRef.current = hydratedModel;
    setModel(hydratedModel);
  }, []);

  const commit = useCallback((action: GamePersistenceAction) => {
    const previous = modelRef.current;
    const next = reduceGamePersistenceModel(previous, action);
    modelRef.current = next;
    persistModelChange(previous, next);
    setModel(next);
  }, []);

  const value = useMemo<GamePersistenceValue>(
    () => ({
      isHydrated: model.isHydrated,
      progress: model.progress,
      activeState: model.activeState,
      getStageRestore: (mode, stage) => getStageRestoreFromModel(model, mode, stage),
      getLatestUnlockedStage: (mode) => getLatestUnlockedStage(model.progress, mode),
      isStageLocked: (mode, stage) => isStageLocked(model.progress, mode, stage),
      setCurrentStage: (mode, stage, options) =>
        commit({
          type: "set-current-stage",
          mode,
          stage,
          unlock: options?.unlock ?? false,
        }),
      unlockStage: (mode, stage) => commit({ type: "unlock-stage", mode, stage }),
      saveStageState: (state, context) =>
        context === undefined
          ? commit({ type: "save-stage-state", state })
          : commit({ type: "save-stage-state", state, context }),
      saveActiveState: (state) => commit({ type: "save-active-state", state }),
    }),
    [commit, model],
  );

  return (
    <GamePersistenceContext.Provider value={value}>{children}</GamePersistenceContext.Provider>
  );
}

export const useGamePersistence = () => {
  const context = useContext(GamePersistenceContext);
  if (!context) throw new Error("useGamePersistence must be used inside GamePersistenceProvider");
  return context;
};
