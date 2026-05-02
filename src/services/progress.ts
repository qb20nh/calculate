import {
  DEFAULT_PROGRESS,
  type Difficulty,
  type Progress,
  type ProgressMode,
} from "@/services/storage";

const getProgressEntry = (progress: Progress, mode: ProgressMode) =>
  progress[mode] ?? DEFAULT_PROGRESS[mode];

export const getLatestUnlockedStage = (
  progress: Progress,
  difficulty: ProgressMode | null,
): number => {
  if (!difficulty) return 1;
  return getProgressEntry(progress, difficulty).max;
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
  difficulty: ProgressMode | null,
  requestedStage: number | null,
) => {
  if (!difficulty || requestedStage === null) return false;
  const latest = getProgressEntry(progress, difficulty).max;
  return requestedStage > latest;
};

export const advanceProgress = (
  progress: Progress,
  difficulty: ProgressMode,
  nextStage: number,
  includeMax: boolean,
): Progress => {
  const currentProgress = getProgressEntry(progress, difficulty);
  const nextMax = includeMax ? Math.max(currentProgress.max, nextStage) : currentProgress.max;
  if (currentProgress.current === nextStage && currentProgress.max === nextMax) return progress;

  return {
    ...progress,
    [difficulty]: {
      ...currentProgress,
      current: nextStage,
      max: nextMax,
    },
  } as Progress;
};

export const unlockStage = (
  progress: Progress,
  difficulty: ProgressMode,
  unlockedStage: number,
): Progress => {
  const currentProgress = getProgressEntry(progress, difficulty);
  if (unlockedStage <= currentProgress.max) return progress;

  return {
    ...progress,
    [difficulty]: {
      ...currentProgress,
      max: unlockedStage,
    },
  } as Progress;
};
