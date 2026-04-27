import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game, GameLoadingShell, UnavailableLevelShell } from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
import CustomGameRoute from "@/routes/CustomGameRoute";
import NotFoundRoute from "@/routes/NotFoundRoute";
import {
  parseDifficultySlug,
  parseGameModeSlug,
  parseStageParam,
  toGamePath,
} from "@/routes/routeUtils";
import {
  DEFAULT_PROGRESS,
  type GameState,
  loadGameState,
  loadProgress,
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

  return <NormalGameRoute difficultySlug={difficultySlug} />;
}

function NormalGameRoute({ difficultySlug }: Readonly<NormalGameRouteProps>) {
  const { copy } = useAppSettings();
  const location = useLocation();
  const difficulty = parseDifficultySlug(difficultySlug);
  const stageParam = new URL(location.url, "http://localhost").searchParams.get("stage");
  const parsedStage = parseStageParam(stageParam);

  const [isClient, setIsClient] = useState(false);
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);

  useEffect(() => {
    setIsClient(true);
    setProgress(loadProgress());
  }, []);

  const savedState = useMemo<GameState | null>(() => {
    if (!difficulty || !isClient) return null;
    return loadGameState();
  }, [difficulty, isClient]);

  const difficultyProgress = difficulty ? progress[difficulty] : null;
  const requestedStage =
    difficulty && stageParam === null
      ? ((savedState?.difficulty === difficulty ? savedState.stage : null) ??
        difficultyProgress?.current ??
        1)
      : parsedStage;
  const latestAvailableStage = difficultyProgress?.max ?? null;
  const isStageLocked =
    difficulty !== null &&
    requestedStage !== null &&
    difficultyProgress !== null &&
    requestedStage > difficultyProgress.max;
  const stage = requestedStage;
  const targetPath = difficulty && stage ? toGamePath(difficulty, stage) : null;
  const shouldRedirect =
    isClient && targetPath !== null && location.url !== targetPath && !isStageLocked;
  const lockedNotice =
    difficulty && requestedStage && latestAvailableStage ? copy.game.stageLockedNotice : undefined;

  useEffect(() => {
    if (!shouldRedirect || !targetPath) return;
    location.route(targetPath, true);
  }, [location, shouldRedirect, targetPath]);

  const initialGameState = useMemo<GameState | null>(() => {
    if (!difficulty || !stage) return null;
    if (savedState?.difficulty !== difficulty || savedState.stage !== stage) return null;
    return savedState;
  }, [difficulty, savedState, stage]);

  if (!difficulty || !stage) return <NotFoundRoute />;

  const updateProgress = useCallback(
    (nextStage: number, includeMax: boolean) => {
      setProgress((prev) => {
        const currentProgress = prev[difficulty];
        const nextProgress = {
          ...prev,
          [difficulty]: {
            current: nextStage,
            max: includeMax ? Math.max(currentProgress.max, nextStage) : currentProgress.max,
          },
        };
        saveProgress(nextProgress);
        return nextProgress;
      });
    },
    [difficulty],
  );

  const updateMaxProgress = useCallback(
    (newMax: number) => {
      setProgress((prev) => {
        const currentProgress = prev[difficulty];
        if (newMax <= currentProgress.max) return prev;
        const nextProgress = {
          ...prev,
          [difficulty]: {
            ...currentProgress,
            max: newMax,
          },
        };
        saveProgress(nextProgress);
        return nextProgress;
      });
    },
    [difficulty],
  );

  const handleWin = useCallback(
    (nextStage: number) => {
      updateProgress(nextStage, true);
      location.route(toGamePath(difficulty, nextStage));
    },
    [difficulty, location, updateProgress],
  );

  const handleStageChange = useCallback(
    (nextStage: number) => {
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

  if (isStageLocked && latestAvailableStage) {
    return (
      <UnavailableLevelShell
        difficulty={difficulty}
        requestedStage={stage}
        availableStage={latestAvailableStage}
        notice={lockedNotice || ""}
        onBack={handleBack}
        onStageChange={handleStageChange}
        onReset={() => location.route(toGamePath(difficulty, latestAvailableStage))}
        onLatestAvailable={() => location.route(toGamePath(difficulty, latestAvailableStage))}
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
