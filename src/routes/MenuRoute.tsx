import { useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { MainMenu } from "@/components/MainMenu";
import { toGamePath } from "@/routes/routeUtils";
import type { GameMode } from "@/services/storage";
import { loadProgress } from "@/services/storage";

interface MenuRouteProps {
  onGameRoutePreload?: () => Promise<unknown>;
}

export default function MenuRoute({ onGameRoutePreload }: Readonly<MenuRouteProps>) {
  const location = useLocation();
  const [progress] = useState(loadProgress);

  const handleStart = (mode: GameMode) => {
    if (mode === "Custom") {
      location.route("/game/custom");
      return;
    }
    location.route(toGamePath(mode, progress[mode].current));
  };

  const handleStartIntent = (_mode: GameMode) => {
    void onGameRoutePreload?.();
  };

  return <MainMenu onStart={handleStart} onStartIntent={handleStartIntent} progress={progress} />;
}
