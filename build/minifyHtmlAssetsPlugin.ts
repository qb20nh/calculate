import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Options as HtmlMinifierOptions, minify } from "html-minifier-terser";
import type { Plugin, ResolvedConfig } from "vite";

type HtmlAsset = {
  type: "asset";
  fileName?: string;
  source: string;
};

type BundleItem = {
  type: string;
  fileName?: string;
  source?: string | Uint8Array;
};

type BundleLike = Record<string, BundleItem | undefined>;

const htmlMinifierOptions = {
  caseSensitive: true,
  collapseBooleanAttributes: true,
  collapseInlineTagWhitespace: true,
  collapseWhitespace: true,
  conservativeCollapse: false,
  decodeEntities: false,
  minifyCSS: true,
  minifyJS: true,
  removeAttributeQuotes: false,
  removeComments: false,
} satisfies HtmlMinifierOptions;

const isHtmlAsset = (asset: BundleItem | undefined): asset is HtmlAsset =>
  asset?.type === "asset" && typeof asset.source === "string";

const findHtmlFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(directory, entry.name);
      if (entry.isDirectory()) return findHtmlFiles(filePath);
      if (entry.isFile() && entry.name.endsWith(".html")) return [filePath];
      return [];
    }),
  );

  return files.flat();
};

export const minifyHtmlAssetSource = (html: string) => minify(html, htmlMinifierOptions);

export function minifyHtmlAssetsPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "calculate:minify-html-assets",
    apply: "build",
    enforce: "post",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async generateBundle(_, bundle) {
      for (const [fileName, item] of Object.entries(bundle as BundleLike)) {
        if (!fileName.endsWith(".html") || !isHtmlAsset(item)) continue;
        item.source = await minifyHtmlAssetSource(item.source);
      }
    },
    async closeBundle() {
      const distDir = resolve(config.root, config.build.outDir);
      for (const filePath of await findHtmlFiles(distDir)) {
        const html = await readFile(filePath, "utf8");
        await writeFile(filePath, await minifyHtmlAssetSource(html));
      }
    },
  };
}
