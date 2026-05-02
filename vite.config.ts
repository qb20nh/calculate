import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig, type Plugin } from "vite";
import { emitCleanRouteHtmlPlugin } from "./build/emitCleanRouteHtmlPlugin";
import { injectLoadingScriptPlugin } from "./build/injectLoadingScriptPlugin";
import { injectSkeletonPlugin } from "./build/injectSkeletonPlugin";
import { injectTranslationsPlugin } from "./build/injectTranslationsPlugin";
import { legacyPrerenderPlugin } from "./build/legacyPrerenderPlugin";
import { optimizeRootInitialLoadPlugin } from "./build/optimizeRootInitialLoadPlugin";

const isLegacyBuild = process.env.CALCULATE_LEGACY_BUILD === "1";
const prerenderScript = fileURLToPath(new URL("./src/prerender.tsx", import.meta.url));
const srcRoot = fileURLToPath(new URL("./src", import.meta.url)).replaceAll("\\", "/");
const appCoreModules = new Set(
  [
    "App.tsx",
    "components/AppChrome.tsx",
    "components/LoadingSpinner.tsx",
    "components/MainMenu.tsx",
    "components/ProgressBar.tsx",
    "hooks/useAppReadinessSignal.ts",
    "hooks/useProgressBar.ts",
    "index.tsx",
    "lib/appSettings.tsx",
    "lib/i18n.ts",
    "lib/preferences.ts",
    "routes/MenuRoute.tsx",
    "routes/lazyRoutes.ts",
    "routes/routeUtils.ts",
    "services/loading.ts",
    "services/preferences.ts",
    "services/storage.ts",
  ].map((path) => `${srcRoot}/${path}`),
);

const isPrerenderOnlyModule = (id: string) => {
  const normalizedId = id.replaceAll("\\", "/");
  return (
    normalizedId === prerenderScript.replaceAll("\\", "/") ||
    normalizedId.includes("/preact-iso/prerender") ||
    normalizedId.includes("/preact-render-to-string/")
  );
};

const isAppCoreModule = (id: string) => {
  const normalizedId = id.replaceAll("\\", "/");
  return (
    appCoreModules.has(normalizedId) ||
    normalizedId.includes("/node_modules/lucide-preact/") ||
    normalizedId.includes("/node_modules/preact/") ||
    normalizedId.includes("/node_modules/preact-iso/lazy") ||
    normalizedId.includes("/node_modules/preact-iso/router")
  );
};

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const prerender = isBuild && !isLegacyBuild;
  const base = process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/`
    : "/";

  return {
    base,
    build: {
      modulePreload: {
        resolveDependencies(_, deps, context) {
          if (context.hostType !== "html") return deps;
          return deps.filter((dep) => !dep.startsWith("assets/prerender-"));
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (isLegacyBuild) return;
            if (isPrerenderOnlyModule(id)) return "prerender-ssr";
            if (isAppCoreModule(id)) return "app-core";
          },
        },
      },
    },
    plugins: [
      preact({
        prerender: {
          enabled: !!prerender,
          renderTarget: "#app",
          prerenderScript,
          additionalPrerenderRoutes: [
            "/404",
            "/game",
            "/game/easy",
            "/game/medium",
            "/game/hard",
            "/game/crossing",
            "/game/custom",
          ],
          previewMiddlewareEnabled: false,
        },
      }),
      ...(isLegacyBuild ? [legacy()] : [legacyPrerenderPlugin()]),
      !isLegacyBuild && injectSkeletonPlugin(),
      !isLegacyBuild && injectTranslationsPlugin(),
      !isLegacyBuild && injectLoadingScriptPlugin(),
      !isLegacyBuild && optimizeRootInitialLoadPlugin(),
      !isLegacyBuild && emitCleanRouteHtmlPlugin(),
    ].filter((p): p is Plugin => !!p),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "preact-iso/hydrate": fileURLToPath(new URL("./src/lib/mockHydrate.ts", import.meta.url)),
      },
    },
    ssr: {
      noExternal: ["preact-iso"],
    },
  };
});
