import lazy from "preact-iso/lazy";
import MenuRouteComponent from "@/routes/MenuRoute";

export const MenuRoute = MenuRouteComponent;
export const GameRoute = lazy(() => import("@/routes/GameRoute"));
export const NotFoundRoute = lazy(() => import("@/routes/NotFoundRoute"));

let gameRoutePreloaded = false;
let gameRoutePreloadPromise: Promise<unknown> | null = null;

export const isGameRoutePreloaded = () => gameRoutePreloaded;

export const preloadGameRoute = () => {
  if (gameRoutePreloaded) return Promise.resolve();
  gameRoutePreloadPromise ??= GameRoute.preload()
    .then((module) => {
      gameRoutePreloaded = true;
      return module;
    })
    .catch((error: unknown) => {
      gameRoutePreloadPromise = null;
      throw error;
    });
  return gameRoutePreloadPromise;
};
