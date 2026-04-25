import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { MainMenu } from "@/components/MainMenu";
import { toGamePath } from "@/routes/routeUtils";
import type { Difficulty } from "@/services/storage";
import { loadProgress } from "@/services/storage";

interface MenuRouteProps {
  onGameRoutePreload?: () => Promise<unknown>;
}

export default function MenuRoute({ onGameRoutePreload }: MenuRouteProps) {
  const location = useLocation();
  const [progress] = useState(loadProgress);

  const handleStart = (difficulty: Difficulty) => {
    location.route(toGamePath(difficulty, progress[difficulty].current));
  };

  const handleStartIntent = () => {
    void onGameRoutePreload?.();
  };

  return <MainMenu onStart={handleStart} onStartIntent={handleStartIntent} progress={progress} />;
}
