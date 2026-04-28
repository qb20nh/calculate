import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

const routeIndexSuffix = "/index.html";
type HtmlAsset = {
  type: "asset";
  source: string;
};

const isHtmlAsset = (asset: unknown): asset is HtmlAsset =>
  typeof asset === "object" &&
  asset !== null &&
  "type" in asset &&
  asset.type === "asset" &&
  "source" in asset &&
  typeof asset.source === "string";

const getCleanRouteFileName = (fileName: string) => {
  if (!fileName.endsWith(routeIndexSuffix)) return null;
  return `${fileName.slice(0, -routeIndexSuffix.length)}.html`;
};

const acceptsHtml = (req: {
  headers: { accept?: string | string[] | undefined };
  method?: string | undefined;
}) => {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const acceptHeader = req.headers.accept;
  const accept = Array.isArray(acceptHeader) ? acceptHeader.join(",") : (acceptHeader ?? "");
  return accept === "" || accept.includes("text/html") || accept.includes("*/*");
};

const getPreviewPath = (rawUrl: string, base: string) => {
  const pathname = new URL(rawUrl, "http://localhost").pathname;
  if (base === "/") return pathname;

  const basePath = new URL(base, "http://localhost").pathname;
  if (!pathname.startsWith(basePath)) return pathname;
  return pathname.slice(basePath.length - 1) || "/";
};

const hasRouteHtml = (distDir: string, pathname: string) => {
  const routePath = pathname.replace(/^\/+/, "");
  if (routePath === "") return existsSync(resolve(distDir, "index.html"));
  if (pathname.endsWith("/")) return existsSync(resolve(distDir, routePath, "index.html"));
  return (
    existsSync(resolve(distDir, `${routePath}.html`)) ||
    existsSync(resolve(distDir, routePath, "index.html"))
  );
};

export function emitCleanRouteHtmlPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "calculate:emit-clean-route-html",
    enforce: "post",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    generateBundle(_, bundle) {
      for (const [fileName, item] of Object.entries(bundle)) {
        const cleanRouteFileName = getCleanRouteFileName(fileName);
        if (!cleanRouteFileName || cleanRouteFileName in bundle || !isHtmlAsset(item)) continue;

        this.emitFile({
          type: "asset",
          fileName: cleanRouteFileName,
          source: item.source,
        });
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!acceptsHtml(req) || !req.url) {
          next();
          return;
        }

        const pathname = getPreviewPath(req.url, config.base);
        const distDir = resolve(config.root, config.build.outDir);
        if (
          pathname === "/favicon.ico" ||
          /\.[^/]+$/.test(pathname) ||
          hasRouteHtml(distDir, pathname)
        ) {
          next();
          return;
        }

        res.statusCode = 404;
        req.url = "/404.html";
        next();
      });
    },
  };
}
