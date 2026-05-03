import { useCallback, useEffect } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import {
  Game,
  GameLoadingShell,
  type GameStateChangeContext,
  UnavailableLevelShell,
} from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
import { EMPTY_STAGE_RESTORE, useGamePersistence } from "@/lib/gamePersistence";
import CustomGameRoute from "@/routes/CustomGameRoute";
import NotFoundRoute from "@/routes/NotFoundRoute";
import { resolveNormalGameRouteState } from "@/routes/normalGameRouteState";
import {
  parseDifficultySlug,
  parseGameModeSlug,
  parseStageParam,
  toGamePath,
} from "@/routes/routeUtils";
import { CROSSING_LEVEL_COUNT } from "@/services/board/handcraftedLevels";
import type { GameState } from "@/services/storage";

interface GameRouteProps {
  difficulty?: string;
}

interface NormalGameRouteProps {
  difficultySlug: string | undefined;
}

export default function GameRoute({ difficulty: difficultySlug }: Readonly<GameRouteProps>) {
  const gameMode = parseGameModeSlug(difficultySlug);
  if (gameMode === "Custom") {
    return <CustomGameRoute />;
  }
  if (gameMode === "Crossing") {
    return <CrossingGameRoute />;
  }

  return <NormalGameRoute difficultySlug={difficultySlug} />;
}

function CrossingGameRoute() {
  const { copy } = useAppSettings();
  const location = useLocation();
  const persistence = useGamePersistence();
  const savedState = persistence.activeState;

  const stageParam = new URL(location.url, "http://localhost").searchParams.get("stage");
  const savedCrossingStage =
    savedState?.difficulty === "Crossing" &&
    savedState.stage >= 1 &&
    savedState.stage <= CROSSING_LEVEL_COUNT
      ? savedState.stage
      : null;
  const latestUnlockedStage = persistence.getLatestUnlockedStage("Crossing");
  const savedUnlockedStage =
    savedCrossingStage !== null && savedCrossingStage <= latestUnlockedStage
      ? savedCrossingStage
      : null;
  const stage = parseStageParam(stageParam) ?? savedUnlockedStage ?? latestUnlockedStage;
  const targetPath = toGamePath("Crossing", stage);
  const stageLocked = persistence.isStageLocked("Crossing", stage);
  const lockedNotice = copy.game.stageLockedNotice;
  const stageRestore = persistence.isHydrated
    ? persistence.getStageRestore("Crossing", stage)
    : EMPTY_STAGE_RESTORE;

  useEffect(() => {
    if (!persistence.isHydrated) return;
    if (stage > CROSSING_LEVEL_COUNT) return;
    if (location.url !== targetPath && !stageLocked) location.route(targetPath, true);
  }, [location, persistence.isHydrated, stage, stageLocked, targetPath]);

  const handleBack = useCallback(() => {
    location.route("/");
  }, [location]);

  const handleWin = useCallback(
    (nextStage: number) => {
      if (nextStage > CROSSING_LEVEL_COUNT) return;
      persistence.setCurrentStage("Crossing", nextStage, { unlock: true });
      location.route(toGamePath("Crossing", nextStage));
    },
    [location, persistence],
  );

  const handleStageChange = useCallback(
    (nextStage: number) => {
      if (nextStage < 1 || nextStage > CROSSING_LEVEL_COUNT) return;
      if (nextStage > latestUnlockedStage) return;
      persistence.setCurrentStage("Crossing", nextStage);
      location.route(toGamePath("Crossing", nextStage));
    },
    [latestUnlockedStage, location, persistence],
  );

  const handleStateChange = useCallback(
    (state: GameState, context?: GameStateChangeContext) => {
      persistence.saveStageState(state, context);
      if (state.status === "won") {
        persistence.unlockStage("Crossing", Math.min(state.stage + 1, CROSSING_LEVEL_COUNT));
      }
    },
    [persistence],
  );

  if (stage > CROSSING_LEVEL_COUNT) return <NotFoundRoute />;

  if (!persistence.isHydrated) {
    return (
      <GameLoadingShell
        difficulty="Crossing"
        stage={stage}
        maxStage={latestUnlockedStage}
        onBack={handleBack}
        onStageChange={handleStageChange}
      />
    );
  }

  if (stageLocked) {
    return (
      <UnavailableLevelShell
        difficulty="Crossing"
        requestedStage={stage}
        availableStage={latestUnlockedStage}
        notice={lockedNotice}
        onBack={handleBack}
        onStageChange={handleStageChange}
        onReset={() => location.route(toGamePath("Crossing", latestUnlockedStage))}
        onLatestAvailable={() => location.route(toGamePath("Crossing", latestUnlockedStage))}
      />
    );
  }

  return (
    <Game
      key={`Crossing-${stage}`}
      difficulty="Crossing"
      stage={stage}
      maxStage={latestUnlockedStage}
      initialState={stageRestore.state}
      persistInitialState={stageRestore.persistInitialState}
      showNextLevelButton={stage < CROSSING_LEVEL_COUNT}
      onWin={handleWin}
      onBack={handleBack}
      onStageChange={handleStageChange}
      onStateChange={handleStateChange}
    />
  );
}

