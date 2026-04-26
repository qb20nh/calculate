import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { Game, UnavailableLevelShell } from "@/components/Game";
import NotFoundRoute from "@/routes/NotFoundRoute";
import { parseDifficultySlug, parseStageParam, toGamePath } from "@/routes/routeUtils";
import {
  type GameState,
  loadGameState,
  loadProgress,
  saveGameState,
  saveProgress,
} from "@/services/storage";

interface GameRouteProps {
  difficulty?: string;
}

export default function GameRoute({ difficulty: difficultySlug }: Readonly<GameRouteProps>) {
  const location = useLocation();
  const difficulty = parseDifficultySlug(difficultySlug);
  const stageParam = new URL(location.url, "http://localhost").searchParams.get("stage");
  const parsedStage = parseStageParam(stageParam);
  const [progress, setProgress] = useState(loadProgress);

  const savedState = useMemo<GameState | null>(() => {
    if (!difficulty) return null;
    return loadGameState();
  }, [difficulty]);

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
  const shouldRedirect = targetPath !== null && location.url !== targetPath && !isStageLocked;
  const lockedNotice =
    difficulty && requestedStage && latestAvailableStage
      ? `Stage ${requestedStage} is locked. Latest available is ${difficulty} — Stage ${latestAvailableStage}.`
      : undefined;

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

  const updateProgress = (nextStage: number, includeMax: boolean) => {
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
  };

  const handleWin = (nextStage: number) => {
    updateProgress(nextStage, true);
    location.route(toGamePath(difficulty, nextStage));
  };

  const handleStageChange = (nextStage: number) => {
    updateProgress(nextStage, false);
    location.route(toGamePath(difficulty, nextStage));
  };

  const handleBack = () => {
    saveGameState(null);
    location.route("/");
  };

  const handleStateChange = (state: GameState) => {
    saveGameState(state);
  };

  if (isStageLocked && latestAvailableStage) {
    return (
      <UnavailableLevelShell
        difficulty={difficulty}
        requestedStage={stage}
        availableStage={latestAvailableStage}
        notice={lockedNotice || ""}
        onBack={handleBack}
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
      onWin={handleWin}
      onBack={handleBack}
      onStageChange={handleStageChange}
      onStateChange={handleStateChange}
    />
  );
}
