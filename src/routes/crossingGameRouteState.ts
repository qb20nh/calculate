import { parseStageParam, toGamePath } from "@/routes/routeUtils";
import { getLatestUnlockedStage, isStageLocked } from "@/services/progress";
import type { Progress } from "@/services/storage";

type CrossingGameRouteInput = {
  isClient: boolean;
  locationUrl: string;
  maxStage: number;
  progress: Progress;
  savedStateStage: number | null;
};

type CrossingGameRouteState = {
  requestedStage: number;
  latestUnlockedStage: number;
  stageLocked: boolean;
  targetPath: string;
  shouldRedirect: boolean;
  isNotFound: boolean;
};

export const resolveCrossingGameRouteState = (
  input: CrossingGameRouteInput,
): CrossingGameRouteState => {
  const stageParam = new URL(input.locationUrl, "http://localhost").searchParams.get("stage");
  const latestUnlockedStage = getLatestUnlockedStage(input.progress, "Crossing");
  const savedUnlockedStage =
    input.savedStateStage !== null && input.savedStateStage <= latestUnlockedStage
      ? input.savedStateStage
      : null;
  const requestedStage = parseStageParam(stageParam) ?? savedUnlockedStage ?? latestUnlockedStage;
  const targetPath = toGamePath("Crossing", requestedStage);
  const stageLocked = isStageLocked(input.progress, "Crossing", requestedStage);
  const isNotFound = requestedStage > input.maxStage;
  const shouldRedirect =
    input.isClient && !isNotFound && input.locationUrl !== targetPath && !stageLocked;

  return {
    requestedStage,
    latestUnlockedStage,
    stageLocked,
    targetPath,
    shouldRedirect,
    isNotFound,
  };
};
