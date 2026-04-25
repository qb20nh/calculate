import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { Game, GameLoadingShell } from "@/components/Game";
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
  stage?: string;
}

export default function GameRoute({
  difficulty: difficultySlug,
  stage: stageParam,
}: GameRouteProps) {
  const location = useLocation();
  const difficulty = parseDifficultySlug(difficultySlug);
  const parsedStage = parseStageParam(stageParam);
  const [progress, setProgress] = useState(loadProgress);

  const savedState = useMemo<GameState | null>(() => {
    if (!difficulty) return null;
    return loadGameState();
  }, [difficulty]);

  const requestedStage =
    difficulty && stageParam === undefined
      ? ((savedState?.difficulty === difficulty ? savedState.stage : null) ??
        progress[difficulty].current)
      : parsedStage;
  const isStageLocked =
    difficulty !== null && requestedStage !== null && requestedStage > progress[difficulty].max;
  const stage = isStageLocked && difficulty ? progress[difficulty].max : requestedStage;

  const targetPath = difficulty && stage ? toGamePath(difficulty, stage) : null;
  const shouldRedirect = targetPath !== null && location.path !== targetPath;
  const lockedNotice =
    difficulty && requestedStage && stage && isStageLocked
      ? `Stage ${requestedStage} is locked. Returning to ${difficulty} — Stage ${stage}.`
      : undefined;

  useEffect(() => {
    if (!shouldRedirect) return;

    if (!isStageLocked) {
      location.route(targetPath, true);
      return;
    }

    const timer = setTimeout(() => location.route(targetPath, true), 1200);
    return () => clearTimeout(timer);
  }, [isStageLocked, location, shouldRedirect, targetPath]);

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

  if (shouldRedirect) {
    return (
      <GameLoadingShell
        difficulty={difficulty}
        stage={stage}
        maxStage={progress[difficulty].max}
        {...(lockedNotice ? { notice: lockedNotice } : {})}
        onBack={handleBack}
        onStageChange={handleStageChange}
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
