import postcss, {
  type AtRule,
  type ChildNode,
  type Container,
  type Declaration,
  type Rule,
} from "postcss";
import type { Plugin } from "vite";

type HtmlAsset = {
  type: "asset";
  source: string;
};

type BundleItem = {
  type: string;
  fileName?: string;
  source?: string | Uint8Array;
};
type BundleLike = Record<string, BundleItem | undefined>;
type CriticalHtmlContext = {
  classNames: ReadonlySet<string>;
  elementNames: ReadonlySet<string>;
};

const criticalStyleAttr = "data-critical-root";
const criticalLayerOrder = "@layer properties,theme,base,components,utilities;";
const classSelectorPattern = /\.((?:\\.|[-_a-zA-Z0-9]|[\u0080-\uFFFF])+)/g;
const nonCriticalClassPattern = /^(active:|duration-|ease-|shadow-|transition)/;
const statePseudoPattern =
  /(^|[^\\]):(active|checked|disabled|enabled|focus|focus-visible|focus-within|hover|target|visited)\b/;
const varPattern = /var\(\s*(--[-_a-zA-Z0-9]+)\b/g;
const ignoredHtmlPattern =
  /<(script|style|template|noscript)\b[\s\S]*?<\/\1>|<template\b[\s\S]*?<\/template>/gi;
const stylesheetPattern = /<link\b(?=[^>]*\brel="stylesheet")[^>]*>/i;
const stylesheetGlobalPattern = /<link\b(?=[^>]*\brel="stylesheet")[^>]*>/gi;
const rootAppCoreModulePreloadPattern =
  /<link\b(?=[^>]*\brel="modulepreload")(?=[^>]*\bhref="[^"]*assets\/app-core-[^"]+\.js")[^>]*>\n?/gi;
const criticalProperties = new Set([
  "-webkit-text-size-adjust",
  "align-items",
  "animation",
  "animation-name",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-radius",
  "border-style",
  "border-top-color",
  "border-width",
  "box-sizing",
  "color",
  "color-scheme",
  "display",
  "flex-direction",
  "flex-shrink",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "gap",
  "grid-template-columns",
  "height",
  "inset",
  "justify-content",
  "letter-spacing",
  "left",
  "line-height",
  "margin",
  "margin-block-end",
  "margin-block-start",
  "margin-bottom",
  "margin-left",
  "max-width",
  "min-width",
  "opacity",
  "overflow",
  "padding",
  "padding-block",
  "padding-inline",
  "pointer-events",
  "position",
  "right",
  "text-align",
  "text-transform",
  "text-wrap",
  "top",
  "transform",
  "transition",
  "white-space",
  "width",
  "z-index",
]);
const animationNonNameTokens = new Set([
  "alternate",
  "alternate-reverse",
  "backwards",
  "both",
  "ease",
  "ease-in",
  "ease-in-out",
  "ease-out",
  "forwards",
  "infinite",
  "initial",
  "inherit",
  "linear",
  "none",
  "normal",
  "paused",
  "reverse",
  "running",
  "unset",
]);

const isHtmlAsset = (asset: BundleItem | undefined): asset is HtmlAsset =>
  asset?.type === "asset" && typeof asset.source === "string";

const getAttribute = (tag: string, attr: string) =>
  new RegExp(`\\s${attr}="([^"]+)"`, "i").exec(tag)?.[1] ?? null;

const getAssetFileName = (href: string) => {
  const cleanHref = href.split("?", 1)[0] ?? href;
  const assetIndex = cleanHref.lastIndexOf("assets/");
  return assetIndex === -1 ? cleanHref.replace(/^\.?\//, "") : cleanHref.slice(assetIndex);
};

const getSourceText = (source: string | Uint8Array) =>
  typeof source === "string" ? source : new TextDecoder().decode(source);

const findStylesheetTag = (html: string) => {
  const tag = stylesheetPattern.exec(html)?.[0];
  if (!tag) throw new TypeError("Could not find stylesheet in HTML asset.");

  const href = getAttribute(tag, "href");
  if (!href) throw new TypeError("Could not find stylesheet href in HTML asset.");

  return { href, tag };
};

const findStylesheetTags = (html: string) =>
  [...html.matchAll(stylesheetGlobalPattern)].map((match) => {
    const tag = match[0];
    const href = getAttribute(tag, "href");
    if (!href) throw new TypeError("Could not find stylesheet href in HTML asset.");
    return { href, tag };
  });

const findStylesheetAsset = (bundle: BundleLike, href: string) => {
  const fileName = getAssetFileName(href);
  const asset = bundle[fileName];
  if (asset?.type === "asset" && asset.source !== undefined) return asset;

  const fallbackAsset = Object.entries(bundle).find(
    ([name, item]) =>
      item?.type === "asset" &&
      item.source !== undefined &&
      (name.endsWith(fileName) || item.fileName?.endsWith(fileName)),
  )?.[1];
  if (fallbackAsset?.type === "asset" && fallbackAsset.source !== undefined) return fallbackAsset;

  throw new TypeError(`Could not find stylesheet asset "${fileName}" in build output.`);
};

const findGameRouteStylesheet = (bundle: BundleLike) => {
  for (const [name, item] of Object.entries(bundle)) {
    const fileName = item?.fileName ?? name;
    if (
      item?.type === "asset" &&
      item.source !== undefined &&
      /^assets\/GameRoute-[^/]+\.css$/.test(fileName)
    ) {
      return fileName;
    }
  }

  return null;
};

const getAssetHref = (html: string, fileName: string) => {
  const { href } = findStylesheetTag(html);
  const assetIndex = href.lastIndexOf("assets/");
  const prefix = assetIndex === -1 ? "" : href.slice(0, assetIndex);
  return `${prefix}${fileName}`;
};

const injectStylesheetLink = (html: string, href: string) => {
  if (html.includes(`href="${href}"`)) return html;
  return html.replace("</head>", `<link rel="stylesheet" crossorigin href="${href}">\n</head>`);
};

const injectGameRouteStylesheet = (bundle: BundleLike) => {
  const gameHtmlAssets = Object.entries(bundle).filter(
    ([name, item]) => name.startsWith("game/") && name.endsWith(".html") && isHtmlAsset(item),
  );
  if (gameHtmlAssets.length === 0) return;

  const gameRouteStylesheet = findGameRouteStylesheet(bundle);
  if (!gameRouteStylesheet) return;

  for (const [, htmlAsset] of gameHtmlAssets) {
    if (!isHtmlAsset(htmlAsset)) continue;
    htmlAsset.source = injectStylesheetLink(
      htmlAsset.source,
      getAssetHref(htmlAsset.source, gameRouteStylesheet),
    );
  }
};

const getLinkedStylesheetCss = (html: string, bundle: BundleLike) =>
  findStylesheetTags(html)
    .map(({ href }) => {
      const stylesheet = findStylesheetAsset(bundle, href);
      if (stylesheet.source === undefined) {
        throw new TypeError(`Could not read stylesheet asset "${href}".`);
      }
      return getSourceText(stylesheet.source);
    })
    .join("\n");

const collectRootClasses = (html: string) => {
  const classNames = new Set<string>();
  const cleanedHtml = html.replace(ignoredHtmlPattern, "");
  const classPattern = /\bclass="([^"]+)"/g;

  for (const match of cleanedHtml.matchAll(classPattern)) {
    for (const className of (match[1] ?? "").split(/\s+/)) {
      if (className) classNames.add(className);
    }
  }

  return classNames;
};

