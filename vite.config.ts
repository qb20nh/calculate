import { access, readFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import { injectSkeletonPlugin } from "./build/injectSkeletonPlugin";
import { legacyPrerenderPlugin } from "./build/legacyPrerenderPlugin";

const isLegacyBuild = process.env.CALCULATE_LEGACY_BUILD === "1";

const normalizeBase = (base: string) => {
  const value = base.trim();
  if (!value || value === "/") return "/";
  if (/^[a-z]+:\/\//i.test(value)) return value.endsWith("/") ? value : `${value}/`;
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
};

const getBase = () =>
  normalizeBase(process.env.VITE_BASE ?? process.env.GITHUB_REPOSITORY?.split("/").pop() ?? "/");

const getPrerender = () =>
  isLegacyBuild
    ? undefined
    : {
        enabled: true,
        renderTarget: "#app",
        prerenderScript: fileURLToPath(new URL("./src/prerender.tsx", import.meta.url)),
        additionalPrerenderRoutes: ["/404", "/game/easy", "/game/medium", "/game/hard"],
        previewMiddlewareEnabled: false,
      };

const normalizeBasePath = (base: string) => {
  const pathname = new URL(base, "http://localhost").pathname.replace(/\/+$/g, "");
  return pathname || "/";
};

const stripBasePath = (pathname: string, base: string) => {
  const basePath = normalizeBasePath(base);
  if (basePath === "/") return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || "/";
  return null;
};

const findHtmlFile = async (candidates: string[]) => {
  for (const file of new Set(candidates)) {
    try {
      await access(file);
      return file;
    } catch {
      // Try next prerender fallback.
    }
  }
  return null;
};

const getHtmlCandidates = (outDir: string, routePath: string) => {
  const normalizedRoute = routePath.replaceAll(/\/+$/g, "") || "/";
  const routeDir = normalizedRoute.replace(/^\/+/, "");
  const candidates = [routeDir ? join(outDir, routeDir, "index.html") : join(outDir, "index.html")];
  const gameStage = new RegExp(/^\/game\/(easy|medium|hard)\/[1-9]\d*$/).exec(normalizedRoute);
  if (gameStage) {
    candidates.push(join(outDir, "game", gameStage[1], "index.html"));
  }
  candidates.push(join(outDir, "index.html"));
  return candidates;
};

function prerenderPreviewPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "calculate:prerender-preview",
    enforce: "pre",
    apply: "serve",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configurePreviewServer(server) {
      const outDir = resolve(config.root, config.build.outDir);
      const base = config.base;

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        if (posix.extname(url.pathname)) return next();

        const routePath = stripBasePath(url.pathname, base);
        if (!routePath) return next();

        const file = await findHtmlFile(getHtmlCandidates(outDir, routePath));
        if (!file) return next();

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html;charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(await readFile(file));
      });
    },
  };
}

export default defineConfig(() => {
  const base = getBase();
  const prerender = getPrerender();

  return {
    base,
    plugins: [
      preact({
        ...(prerender ? { prerender } : {}),
      }),
      prerenderPreviewPlugin(),
      ...(isLegacyBuild ? [legacy()] : [legacyPrerenderPlugin()]),
      injectSkeletonPlugin(),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
