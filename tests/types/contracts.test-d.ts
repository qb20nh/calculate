import { assertType, expectTypeOf } from "vitest";
import {
  type GamePersistenceModel,
  getStageRestoreFromModel,
  type useGamePersistence,
} from "@/lib/gamePersistence";
import { resolveMenuRoute } from "@/routes/menuRouteState";
import { resolveNormalGameRouteState } from "@/routes/normalGameRouteState";
import { parseGameModeSlug, toCustomGamePath, toGamePath } from "@/routes/routeUtils";
import {
  type CustomGameGenerationMessage,
  type CustomGameGenerationRequest,
  type CustomGameWorkerHandle,
  isCustomGameGenerationMessage,
  isCustomGameGenerationRequest,
} from "@/services/customGameGeneration";
import type {
  CustomGameConfig,
  Difficulty,
  GameMode,
  GameState,
  Progress,
  ProgressMode,
} from "@/services/storage";

expectTypeOf<GameMode>().toEqualTypeOf<Difficulty | "Custom" | "Crossing">();
expectTypeOf<ProgressMode>().toEqualTypeOf<Difficulty | "Crossing">();
expectTypeOf<CustomGameGenerationMessage["type"]>().toEqualTypeOf<
  "progress" | "success" | "failure"
>();

declare const progress: Progress;
declare const gameState: GameState;
declare const persistence: ReturnType<typeof useGamePersistence>;
declare const unknownValue: unknown;

expectTypeOf(progress.Easy).toEqualTypeOf<Readonly<{ current: number; max: number }>>();
expectTypeOf(progress.Crossing).toEqualTypeOf<
  Readonly<{ current: number; max: number }> | undefined
>();

assertType<string>(toGamePath("Easy", 1));
assertType<string>(toGamePath("Crossing", 1));
assertType<GameMode | null>(parseGameModeSlug("custom"));
assertType<string>(resolveMenuRoute({ mode: "Custom", progress }));
assertType<string>(resolveMenuRoute({ mode: "Crossing", progress }));

// @ts-expect-error Custom games use toCustomGamePath because they need config.
toGamePath("Custom", 1);

const customConfig: CustomGameConfig = {
  givenCount: 6,
  inventoryCount: 10,
  sizeLimit: 10,
  seed: "123",
  limitSolutionSize: false,
};

assertType<string>(toCustomGamePath(customConfig, 0));

// @ts-expect-error Custom-game urls need the full config contract.
toCustomGamePath({ givenCount: 6 }, 0);

assertType<{
  requestedStage: number | null;
  latestUnlockedStage: number;
  stageLocked: boolean;
  targetPath: string | null;
  shouldRedirect: boolean;
}>(
  resolveNormalGameRouteState({
    difficulty: "Easy",
    isClient: true,
    locationUrl: "/game/easy?stage=1",
    savedStateDifficulty: null,
    savedStateStage: null,
    progress,
  }),
);

resolveNormalGameRouteState({
  // @ts-expect-error Normal game routes accept standard difficulties, not Custom.
  difficulty: "Custom",
  isClient: true,
  locationUrl: "/game/custom",
  savedStateDifficulty: null,
  savedStateStage: null,
  progress,
});

const request: CustomGameGenerationRequest = {
  type: "generate",
  config: customConfig,
  retryCount: 0,
};

declare const worker: CustomGameWorkerHandle;

worker.postMessage(request);

if (isCustomGameGenerationRequest(unknownValue)) {
  assertType<CustomGameGenerationRequest>(unknownValue);
}

if (isCustomGameGenerationMessage(unknownValue)) {
  assertType<CustomGameGenerationMessage>(unknownValue);
}

assertType<boolean>(isCustomGameGenerationRequest({}));
assertType<boolean>(isCustomGameGenerationMessage({}));

// @ts-expect-error Worker accepts generation requests, not result messages.
worker.postMessage({ type: "progress", retryCount: 1, totalRetries: 2 });

// @ts-expect-error Generation request data is read-only at service boundaries.
request.retryCount = 1;

// @ts-expect-error Custom-game config data is read-only at service boundaries.
request.config.seed = "next";

// @ts-expect-error Custom-game config itself is read-only.
customConfig.seed = "next";

const model: GamePersistenceModel = {
  isHydrated: true,
  progress,
  activeState: null,
  clearedStates: {},
};

assertType<Readonly<Record<string, GameState>>>(model.clearedStates);
assertType<{
  state: GameState | null;
  source: "active" | "cleared" | "none";
  persistInitialState: boolean;
}>(getStageRestoreFromModel(model, "Easy", 1));

// @ts-expect-error Cleared states are immutable from persistence model callers.
model.clearedStates["Easy:1"] = gameState;

// @ts-expect-error Custom games are active saves, not progress/cleared stages.
getStageRestoreFromModel(model, "Custom", 1);

assertType<GameState | null>(persistence.activeState);
assertType<number>(persistence.getLatestUnlockedStage("Crossing"));
persistence.getStageRestore("Easy", 1);
persistence.isStageLocked("Crossing", 1);
persistence.setCurrentStage("Easy", 1);
persistence.setCurrentStage("Crossing", 1, { unlock: true });
persistence.unlockStage("Hard", 2);
persistence.saveStageState(gameState);
persistence.saveStageState(gameState, { clearedResetTilePlaced: true });
persistence.saveActiveState(gameState);
persistence.saveActiveState(null);

// @ts-expect-error Custom is not a progress mode.
persistence.getStageRestore("Custom", 1);

// @ts-expect-error Custom is not a stage progress mode.
persistence.setCurrentStage("Custom", 1);
