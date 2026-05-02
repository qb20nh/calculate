import { toGamePath } from "@/routes/routeUtils";
import { getLatestUnlockedStage } from "@/services/progress";
import type { GameMode, Progress } from "@/services/storage";

type MenuRouteInput = {
  mode: GameMode;
  progress: Progress;
};

export const resolveMenuRoute = ({ mode, progress }: MenuRouteInput): string => {
  if (mode === "Custom") {
    return "/game/custom";
  }
  if (mode === "Crossing") {
    return toGamePath(mode, getLatestUnlockedStage(progress, mode));
  }
  return toGamePath(mode, getLatestUnlockedStage(progress, mode));
};
