import { access, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

export function injectSkeletonPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "calculate:inject-skeleton",
    apply: "build",
    enforce: "post",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async closeBundle() {
      // The legacy build doesn't prerender routes, so we skip it to prevent ENOENT errors
      if (process.env.CALCULATE_LEGACY_BUILD === "1") return;

      const distDir = resolve(config.root, config.build.outDir);

      try {
        const sourceHtmlPath = join(distDir, "game", "easy", "index.html");
        const sourceHtml = await readFile(sourceHtmlPath, "utf8");

        // Extract innerHTML of #app using preact-iso boundaries
        const appMatch = sourceHtml.match(/<!--\$s-->([\s\S]*?)<!--\/\$s-->/);
        if (!appMatch) {
          throw new Error("Could not find prerendered content in game/easy/index.html");
        }

        // The inner HTML of the app
        let skeletonHtml = appMatch[1];

        // Clean up any other possible preact-iso artifacts inside if needed
        skeletonHtml = skeletonHtml.replaceAll(/<script type="isodata">[\s\S]*?<\/script>/g, "");

        console.log(`Extracted skeleton HTML (${skeletonHtml.length} bytes)`);

        // Inject into index.html
        const targetHtmlPath = join(distDir, "index.html");
        let targetHtml = await readFile(targetHtmlPath, "utf8");

        targetHtml = targetHtml.replace(
          /<template id="game-skeleton">[\s\S]*?<\/template>/,
          `<template id="game-skeleton">${skeletonHtml}</template>`,
        );

        await writeFile(targetHtmlPath, targetHtml);
        console.log("Injected skeleton into dist/index.html");

        // Also inject into 404.html if it exists
        const target404Path = join(distDir, "404.html");
        const exists = await access(target404Path)
          .then(() => true)
          .catch(() => false);

        if (exists) {
          let target404Html = await readFile(target404Path, "utf8");
          target404Html = target404Html.replace(
            /<template id="game-skeleton">[\s\S]*?<\/template>/,
            `<template id="game-skeleton">${skeletonHtml}</template>`,
          );
          await writeFile(target404Path, target404Html);
          console.log("Injected skeleton into dist/404.html");
        }
      } catch (err) {
        console.error("Failed to inject skeleton:", err);
      }
    },
  };
}
