import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig } from "vite";
import { legacyPrerenderPlugin } from "./build/legacyPrerenderPlugin";

const isLegacyBuild = process.env.CALCULATE_LEGACY_BUILD === "1";

const normalizeBase = (base: string) => {
  const value = base.trim();
  if (!value || value === "/") return "/";
  if (/^[a-z]+:\/\//i.test(value)) return value.endsWith("/") ? value : `${value}/`;
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
};

const getCommandOutput = (command: string, args: string[]) => {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const getUpstreamRemoteName = () => {
  const upstream = getCommandOutput("git", [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  return upstream?.split("/")[0] || "origin";
};

const getRepoNameFromRemote = (remoteUrl: string) =>
  remoteUrl.replace(/\/$/, "").match(/[/:]([^/:/]+?)(?:\.git)?$/)?.[1] ?? null;

const getRepoName = () => {
  const githubRepo = process.env.GITHUB_REPOSITORY?.split("/").pop();
  if (githubRepo) return githubRepo;

  const remoteUrl = getCommandOutput("git", ["remote", "get-url", getUpstreamRemoteName()]);
  return remoteUrl ? getRepoNameFromRemote(remoteUrl) : null;
};

const getBase = (command: "build" | "serve") => {
  const explicitBase = process.env.CALCULATE_BASE ?? process.env.VITE_BASE;
  if (explicitBase !== undefined) return normalizeBase(explicitBase);
  if (command !== "build") return "/";
  return normalizeBase(getRepoName() ?? "/");
};

const prerender = isLegacyBuild
  ? undefined
  : {
      enabled: true,
      renderTarget: "#app",
      prerenderScript: fileURLToPath(new URL("./src/prerender.tsx", import.meta.url)),
      additionalPrerenderRoutes: ["/404", "/game/easy", "/game/medium", "/game/hard"],
      previewMiddlewareEnabled: true,
      previewMiddlewareFallback: "",
    };

export default defineConfig(({ command }) => ({
  base: getBase(command),
  plugins: [
    preact({
      ...(prerender ? { prerender } : {}),
    }),
    ...(isLegacyBuild ? [legacy()] : [legacyPrerenderPlugin()]),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