const collectRootElementNames = (html: string) => {
  const elementNames = new Set<string>();
  const cleanedHtml = html.replace(ignoredHtmlPattern, "");
  const tagPattern = /<([a-zA-Z][-_a-zA-Z0-9]*)\b/g;

  for (const match of cleanedHtml.matchAll(tagPattern)) {
    const elementName = match[1]?.toLowerCase();
    if (elementName) elementNames.add(elementName);
  }

  return elementNames;
};

const decodeCssIdentifier = (identifier: string) =>
  identifier
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, "$1");

const collectSelectorClasses = (selector: string) =>
  [...selector.matchAll(classSelectorPattern)].map((match) => decodeCssIdentifier(match[1] ?? ""));

const isGlobalCriticalSelector = (selector: string, elementNames: ReadonlySet<string>) => {
  const trimmed = selector.trim();
  const elementName = /^([a-z][-_a-z0-9]*)(?:$|[\s>+~:#.[*])/.exec(trimmed)?.[1];

  return (
    trimmed === "*" ||
    trimmed === "::after" ||
    trimmed === "::before" ||
    /^:root(?:$|:|\[)/.test(trimmed) ||
    /^#app(?:$|[\s>+~:#.[*])/.test(trimmed) ||
    (elementName !== undefined && elementNames.has(elementName))
  );
};

const isCriticalSelector = (selector: string, context: CriticalHtmlContext) => {
  if (statePseudoPattern.test(selector)) return false;

  const selectorClasses = collectSelectorClasses(selector);
  if (selectorClasses.length === 0) return isGlobalCriticalSelector(selector, context.elementNames);
  if (selectorClasses.some((className) => nonCriticalClassPattern.test(className))) return false;

  return selectorClasses.every((className) => context.classNames.has(className));
};

const isCriticalDeclaration = (declaration: Declaration) => {
  if (declaration.prop.startsWith("--")) return true;
  if (declaration.prop === "letter-spacing" && declaration.value === "inherit") return false;
  return criticalProperties.has(declaration.prop);
};

const pruneNonCriticalDeclarations = (rule: Rule) => {
  rule.walkDecls((declaration) => {
    if (!isCriticalDeclaration(declaration)) declaration.remove();
  });
};

const appendCriticalNode = (node: ChildNode, target: Container, context: CriticalHtmlContext) => {
  if (node.type === "rule") {
    const rule = node as Rule;
    const selectors = rule.selectors.filter((selector) => isCriticalSelector(selector, context));
    if (selectors.length === 0) return;

    const clonedRule = rule.clone();
    clonedRule.selectors = selectors;
    pruneNonCriticalDeclarations(clonedRule);
    if (clonedRule.nodes.length === 0) return;
    target.append(clonedRule);
    return;
  }

  if (node.type === "atrule") {
    const atRule = node as AtRule;
    if (atRule.name.toLowerCase().includes("keyframes") || !atRule.nodes) return;

    const clonedAtRule = atRule.clone({ nodes: [] });
    for (const child of atRule.nodes) {
      appendCriticalNode(child, clonedAtRule, context);
    }
    if (clonedAtRule.nodes?.length) target.append(clonedAtRule);
  }
};

const collectVariableNames = (value: string) =>
  [...value.matchAll(varPattern)].map((match) => match[1] ?? "");

const collectVariableDefinitions = (root: postcss.Root) => {
  const definitions = new Map<string, string>();
  root.walkDecls((declaration) => {
    if (declaration.prop.startsWith("--")) {
      definitions.set(declaration.prop, declaration.value);
    }
  });
  return definitions;
};

const shouldInlineVariable = (name: string) =>
  !name.startsWith("--theme-") && !name.startsWith("--tw-");

const normalizeTailwindFallbacks = (value: string) =>
  value.replace(/var\(--tw-leading,var\((--text-[^)]+)\)\)/g, "var($1)");

const getLocalCustomProperty = (declaration: Declaration, property: string) => {
  const parent = declaration.parent;
  if (!parent?.nodes) return null;

  const localDeclaration = parent.nodes.find(
    (node): node is Declaration => node.type === "decl" && node.prop === property,
  );
  return localDeclaration?.value ?? null;
};

const inlineTailwindRuntimeDefaults = (declaration: Declaration) => {
  declaration.value = declaration.value.replace(/var\(--tw-border-style\)/g, () => {
    return getLocalCustomProperty(declaration, "--tw-border-style") ?? "solid";
  });
  declaration.value = declaration.value.replace(/var\(--tw-space-y-reverse\)/g, () => {
    return getLocalCustomProperty(declaration, "--tw-space-y-reverse") ?? "0";
  });
};

const inlineVariableValue = (
  value: string,
  definitions: ReadonlyMap<string, string>,
  seenVariables = new Set<string>(),
): string =>
  value.replace(/var\(\s*(--[-_a-zA-Z0-9]+)\s*(?:,[^)]*)?\)/g, (match, name: string) => {
    if (!shouldInlineVariable(name) || seenVariables.has(name)) return match;

    const definition = definitions.get(name);
    if (!definition) return match;

    const nextSeenVariables = new Set(seenVariables);
    nextSeenVariables.add(name);
    return inlineVariableValue(definition, definitions, nextSeenVariables);
  });

const inlineResolvableVariables = (criticalRoot: postcss.Root, sourceRoot: postcss.Root) => {
  const definitions = collectVariableDefinitions(sourceRoot);

  criticalRoot.walkDecls((declaration) => {
    if (!declaration.prop.startsWith("--")) {
      inlineTailwindRuntimeDefaults(declaration);
      declaration.value = inlineVariableValue(
        normalizeTailwindFallbacks(declaration.value),
        definitions,
      );
    }
  });
};

const collectUsedVariables = (
  criticalRoot: postcss.Root,
  definitions: ReadonlyMap<string, string>,
) => {
  const usedVariables = new Set<string>();
  const queue: string[] = [];

  const addVariable = (name: string) => {
    if (usedVariables.has(name)) return;
    usedVariables.add(name);
    queue.push(name);
  };

  criticalRoot.walkDecls((declaration) => {
    if (!declaration.prop.startsWith("--")) {
      for (const name of collectVariableNames(declaration.value)) addVariable(name);
    }
  });

  for (const name of queue) {
    const value = definitions.get(name);
    if (!value) continue;
    for (const dependency of collectVariableNames(value)) addVariable(dependency);
  }

  return usedVariables;
};

const pruneUnusedCustomProperties = (criticalRoot: postcss.Root, sourceRoot: postcss.Root) => {
  const usedVariables = collectUsedVariables(criticalRoot, collectVariableDefinitions(sourceRoot));

  criticalRoot.walkDecls((declaration: Declaration) => {
    if (!declaration.prop.startsWith("--")) return;

    const parent = declaration.parent;
    const isTailwindPropertyDefault =
      declaration.prop.startsWith("--tw-") &&
      parent?.type === "rule" &&
      (parent as Rule).selector === "*";

    if (
      isTailwindPropertyDefault ||
      shouldInlineVariable(declaration.prop) ||
      !usedVariables.has(declaration.prop)
    ) {
      declaration.remove();
    }
  });
};

const animationDurationPattern = /^-?(?:\d+|\d*\.\d+)(?:ms|s)$/;
const animationTimingFunctionPattern = /^(?:cubic-bezier|linear|steps)\(/;

const getAnimationNameCandidates = (animationValue: string) => {
  const names = new Set<string>();

  for (const animation of animationValue.split(",")) {
    for (const token of animation.trim().split(/\s+/)) {
      const normalizedToken = decodeCssIdentifier(token.replaceAll(/,$/g, ""));
      const lowerToken = normalizedToken.toLowerCase();
      if (
        lowerToken === "" ||
        animationNonNameTokens.has(lowerToken) ||
        animationDurationPattern.test(lowerToken) ||
        animationTimingFunctionPattern.test(lowerToken)
      ) {
        continue;
      }
      names.add(normalizedToken);
      break;
    }
  }

  return names;
};

const collectAnimationNames = (criticalRoot: postcss.Root) => {
  const names = new Set<string>();

  criticalRoot.walkDecls((declaration) => {
    if (declaration.prop === "animation-name") {
      for (const name of declaration.value.split(",")) {
        const trimmedName = name.trim();
        if (trimmedName && trimmedName !== "none") names.add(trimmedName);
      }
      return;
    }

    if (declaration.prop === "animation") {
      for (const name of getAnimationNameCandidates(declaration.value)) names.add(name);
    }
  });

  return names;
};

const appendUsedKeyframes = (criticalRoot: postcss.Root, sourceRoot: postcss.Root) => {
  const animationNames = collectAnimationNames(criticalRoot);
  if (animationNames.size === 0) return;

  const existingKeyframes = new Set<string>();
  criticalRoot.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase().includes("keyframes"))
      existingKeyframes.add(atRule.params.trim());
  });

  sourceRoot.walkAtRules((atRule) => {
    if (!atRule.name.toLowerCase().includes("keyframes")) return;

    const name = atRule.params.trim();
    if (!animationNames.has(name) || existingKeyframes.has(name)) return;

    criticalRoot.append(atRule.clone());
    existingKeyframes.add(name);
  });
};