function NormalGameRoute({ difficultySlug }: Readonly<NormalGameRouteProps>) {
  const { copy } = useAppSettings();
  const location = useLocation();
  const persistence = useGamePersistence();
  const difficulty = parseDifficultySlug(difficultySlug);
  const savedState = difficulty ? persistence.activeState : null;
  const savedStateDifficulty =
    savedState?.difficulty === "Easy" ||
    savedState?.difficulty === "Medium" ||
    savedState?.difficulty === "Hard"
      ? savedState.difficulty
      : null;

  const { requestedStage, latestUnlockedStage, stageLocked, targetPath, shouldRedirect } =
    resolveNormalGameRouteState({
      difficulty,
      isClient: persistence.isHydrated,
      locationUrl: location.url,
      savedStateDifficulty,
      savedStateStage: savedState?.difficulty === difficulty ? savedState.stage : null,
      progress: persistence.progress,
    });
  const stage = requestedStage;
  const lockedNotice =
    difficulty && requestedStage && latestUnlockedStage ? copy.game.stageLockedNotice : undefined;
  const stageRestore =
    difficulty && stage && persistence.isHydrated
      ? persistence.getStageRestore(difficulty, stage)
      : EMPTY_STAGE_RESTORE;

  useEffect(() => {
    if (!shouldRedirect || !targetPath) return;
    location.route(targetPath, true);
  }, [location, shouldRedirect, targetPath]);

  const handleWin = useCallback(
    (nextStage: number) => {
      if (!difficulty) return;
      persistence.setCurrentStage(difficulty, nextStage, { unlock: true });
      location.route(toGamePath(difficulty, nextStage));
    },
    [difficulty, location, persistence],
  );

  const handleStageChange = useCallback(
    (nextStage: number) => {
      if (!difficulty) return;
      persistence.setCurrentStage(difficulty, nextStage);
      location.route(toGamePath(difficulty, nextStage));
    },
    [difficulty, location, persistence],
  );

  const handleBack = useCallback(() => {
    location.route("/");
  }, [location]);

  const handleStateChange = useCallback(
    (state: GameState, context?: GameStateChangeContext) => {
      if (!difficulty) return;
      persistence.saveStageState(state, context);
      if (state.status === "won") {
        persistence.unlockStage(difficulty, state.stage + 1);
      }
    },
    [difficulty, persistence],
  );

  if (!difficulty || !stage) return <NotFoundRoute />;

  if (!persistence.isHydrated) {
    return (
      <GameLoadingShell
        difficulty={difficulty}
        stage={stage}
        maxStage={persistence.progress[difficulty].max}
        onBack={handleBack}
        onStageChange={handleStageChange}
      />
    );
  }

  if (stageLocked && latestUnlockedStage) {
    return (
      <UnavailableLevelShell
        difficulty={difficulty}
        requestedStage={stage}
        availableStage={latestUnlockedStage}
        notice={lockedNotice || ""}
        onBack={handleBack}
        onStageChange={handleStageChange}
        onReset={() => location.route(toGamePath(difficulty, latestUnlockedStage))}
        onLatestAvailable={() => location.route(toGamePath(difficulty, latestUnlockedStage))}
      />
    );
  }

  return (
    <Game
      key={`${difficulty}-${stage}`}
      difficulty={difficulty}
      stage={stage}
      maxStage={persistence.progress[difficulty].max}
      initialState={stageRestore.state}
      persistInitialState={stageRestore.persistInitialState}
      showNextLevelButton
      onWin={handleWin}
      onBack={handleBack}
      onStageChange={handleStageChange}
      onStateChange={handleStateChange}
    />
  );
}
