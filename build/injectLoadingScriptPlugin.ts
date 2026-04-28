import type { Plugin } from "vite";
import { getNextTrickleProgress } from "../src/lib/progressLogic";

export function injectLoadingScriptPlugin(): Plugin {
  return {
    name: "calculate:inject-loading-script",
    transformIndexHtml(html) {
      const code = `var getNextTrickleProgress = ${getNextTrickleProgress.toString()};`;
      return html.replace("/* __PROGRESS_LOGIC_PLACEHOLDER__ */", code);
    },
  };
}
