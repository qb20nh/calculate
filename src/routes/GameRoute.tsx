import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game, GameLoadingShell, UnavailableLevelShell } from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
import CustomGameRoute from "@/routes/CustomGameRoute";
import NotFoundRoute from "@/routes/NotFoundRoute";
import { resolveNormalGameRouteState } from "@/routes/normalGameRouteState";
import { parseDifficultySlug, parseGameModeSlug, toGamePath } from "@/routes/routeUtils";
import { advanceProgress, unlockStage } from "@/services/progress";
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

  const { requestedStage, latestUnlockedStage, stageLocked, targetPath, shouldRedirect } =
    resolveNormalGameRouteState({
      difficulty,
      isClient,
      locationUrl: location.url,
      savedStateDifficulty:
        savedState?.difficulty === "Custom" ? null : (savedState?.difficulty ?? null),
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
