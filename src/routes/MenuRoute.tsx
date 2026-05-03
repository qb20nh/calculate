import { useLocation } from "preact-iso/router";
import { AppChrome } from "@/components/AppChrome";
import { MainMenu } from "@/components/MainMenu";
import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { ensureDeferredStylesheets } from "@/lib/deferredStylesheet";
import { useGamePersistence } from "@/lib/gamePersistence";
import { resolveMenuRoute } from "@/routes/menuRouteState";
import { loadingService } from "@/services/loading";
import type { GameMode } from "@/services/storage";

interface MenuRouteProps {
  onGameRoutePreload?: () => Promise<unknown>;
}

export default function MenuRoute({ onGameRoutePreload }: Readonly<MenuRouteProps>) {
  const location = useLocation();
  const { progress } = useGamePersistence();
  useAppReadinessSignal(true, "menu");

  const handleStart = (mode: GameMode) => {
    const routeToGame = () => {
      const routeTo = resolveMenuRoute({ mode, progress });
      location.route(routeTo);
    };

    const readyPromises = [ensureDeferredStylesheets(), onGameRoutePreload?.()].filter(
      (promise): promise is Promise<unknown> => promise !== undefined,
    );
    if (readyPromises.length === 0) {
      routeToGame();
      return;
    }

    loadingService.start("route-styles");
    void Promise.allSettled(readyPromises).then(() => {
      routeToGame();
      loadingService.stop("route-styles");
    });
  };

  const handleStartIntent = (_mode: GameMode) => {
    void ensureDeferredStylesheets();
    void onGameRoutePreload?.();
  };

  return (
    <>
      <AppChrome />
      <MainMenu onStart={handleStart} onStartIntent={handleStartIntent} progress={progress} />
    </>
  );
}
