import type { Plugin } from "vite";

type HtmlAsset = {
  type: "asset";
  source: string;
};

type BundleItem = { type: string; source?: string | Uint8Array };
type BundleLike = Record<string, BundleItem | undefined>;

const isHtmlAsset = (asset: BundleItem | undefined): asset is HtmlAsset =>
  asset?.type === "asset" && typeof asset.source === "string";

const getHtmlAsset = (bundle: BundleLike, fileName: string): HtmlAsset => {
  const asset = bundle[fileName];
  if (!isHtmlAsset(asset)) {
    throw new TypeError(`Could not find ${fileName} in build output.`);
  }
  return asset;
};

const extractSkeletonHtml = (sourceHtml: string) => {
  const appMatch = sourceHtml.match(/<!--\$s-->([\s\S]*?)<!--\/\$s-->/);
  const skeletonHtml = appMatch?.[1];
  if (typeof skeletonHtml !== "string") {
    throw new TypeError("Could not find prerendered content in game/easy/index.html");
  }

  return skeletonHtml.replaceAll(/<script type="isodata">[\s\S]*?<\/script>/g, "");
};

const injectSkeleton = (html: string, skeletonHtml: string) =>
  html.replace(
    /<template id="game-skeleton">[\s\S]*?<\/template>/,
    `<template id="game-skeleton">${skeletonHtml}</template>`,
  );

export function injectSkeletonPlugin(): Plugin {
  return {
    name: "calculate:inject-skeleton",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      if (process.env.CALCULATE_LEGACY_BUILD === "1") return;

      const outputBundle = bundle as BundleLike;

      const skeletonHtml = extractSkeletonHtml(
        getHtmlAsset(outputBundle, "game/easy/index.html").source,
      );

      const indexHtml = getHtmlAsset(outputBundle, "index.html");
      indexHtml.source = injectSkeleton(indexHtml.source, skeletonHtml);

      const nested404Html = getHtmlAsset(outputBundle, "404/index.html");
      const root404Html = injectSkeleton(nested404Html.source, skeletonHtml);

      const existingRoot404 = outputBundle["404.html"];
      if (
        existingRoot404 &&
        existingRoot404.type === "asset" &&
        typeof existingRoot404.source === "string"
      ) {
        existingRoot404.source = root404Html;
        return;
      }

      this.emitFile({
        type: "asset",
        fileName: "404.html",
        source: root404Html,
      });
    },
  };
}
