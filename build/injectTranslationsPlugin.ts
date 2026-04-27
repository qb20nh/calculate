import type { Plugin } from "vite";
import { MESSAGES } from "../src/lib/i18n";

export function injectTranslationsPlugin(): Plugin {
  return {
    name: "calculate:inject-translations",
    transformIndexHtml(html) {
      // Generate a slim version of translations needed ONLY for the skeleton
      const skeletonData = Object.fromEntries(
        Object.entries(MESSAGES).map(([locale, m]) => [
          locale,
          {
            difficulty: m.difficulty,
            back: m.game.back,
            previous: m.game.previousStage,
            next: m.game.nextStage,
            reset: m.game.resetStage,
            generating: m.game.generatingPuzzle,
            stageLabel: m.game.stageLabel,
          },
        ]),
      );

      const injection = `
        var skeletonData = ${JSON.stringify(skeletonData)};
        var lang = document.documentElement.lang || "en";
        var messages = skeletonData[lang] || skeletonData["en"];
        var difficultyLabels = messages.difficulty;
        var modeKey = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        var difficultyText = difficultyLabels[modeKey] || modeKey;
        var loadingText = messages.generating;
        var buttonLabels = {
          back: messages.back,
          previous: messages.previous,
          next: messages.next,
          reset: messages.reset
        };
      `;

      const appTitles = Object.fromEntries(
        Object.entries(MESSAGES).map(([locale, m]) => [locale, m.appTitle]),
      );

      return html
        .replace("/* __SHARED_TRANSLATIONS__ */", injection)
        .replace("/* __APP_TITLES__ */", JSON.stringify(appTitles));
    },
  };
}
