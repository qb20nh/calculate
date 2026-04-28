import hydrate from "preact-iso/hydrate";
import { App } from "@/App";
import { isGameRoutePreloaded, preloadGameRoute } from "@/routes/lazyRoutes";
import { removeBasePath } from "@/routes/routeUtils";
import {
  getSystemTheme,
  loadAppPreferences,
  resolveTheme,
  syncDocumentPreferences,
} from "@/services/preferences";
import "@/style.css";

import { loadingService } from "@/services/loading";

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
      const isGameRoute = /^\/game(?:\/|$)/.test(removeBasePath(pathname));

      if (isGameRoute && !isGameRoutePreloaded()) {
        loadingService.start("init");
        preloadGameRoute()
          .catch(() => {
            loadingService.stop("init");
          })
          .then(() => {
            hydrate(<App />, appElement);
          });
      } else {
        hydrate(<App />, appElement);
      }
    }
  }
} catch {
  // Silently ignore errors during build-time execution
}

export { App } from "@/App";
