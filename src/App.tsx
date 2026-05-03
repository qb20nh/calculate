import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ErrorBoundary } from "preact-iso/lazy";
import { LocationProvider, Route, Router, useLocation } from "preact-iso/router";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ProgressBar } from "@/components/ProgressBar";
import { reportAppRenderError } from "@/hooks/useAppReadinessSignal";
import { useLoading } from "@/hooks/useLoading";
import { AppSettingsProvider } from "@/lib/appSettings";
import { applyDeferredStylesheets, ensureDeferredStylesheets } from "@/lib/deferredStylesheet";
import { GamePersistenceProvider } from "@/lib/gamePersistence";
import { GameRoute, MenuRoute, NotFoundRoute, preloadGameRoute } from "@/routes/lazyRoutes";
import { addBasePath, removeBasePath } from "@/routes/routeUtils";
import { loadingService, ROUTE_TRANSITION_LOADING_KEY } from "@/services/loading";

const isMenuUrl = (url: string) => (removeBasePath(url).replace(/\/$/, "") || "/") === "/";
const isMenuPath = (path: string) => (removeBasePath(path).replace(/\/$/, "") || "/") === "/";

const isBrowserMenuPath = () =>
  typeof window !== "undefined" && window.location ? isMenuPath(window.location.pathname) : false;

const routeAfterLoadingPaint = (route: () => void) => {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    setTimeout(route, 0);
    return;
  }

  window.requestAnimationFrame(() => {
    setTimeout(route, 0);
  });
};

function BasePathProvider({ children }: Readonly<{ children: ComponentChildren }>) {
  const location = useLocation();
  const value = useMemo(
    () => ({
      ...location,
      url: removeBasePath(location.url),
      path: removeBasePath(location.path),
      route: (url: string, replace?: boolean) => {
        const nextUrl = addBasePath(url);
        if (isMenuUrl(url)) {
          loadingService.start(ROUTE_TRANSITION_LOADING_KEY);
          applyDeferredStylesheets();
          routeAfterLoadingPaint(() => location.route(nextUrl, replace));
          return;
        }
        applyDeferredStylesheets();
        return location.route(nextUrl, replace);
      },
    }),
    [location],
  );

  return <LocationProvider.ctx.Provider value={value}>{children}</LocationProvider.ctx.Provider>;
}

function AppRoutes({
  hasHydrated,
  hasMounted,
  setIsRouteLoading,
}: Readonly<{
  hasHydrated: boolean;
  hasMounted: { current: boolean };
  setIsRouteLoading: (isLoading: boolean) => void;
}>) {
  const location = useLocation();
  if (!hasHydrated && isMenuPath(location.path)) return null;

  return (
    <Router
      onLoadStart={() => {
        applyDeferredStylesheets();
        if (hasMounted.current) {
          setIsRouteLoading(true);
        }
      }}
      onLoadEnd={() => setIsRouteLoading(false)}
    >
      <Route path="/" component={MenuRoute} onGameRoutePreload={preloadGameRoute} />
      <Route path="/game" component={NotFoundRoute} />
      <Route path="/game/" component={NotFoundRoute} />
      <Route path="/game/:difficulty" component={GameRoute} />
      <Route path="/game/:difficulty/" component={GameRoute} />
      <Route path="/404" component={NotFoundRoute} />
      <Route default component={NotFoundRoute} />
    </Router>
  );
}

export function App() {
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const hasMounted = useRef(false);
  const isGlobalLoading = useLoading();
  const isLoading = !hasHydrated || isRouteLoading || isGlobalLoading;

  useEffect(() => {
    let isCancelled = false;
    hasMounted.current = true;

    const revealApp = () => {
      if (isCancelled) return;
      setHasHydrated(true);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.appReady = "true";
      }
    };

    if (isBrowserMenuPath()) {
      applyDeferredStylesheets();
      void (ensureDeferredStylesheets() ?? Promise.resolve()).then(revealApp, revealApp);
    } else {
      revealApp();
    }

    return () => {
      isCancelled = true;
      if (typeof document !== "undefined") {
        delete document.documentElement.dataset.appReady;
      }
    };
  }, []);

  return (
    <AppSettingsProvider>
      <GamePersistenceProvider>
        <LocationProvider>
          <BasePathProvider>
            <ErrorBoundary onError={reportAppRenderError}>
              <AppRoutes
                hasHydrated={hasHydrated}
                hasMounted={hasMounted}
                setIsRouteLoading={setIsRouteLoading}
              />
              <ProgressBar isLoading={isLoading} />
              <LoadingSpinner isVisible={isLoading} />
            </ErrorBoundary>
          </BasePathProvider>
        </LocationProvider>
      </GamePersistenceProvider>
    </AppSettingsProvider>
  );
}