const removeEmptyContainers = (container: Container) => {
  container.each((node) => {
    if ("nodes" in node && node.nodes) {
      removeEmptyContainers(node as Container);
    }
    if (
      (node.type === "rule" || node.type === "atrule") &&
      "nodes" in node &&
      node.nodes?.length === 0
    ) {
      node.remove();
    }
  });
};

const formatRem = (value: number) => {
  const formattedValue = Number.parseFloat(value.toFixed(4)).toString();
  if (formattedValue === "0") return "0";
  return `${formattedValue.replace(/^(-?)0\./, "$1.")}rem`;
};

const minifyCss = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/calc\(\.25rem \* (-?\d+(?:\.\d+)?)\)/g, (_, multiplier: string) =>
      formatRem(Number.parseFloat(multiplier) * 0.25),
    )
    .replace(/calc\(1 - 0\)/g, "1")
    .replace(/calc\(1 - 1\)/g, "0")
    .replace(/calc\(([-.\d]+rem) \* 0\)/g, "0")
    .replace(/calc\(([-.\d]+rem) \* 1\)/g, "$1")
    .replace(/\[([-_a-zA-Z0-9]+)="([-_a-zA-Z0-9]+)"\]/g, "[$1=$2]")
    .replace(/;}/g, "}")
    .trim();

