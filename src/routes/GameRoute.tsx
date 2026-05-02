import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game, GameLoadingShell, UnavailableLevelShell } from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
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
import {
  advanceProgress,
  getLatestUnlockedStage,
  isStageLocked,
  unlockStage,
} from "@/services/progress";
import {
  DEFAULT_PROGRESS,
  type GameState,
  loadGameState,
  loadProgress,
  type Progress,
  saveGameState,
  saveProgress,
} from "@/services/storage";

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
  const [isClient, setIsClient] = useState(false);
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);

  useEffect(() => {
    setIsClient(true);
    setProgress(loadProgress());
  }, []);

  const savedState = useMemo<GameState | null>(() => {
    if (!isClient) return null;
    return loadGameState();
  }, [isClient]);

  const stageParam = new URL(location.url, "http://localhost").searchParams.get("stage");
  const savedCrossingStage =
    savedState?.difficulty === "Crossing" &&
    savedState.stage >= 1 &&
    savedState.stage <= CROSSING_LEVEL_COUNT
      ? savedState.stage
      : null;
  const latestUnlockedStage = getLatestUnlockedStage(progress, "Crossing");
  const savedUnlockedStage =
    savedCrossingStage !== null && savedCrossingStage <= latestUnlockedStage
      ? savedCrossingStage
      : null;
  const stage = parseStageParam(stageParam) ?? savedUnlockedStage ?? latestUnlockedStage;
  const targetPath = toGamePath("Crossing", stage);
  const stageLocked = isStageLocked(progress, "Crossing", stage);
  const lockedNotice = copy.game.stageLockedNotice;

  useEffect(() => {
    if (stage > CROSSING_LEVEL_COUNT) return;
    if (location.url !== targetPath && !stageLocked) location.route(targetPath, true);
  }, [location, stage, stageLocked, targetPath]);

  const initialGameState = useMemo<GameState | null>(() => {
    if (savedState?.difficulty !== "Crossing" || savedState.stage !== stage) return null;
    return savedState;
  }, [savedState, stage]);

  const handleBack = useCallback(() => {
    saveGameState(null);
    location.route("/");
  }, [location]);

  const updateProgress = useCallback((nextStage: number, includeMax: boolean) => {
    setProgress((prev) => {
      const nextProgress = advanceProgress(
        prev,
        "Crossing",
        nextStage,
        includeMax && nextStage <= CROSSING_LEVEL_COUNT,
      );
      saveProgress(nextProgress);
      return nextProgress;
    });
  }, []);

  const updateMaxProgress = useCallback((newMax: number) => {
    setProgress((prev) => {
      const nextProgress = unlockStage(prev, "Crossing", Math.min(newMax, CROSSING_LEVEL_COUNT));
      saveProgress(nextProgress);
      return nextProgress;
    });
  }, []);

  const handleWin = useCallback(
    (nextStage: number) => {
      if (nextStage > CROSSING_LEVEL_COUNT) return;
      updateProgress(nextStage, true);
      location.route(toGamePath("Crossing", nextStage));
    },
    [location, updateProgress],
  );

  const handleStageChange = useCallback(
    (nextStage: number) => {
      if (nextStage < 1 || nextStage > CROSSING_LEVEL_COUNT) return;
      if (nextStage > latestUnlockedStage) return;
      updateProgress(nextStage, false);
      location.route(toGamePath("Crossing", nextStage));
    },
    [latestUnlockedStage, location, updateProgress],
  );

  const handleStateChange = useCallback(
    (state: GameState) => {
      saveGameState(state);
      if (state.status === "won") updateMaxProgress(state.stage + 1);
    },
    [updateMaxProgress],
  );

  if (stage > CROSSING_LEVEL_COUNT) return <NotFoundRoute />;

  if (!isClient) {
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
      initialState={initialGameState}
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
  const difficulty = parseDifficultySlug(difficultySlug);

  const [isClient, setIsClient] = useState(false);
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);

  useEffect(() => {
    setIsClient(true);
    setProgress(loadProgress());
  }, []);

  const savedState = useMemo<GameState | null>(() => {
    if (!difficulty || !isClient) return null;
    return loadGameState();
  }, [difficulty, isClient]);
  const savedStateDifficulty =
    savedState?.difficulty === "Easy" ||
    savedState?.difficulty === "Medium" ||
    savedState?.difficulty === "Hard"
      ? savedState.difficulty
      : null;

  const { requestedStage, latestUnlockedStage, stageLocked, targetPath, shouldRedirect } =
    resolveNormalGameRouteState({
      difficulty,
      isClient,
      locationUrl: location.url,
      savedStateDifficulty,
      savedStateStage: savedState?.difficulty === difficulty ? savedState.stage : null,
      progress,
    });
  const stage = requestedStage;
  const lockedNotice =
    difficulty && requestedStage && latestUnlockedStage ? copy.game.stageLockedNotice : undefined;

  useEffect(() => {
    if (!shouldRedirect || !targetPath) return;
    location.route(targetPath, true);
  }, [location, shouldRedirect, targetPath]);

  const initialGameState = useMemo<GameState | null>(() => {
    if (!difficulty || !stage) return null;
    if (savedState?.difficulty !== difficulty || savedState.stage !== stage) return null;
    return savedState;
  }, [difficulty, savedState, stage]);

  const updateProgress = useCallback(
    (nextStage: number, includeMax: boolean) => {
      if (!difficulty) return;
      setProgress((prev) => {
        const nextProgress = advanceProgress(prev, difficulty, nextStage, includeMax);
        saveProgress(nextProgress);
        return nextProgress;
      });
    },
    [difficulty],
  );

  const updateMaxProgress = useCallback(
    (newMax: number) => {
      if (!difficulty) return;
      setProgress((prev) => {
        const nextProgress = unlockStage(prev, difficulty, newMax);
        saveProgress(nextProgress);
        return nextProgress;
      });
    },
    [difficulty],
  );

  const handleWin = useCallback(
    (nextStage: number) => {
      if (!difficulty) return;
      updateProgress(nextStage, true);
      location.route(toGamePath(difficulty, nextStage));
    },
    [difficulty, location, updateProgress],
  );

  const handleStageChange = useCallback(
    (nextStage: number) => {
      if (!difficulty) return;
      updateProgress(nextStage, false);
      location.route(toGamePath(difficulty, nextStage));
    },
    [difficulty, location, updateProgress],
  );

  const handleBack = useCallback(() => {
    saveGameState(null);
    location.route("/");
  }, [location]);

  const handleStateChange = useCallback(
    (state: GameState) => {
      saveGameState(state);
      if (state.status === "won") {
        updateMaxProgress(state.stage + 1);
      }
    },
    [updateMaxProgress],
  );

  if (!difficulty || !stage) return <NotFoundRoute />;

  if (!isClient) {
    return (
      <GameLoadingShell
        difficulty={difficulty}
        stage={stage}
        maxStage={progress[difficulty].max}
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
      maxStage={progress[difficulty].max}
      initialState={initialGameState}
      showNextLevelButton
      onWin={handleWin}
      onBack={handleBack}
      onStageChange={handleStageChange}
      onStateChange={handleStateChange}
    />
  );
}
