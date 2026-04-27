import type { Plugin } from "vite";

/**
 * Strips lint-related comments (biome-ignore, eslint-disable, @ts-expect-error, etc.)
 * from the final HTML and JS output.
 */
export function stripCommentsPlugin(): Plugin {
  const ALL_COMMENTS_REGEX = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;

  const replacer = (match: string, offset: number, fullText: string) => {
    // Safeguard for URLs (e.g., https://)
    if (match.startsWith("//")) {
      const charBefore = fullText.substring(offset - 1, offset);
      if (charBefore === ":") return match;
    }

    // Preserve comments that look like license/legal notices
    if (/license|@license|copyright/i.test(match)) {
      return match;
    }
    return "";
  };

  return {
    name: "calculate:strip-comments",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(ALL_COMMENTS_REGEX, replacer);
    },
    renderChunk(code) {
      return {
        code: code.replace(ALL_COMMENTS_REGEX, replacer),
        map: null,
      };
    },
  };
}