export const extractRootCriticalCss = (html: string, css: string) => {
  const sourceRoot = postcss.parse(css);
  const criticalRoot = postcss.root();
  const context = {
    classNames: collectRootClasses(html),
    elementNames: collectRootElementNames(html),
  };

  for (const node of sourceRoot.nodes) {
    appendCriticalNode(node, criticalRoot, context);
  }

  inlineResolvableVariables(criticalRoot, sourceRoot);
  pruneUnusedCustomProperties(criticalRoot, sourceRoot);
  removeEmptyContainers(criticalRoot);
  appendUsedKeyframes(criticalRoot, sourceRoot);

  const criticalCss = minifyCss(`${criticalLayerOrder}${criticalRoot.toString()}`);
  if (!criticalCss) throw new TypeError("Root critical CSS extraction produced empty output.");

  return criticalCss;
};

const removeAttribute = (tag: string, attr: string) =>
  tag.replace(new RegExp(`\\s${attr}="[^"]*"`, "i"), "");

const deferStylesheetTag = (tag: string) => {
  if (tag.includes("data-root-deferred-style")) return tag;
  const href = getAttribute(tag, "href");
  if (!href) throw new TypeError("Could not find stylesheet href in HTML asset.");

  const cleanTag = ["href", "media", "onload", "fetchpriority", "data-href"].reduce(
    (nextTag, attr) => removeAttribute(nextTag, attr),
    tag,
  );
  const deferredTag = cleanTag.replace(
    />$/,
    ` data-root-deferred-style data-href="${href}" media="print" fetchpriority="low">`,
  );
  return `${deferredTag}<noscript>${tag}</noscript>`;
};

