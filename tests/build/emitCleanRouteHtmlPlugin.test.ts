import { describe, expect, it } from "vitest";
import { emitCleanRouteHtmlPlugin } from "../../build/emitCleanRouteHtmlPlugin";

type TestAsset = { type: "asset"; fileName: string; source: string };
type TestBundle = Record<string, TestAsset>;
type EmittedAsset = { fileName?: string; source?: string; type: "asset" };

const runGenerateBundle = (bundle: TestBundle) => {
  const plugin = emitCleanRouteHtmlPlugin();
  const emitted: EmittedAsset[] = [];
  const generateBundle = plugin.generateBundle as
    | ((
        this: { emitFile: (asset: EmittedAsset) => string },
        options: unknown,
        bundle: TestBundle,
      ) => void)
    | undefined;

  generateBundle?.call(
    {
      emitFile(asset) {
        emitted.push(asset);
        return asset.fileName ?? "asset";
      },
    },
    {},
    bundle,
  );

  return emitted;
};

describe("emitCleanRouteHtmlPlugin", () => {
  it("emits extensionless route HTML copies for nested prerendered routes", () => {
    const bundle = {
      "index.html": { type: "asset", fileName: "index.html", source: "<html>root</html>" },
      "game/custom/index.html": {
        type: "asset",
        fileName: "game/custom/index.html",
        source: "<html>custom</html>",
      },
      "game/easy/index.html": {
        type: "asset",
        fileName: "game/easy/index.html",
        source: "<html>easy</html>",
      },
    } satisfies TestBundle;

    expect(runGenerateBundle(bundle)).toEqual([
      { type: "asset", fileName: "game/custom.html", source: "<html>custom</html>" },
      { type: "asset", fileName: "game/easy.html", source: "<html>easy</html>" },
    ]);
  });

  it("keeps existing clean route files untouched", () => {
    const bundle = {
      "404.html": { type: "asset", fileName: "404.html", source: "<html>existing</html>" },
      "404/index.html": {
        type: "asset",
        fileName: "404/index.html",
        source: "<html>nested</html>",
      },
    } satisfies TestBundle;

    expect(runGenerateBundle(bundle)).toEqual([]);
  });
});
