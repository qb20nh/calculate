import { render } from "preact";
import hydrate from "preact-iso/hydrate";
import { App } from "@/App";
import { applyDeferredStylesheets, scheduleDeferredStylesheets } from "@/lib/deferredStylesheet";
import { isGameRoutePreloaded, preloadGameRoute } from "@/routes/lazyRoutes";
import { removeBasePath } from "@/routes/routeUtils";
import {
  getSystemTheme,
  loadAppPreferences,
  resolveTheme,
  syncDocumentPreferences,
} from "@/services/preferences";
import "@/style.css";

const isDynamicCustomGameRoute = (pathname: string, search: string) => {
  const routePath = removeBasePath(pathname).replace(/\/$/, "");
  return routePath === "/game/custom" && search.length > 0;
};

const mountApp = (appElement: HTMLElement, shouldHydrate: boolean) => {
  if (shouldHydrate) {
    hydrate(<App />, appElement);
    return;
  }

  appElement.textContent = "";
  render(<App />, appElement);
};

try {
  if (typeof window !== "undefined" && typeof document !== "undefined" && window.location) {
    const preferences = loadAppPreferences();
    syncDocumentPreferences(
      preferences,
      resolveTheme(preferences.theme, getSystemTheme() === "dark"),
    );

    const appElement = document.getElementById("app");
    if (appElement) {
      const pathname = window.location.pathname;
      const shouldHydrate = !isDynamicCustomGameRoute(pathname, window.location.search);
      const routePath = removeBasePath(pathname).replace(/\/$/, "");
      const shouldPreloadGameRoute = /^\/game\/(?:easy|medium|hard|crossing|custom)$/.test(
        routePath,
      );

      if (shouldPreloadGameRoute && !isGameRoutePreloaded()) {
        applyDeferredStylesheets();
        preloadGameRoute()
          .catch(() => undefined)
          .then(() => {
            mountApp(appElement, shouldHydrate);
          });
      } else {
        mountApp(appElement, shouldHydrate);
        scheduleDeferredStylesheets();
      }
    }
  }
} catch {
  // Silently ignore errors during build-time execution
}

export { App } from "@/App";
