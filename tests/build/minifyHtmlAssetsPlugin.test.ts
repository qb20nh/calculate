import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { minifyHtmlAssetSource, minifyHtmlAssetsPlugin } from "../../build/minifyHtmlAssetsPlugin";

describe("minifyHtmlAssetsPlugin", () => {
  it("minifies inline JavaScript, inline CSS, and surrounding HTML whitespace", async () => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head>
          <style>
            .foo {
              color: red;
            }

            @media (min-width: 48rem) {
              .foo {
                display: grid;
              }
            }
          </style>
          <script>
            (function () {
              var value = 1;
              console.log(value);
            })();
          </script>
        </head>
        <body>
          <!--$s-->
          <main>
            <h1>Hello</h1>
          </main>
          <!--/$s-->
        </body>
      </html>`;

    const minified = await minifyHtmlAssetSource(html);

    expect(minified).not.toMatch(/[\n\t]/);
    expect(minified).toContain("<!DOCTYPE html>");
    expect(minified).toContain(
      "<style>.foo{color:red}@media (min-width:48rem){.foo{display:grid}}</style>",
    );
    expect(minified).toContain("<script>console.log(1)</script>");
    expect(minified).toContain("<!--$s-->");
    expect(minified).toContain("<!--/$s-->");
  });

  it("does not run non-JavaScript script bodies as JavaScript", async () => {
    const html = `<html><head><script type="isodata">
      {"stage": 1}
    </script></head></html>`;

    const minified = await minifyHtmlAssetSource(html);

    expect(minified).toContain('<script type="isodata">{"stage": 1}</script>');
  });

  it("minifies emitted HTML assets in a Vite bundle", async () => {
    const plugin = minifyHtmlAssetsPlugin();
    const bundle = {
      "index.html": {
        type: "asset",
        source: `<html>
          <head>
            <style>.box { padding: 1rem; }</style>
          </head>
        </html>`,
      },
    };

    const generateBundle = plugin.generateBundle;
    if (typeof generateBundle !== "function") throw new TypeError("Expected generateBundle hook.");
    await generateBundle.call({} as never, {} as never, bundle as never, false);

    expect(bundle["index.html"].source).not.toMatch(/[\n\t]/);
    expect(bundle["index.html"].source).toContain(
      "<html><head><style>.box{padding:1rem}</style></head>",
    );
  });

  it("minifies final HTML files written after bundle generation", async () => {
    const root = await mkdtemp(join(tmpdir(), "calculate-html-minify-"));
    const dist = join(root, "dist");
    const htmlPath = join(dist, "index.html");

    await mkdir(dist, { recursive: true });
    await writeFile(
      htmlPath,
      `<html>
        <head>
          <script>
            (function () {
              console.log("late");
            })();
          </script>
        </head>
      </html>`,
    );

    try {
      const plugin = minifyHtmlAssetsPlugin();
      const configResolved = plugin.configResolved;
      const closeBundle = plugin.closeBundle;
      if (typeof configResolved !== "function")
        throw new TypeError("Expected configResolved hook.");
      if (typeof closeBundle !== "function") throw new TypeError("Expected closeBundle hook.");

      configResolved.call({} as never, { root, build: { outDir: "dist" } } as never);
      await closeBundle.call({} as never);

      const minified = await readFile(htmlPath, "utf8");
      expect(minified).not.toMatch(/[\n\t]/);
      expect(minified).toContain('<script>console.log("late")</script>');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
