import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { ErrorBoundary } from "preact-iso/lazy";
import { LocationProvider, Route, Router, useLocation } from "preact-iso/router";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ProgressBar } from "@/components/ProgressBar";
import { useLoading } from "@/hooks/useLoading";
import { GameRoute, MenuRoute, NotFoundRoute, preloadGameRoute } from "@/routes/lazyRoutes";
import { addBasePath, removeBasePath } from "@/routes/routeUtils";

function BasePathProvider({ children }: Readonly<{ children: ComponentChildren }>) {
  const location = useLocation();
  const value = useMemo(
    () => ({
      ...location,
      url: removeBasePath(location.url),
      path: removeBasePath(location.path),
      route: (url: string, replace?: boolean) => location.route(addBasePath(url), replace),
    }),
    [location],
  );

  return <LocationProvider.ctx.Provider value={value}>{children}</LocationProvider.ctx.Provider>;
}

export function App() {
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const isGlobalLoading = useLoading();
  const isLoading = isRouteLoading || isGlobalLoading;

  return (
    <LocationProvider>
      <BasePathProvider>
        <ErrorBoundary>
          <Router
            onLoadStart={() => setIsRouteLoading(true)}
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
          <ProgressBar isLoading={isLoading} />
          <LoadingSpinner isVisible={isLoading} />
        </ErrorBoundary>
      </BasePathProvider>
    </LocationProvider>
  );
}
