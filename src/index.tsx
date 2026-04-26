import { hydrate } from "preact-iso";
import { App } from "@/App";
import { removeBasePath } from "@/routes/routeUtils";
import { preloadGameRoute } from "@/routes/lazyRoutes";
import "@/style.css";

if (typeof window !== "undefined") {
  const appElement = document.getElementById("app");
  if (appElement) {
    const isGameRoute = /^\/game(?:\/|$)/.test(removeBasePath(window.location.pathname));

    if (isGameRoute) {
      preloadGameRoute().then(() => hydrate(<App />, appElement));
    } else {
      hydrate(<App />, appElement);
    }
  }
}

export { App } from "@/App";
