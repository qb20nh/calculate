import lazy from "preact-iso/lazy";

export const MenuRoute = lazy(() => import("@/routes/MenuRoute"));
export const GameRoute = lazy(() => import("@/routes/GameRoute"));
export const NotFoundRoute = lazy(() => import("@/routes/NotFoundRoute"));

let gameRoutePreloaded = false;

export const isGameRoutePreloaded = () => gameRoutePreloaded;

export const preloadGameRoute = () =>
  GameRoute.preload().then((module) => {
    gameRoutePreloaded = true;
    return module;
  });
