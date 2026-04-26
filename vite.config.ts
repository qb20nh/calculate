import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig, type Plugin } from "vite";
import { injectLoadingScriptPlugin } from "./build/injectLoadingScriptPlugin";
import { injectSkeletonPlugin } from "./build/injectSkeletonPlugin";
import { legacyPrerenderPlugin } from "./build/legacyPrerenderPlugin";

const isLegacyBuild = process.env.CALCULATE_LEGACY_BUILD === "1";

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const prerender = isBuild && !isLegacyBuild;
  const base = process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/`
    : "/";

  return {
    base,
    plugins: [
      preact({
        prerender: {
          enabled: !!prerender,
          renderTarget: "#app",
          prerenderScript: fileURLToPath(new URL("./src/prerender.tsx", import.meta.url)),
          additionalPrerenderRoutes: [
            "/404",
            "/game/easy",
            "/game/medium",
            "/game/hard",
            "/game/custom",
          ],
          previewMiddlewareEnabled: false,
        },
      }),
      ...(isLegacyBuild ? [legacy()] : [legacyPrerenderPlugin()]),
      !isLegacyBuild && injectSkeletonPlugin(),
      !isLegacyBuild && injectLoadingScriptPlugin(),
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