const deferStylesheets = (html: string) =>
  html.replace(stylesheetGlobalPattern, (tag) => deferStylesheetTag(tag));

const removeRootAppCoreModulePreload = (html: string) =>
  html.replace(rootAppCoreModulePreloadPattern, "");

const moveEntryModuleToBody = (html: string) => {
  const entryScriptMatch = /<script type="module" crossorigin src="[^"]+"><\/script>/.exec(html);
  if (!entryScriptMatch) return html;

  const entryScript = entryScriptMatch[0].replace("<script ", '<script fetchpriority="low" ');
  return html.replace(entryScriptMatch[0], "").replace("</body>", `${entryScript}\n</body>`);
};

const injectCriticalCss = (html: string, criticalCss: string) => {
  if (html.includes(criticalStyleAttr)) return html;

  const criticalStyle = `<style ${criticalStyleAttr}>${criticalCss}</style>`;
  if (stylesheetPattern.test(html)) {
    return html.replace(stylesheetPattern, `${criticalStyle}\n$&`);
  }

  return html.replace("</head>", `${criticalStyle}\n</head>`);
};

const optimizeHtmlAsset = (
  html: string,
  bundle: BundleLike,
  { shouldDeferStylesheets }: Readonly<{ shouldDeferStylesheets: boolean }>,
) => {
  const stylesheetCss = getLinkedStylesheetCss(html, bundle);
  const criticalCss = extractRootCriticalCss(html, stylesheetCss);
  const htmlWithCriticalCss = injectCriticalCss(html, criticalCss);
  return shouldDeferStylesheets ? deferStylesheets(htmlWithCriticalCss) : htmlWithCriticalCss;
};

const optimizeIndexHtml = (html: string) =>
  moveEntryModuleToBody(removeRootAppCoreModulePreload(html));

const shouldDeferHtmlStylesheets = (fileName: string) =>
  fileName === "index.html" || fileName.startsWith("game/");

export function optimizeRootInitialLoadPlugin(): Plugin {
  return {
    name: "calculate:optimize-root-initial-load",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const typedBundle = bundle as BundleLike;
      const indexHtml = typedBundle["index.html"];
      if (!isHtmlAsset(indexHtml)) {
        throw new TypeError("Could not find index.html in build output.");
      }

      injectGameRouteStylesheet(typedBundle);

      for (const [fileName, htmlAsset] of Object.entries(typedBundle)) {
        if (!fileName.endsWith(".html") || !isHtmlAsset(htmlAsset)) continue;
        const optimizedHtml = optimizeHtmlAsset(htmlAsset.source, typedBundle, {
          shouldDeferStylesheets: shouldDeferHtmlStylesheets(fileName),
        });
        htmlAsset.source =
          fileName === "index.html" ? optimizeIndexHtml(optimizedHtml) : optimizedHtml;
      }
    },
  };
}
