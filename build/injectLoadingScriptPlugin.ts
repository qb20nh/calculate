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

      const exportMarker = "export const getNextTrickleProgress = ";
      const functionStart = logicCode.indexOf(exportMarker);
      if (functionStart === -1) {
        throw new Error("Could not find getNextTrickleProgress in src/lib/progressLogic.ts");
      }

      const bodyStart = logicCode.indexOf("{", functionStart);
      if (bodyStart === -1) {
        throw new Error("Could not find getNextTrickleProgress body in src/lib/progressLogic.ts");
      }

      let depth = 0;
      let bodyEnd = -1;
      for (let index = bodyStart; index < logicCode.length; index += 1) {
        const char = logicCode[index];
        if (char === "{") {
          depth += 1;
        } else if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            bodyEnd = index;
            break;
          }
        }
      }

      if (bodyEnd === -1) {
        throw new Error("Could not parse getNextTrickleProgress body in src/lib/progressLogic.ts");
      }

      const functionDefinition = `var getNextTrickleProgress = ${logicCode
        .slice(functionStart + exportMarker.length, bodyEnd + 1)
        .replace(/:\s*number/g, "")};`;

      return html.replace("/* __PROGRESS_LOGIC_PLACEHOLDER__ */", functionDefinition);
    },
  };
}
