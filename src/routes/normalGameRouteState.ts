import { parseStageParam, toGamePath } from "@/routes/routeUtils";
import { getLatestUnlockedStage, isStageLocked, resolveRequestedStage } from "@/services/progress";
import type { Difficulty, Progress } from "@/services/storage";

type RouteInput = {
  difficulty: Difficulty | null;
  isClient: boolean;
  locationUrl: string;
  savedStateDifficulty: Difficulty | null;
  savedStateStage: number | null;
  progress: Progress;
};

type NormalGameRouteState = {
  requestedStage: number | null;
  latestUnlockedStage: number;
  stageLocked: boolean;
  targetPath: string | null;
  shouldRedirect: boolean;
};

export const resolveNormalGameRouteState = (input: RouteInput): NormalGameRouteState => {
  const stageParam = new URL(input.locationUrl, "http://localhost").searchParams.get("stage");
  const stageNum = stageParam === null ? null : Number(stageParam);
  const isExplicitNonPositiveStage = stageParam !== null && stageNum !== null && stageNum <= 0;
  const requestedStage = resolveRequestedStage({
    difficulty: input.difficulty,
    explicitStage: parseStageParam(stageParam),
    isClient: input.isClient,
    savedStateDifficulty: input.savedStateDifficulty,
    savedStateStage: input.savedStateStage,
    currentProgress: input.difficulty ? input.progress[input.difficulty] : null,
    allowFallbackToCurrent: !isExplicitNonPositiveStage,
  });
  const latestUnlockedStage = getLatestUnlockedStage(input.progress, input.difficulty);
  const stageLocked = isStageLocked(input.progress, input.difficulty, requestedStage);
  const targetPath =
    input.difficulty && requestedStage ? toGamePath(input.difficulty, requestedStage) : null;
  const shouldRedirect =
    input.isClient && targetPath !== null && input.locationUrl !== targetPath && !stageLocked;

  return {
    requestedStage,
    latestUnlockedStage,
    stageLocked,
    targetPath,
    shouldRedirect,
  };
};
