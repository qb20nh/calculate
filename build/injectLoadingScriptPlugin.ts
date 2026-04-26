import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Vite plugin to inject the shared progress trickle logic into index.html at build time.
 * This avoids duplicating the animation logic between the initial HTML and the JS app.
 */
export function injectLoadingScriptPlugin(): Plugin {
  return {
    name: "calculate:inject-loading-script",
    transformIndexHtml(html) {
      const logicPath = resolve(process.cwd(), "src/lib/progressLogic.ts");
      const logicCode = readFileSync(logicPath, "utf8");

      // Extract the getNextTrickleProgress function definition
      const functionMatch = logicCode.match(
        /export const getNextTrickleProgress = ([\s\S]+?);[\s]*$/m,
      );
      const match = functionMatch?.[1];
      if (!match) {
        throw new Error("Could not find getNextTrickleProgress in src/lib/progressLogic.ts");
      }

      const functionDefinition = `var getNextTrickleProgress = ${match.replace(/:\s*number/g, "")};`;

      return html.replace("/* __PROGRESS_LOGIC_PLACEHOLDER__ */", functionDefinition);
    },
  };
}
