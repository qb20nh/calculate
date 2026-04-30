import type { Difficulty, Progress } from "@/services/storage";

export const getLatestUnlockedStage = (
  progress: Progress,
  difficulty: Difficulty | null,
): number => {
  if (!difficulty) return 1;
  return progress[difficulty].max;
};

export const resolveRequestedStage = ({
  difficulty,
  explicitStage,
  isClient,
  savedStateDifficulty,
  savedStateStage,
  currentProgress,
  allowFallbackToCurrent = true,
}: {
  difficulty: Difficulty | null;
  explicitStage: number | null;
  isClient: boolean;
  savedStateDifficulty: Difficulty | null;
  savedStateStage: number | null;
  currentProgress: Progress[Difficulty] | null;
  allowFallbackToCurrent?: boolean;
}): number | null => {
  if (!difficulty) return null;
  if (explicitStage !== null) return explicitStage;
  if (!allowFallbackToCurrent) return null;
  if (!isClient) return currentProgress?.current ?? null;

  if (savedStateDifficulty === difficulty && savedStateStage !== null) {
    return savedStateStage;
  }

  return currentProgress?.current ?? 1;
};

export const isStageLocked = (
  progress: Progress,
  difficulty: Difficulty | null,
  requestedStage: number | null,
) => {
  if (!difficulty || requestedStage === null) return false;
  const latest = progress[difficulty]?.max;
  if (latest === undefined || latest === null) return false;
  return requestedStage > latest;
};

export const advanceProgress = (
  progress: Progress,
  difficulty: Difficulty,
  nextStage: number,
  includeMax: boolean,
): Progress => {
  const currentProgress = progress[difficulty];
  const nextMax = includeMax ? Math.max(currentProgress.max, nextStage) : currentProgress.max;
  if (currentProgress.current === nextStage && currentProgress.max === nextMax) return progress;

  return {
    ...progress,
    [difficulty]: {
      ...currentProgress,
      current: nextStage,
      max: nextMax,
    },
  };
};

export const unlockStage = (
  progress: Progress,
  difficulty: Difficulty,
  unlockedStage: number,
): Progress => {
  const currentProgress = progress[difficulty];
  if (unlockedStage <= currentProgress.max) return progress;

  return {
    ...progress,
    [difficulty]: {
      ...currentProgress,
      max: unlockedStage,
    },
  };
};
