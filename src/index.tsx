import hydrate from "preact-iso/hydrate";
import { App } from "@/App";
import { preloadGameRoute } from "@/routes/lazyRoutes";
import { removeBasePath } from "@/routes/routeUtils";
import "@/style.css";

import { loadingService } from "@/services/loading";

try {
  if (typeof window !== "undefined" && typeof document !== "undefined" && window.location) {
    const appElement = document.getElementById("app");
    if (appElement) {
      const pathname = window.location.pathname;
      const isGameRoute = /^\/game(?:\/|$)/.test(removeBasePath(pathname));

      if (isGameRoute) {
        loadingService.start("init");
        preloadGameRoute().then(() => {
          hydrate(<App />, appElement);
          loadingService.stop("init");
        });
      } else {
        hydrate(<App />, appElement);
      }
    }
  }
} catch (_e) {
  // Silently ignore errors during build-time execution
}

export { App } from "@/App";
