import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

type Rgb = readonly [number, number, number];
type Theme = ReadonlyMap<string, string>;

const MIN_AA_CONTRAST = 4.5;

const css = readFileSync("src/style.css", "utf8");

const extractDeclarations = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(css);
  if (!match?.[1]) throw new Error(`Missing ${selector} theme block`);

  const declarations = new Map<string, string>();
  for (const declaration of match[1].matchAll(/(--[-_a-zA-Z0-9]+):\s*([^;]+);/g)) {
    declarations.set(declaration[1] ?? "", declaration[2]?.trim() ?? "");
  }
  return declarations;
};

const lightTheme = extractDeclarations(":root");
const darkTheme = new Map([...lightTheme, ...extractDeclarations(':root[data-theme="dark"]')]);

const parseHex = (value: string): Rgb => {
  const normalized =
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
};

const mixRgb = (first: Rgb, firstWeight: number, second: Rgb): Rgb => [
  Math.round(first[0] * firstWeight + second[0] * (1 - firstWeight)),
  Math.round(first[1] * firstWeight + second[1] * (1 - firstWeight)),
  Math.round(first[2] * firstWeight + second[2] * (1 - firstWeight)),
];

const createResolver = (theme: Theme) => {
  const resolve = (value: string, seen = new Set<string>()): Rgb => {
    const trimmed = value.trim();

    if (trimmed === "white") return [255, 255, 255];
    if (trimmed === "black") return [0, 0, 0];
    if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(trimmed)) return parseHex(trimmed);

    const variable = /^var\((--[-_a-zA-Z0-9]+)\)$/.exec(trimmed)?.[1];
    if (variable) {
      if (seen.has(variable)) throw new Error(`Circular color variable ${variable}`);
      const token = theme.get(variable);
      if (!token) throw new Error(`Missing color variable ${variable}`);
      return resolve(token, new Set([...seen, variable]));
    }

    const colorMix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+?)\)$/.exec(trimmed);
    if (colorMix) {
      const first = resolve(colorMix[1] ?? "", seen);
      const second = resolve(colorMix[3] ?? "", seen);
      return mixRgb(first, Number(colorMix[2]) / 100, second);
    }

    throw new Error(`Unsupported color value: ${value}`);
  };

  return resolve;
};

const linearize = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: Rgb) =>
  0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2]);

const contrastRatio = (foreground: Rgb, background: Rgb) => {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const expectAaContrast = (
  themeName: string,
  label: string,
  resolve: (value: string) => Rgb,
  foreground: string,
  background: string,
) => {
  const ratio = contrastRatio(resolve(foreground), resolve(background));
  if (ratio < MIN_AA_CONTRAST) {
    throw new Error(`${themeName} ${label} contrast ${ratio.toFixed(2)} < ${MIN_AA_CONTRAST}`);
  }
};

const contrastPairs = [
  ["body text", "var(--theme-ink)", "var(--theme-bg)"],
  ["panel text", "var(--theme-ink)", "var(--theme-surface)"],
  ["strong panel text", "var(--theme-ink)", "var(--theme-surface-strong)"],
  ["muted page text", "var(--theme-muted)", "var(--theme-bg)"],
  ["muted panel text", "var(--theme-muted)", "var(--theme-surface)"],
  ["muted primary control text", "var(--theme-muted)", "var(--theme-primary-soft)"],
  [
    "input placeholder",
    "var(--theme-muted)",
    "color-mix(in srgb, var(--theme-surface) 94%, var(--theme-bg))",
  ],
  ["primary soft text", "var(--theme-primary-text)", "var(--theme-primary-soft)"],
  ["relation soft text", "var(--theme-relation-text)", "var(--theme-relation-soft)"],
  ["primary hover text", "var(--theme-primary-text)", "var(--theme-primary-soft)"],
  ["danger hover text", "var(--theme-danger)", "var(--theme-danger-soft)"],
  ["primary action text", "white", "var(--theme-primary-bg)"],
  ["relation badge text", "white", "var(--theme-relation-bg)"],
  ["number badge text", "white", "var(--theme-number-bg)"],
  ["operator badge text", "white", "var(--theme-operator-bg)"],
  ["danger action text", "white", "var(--theme-danger-bg)"],
  ["danger soft text", "var(--theme-ink)", "var(--theme-danger-soft)"],
  ["danger text", "var(--theme-danger)", "var(--theme-surface)"],
  [
    "number soft text",
    "color-mix(in srgb, var(--theme-number) 78%, var(--theme-ink))",
    "var(--theme-number-soft)",
  ],
  [
    "operator soft text",
    "color-mix(in srgb, var(--theme-operator) 90%, var(--theme-ink))",
    "var(--theme-operator-soft)",
  ],
  [
    "number tile text",
    "color-mix(in srgb, var(--theme-number) 84%, var(--theme-ink))",
    "color-mix(in srgb, var(--theme-number) 10%, var(--theme-surface))",
  ],
  [
    "operator tile text",
    "color-mix(in srgb, var(--theme-operator) 92%, var(--theme-ink))",
    "color-mix(in srgb, var(--theme-operator) 10%, var(--theme-surface))",
  ],
  [
    "relation tile text",
    "color-mix(in srgb, var(--theme-relation) 86%, var(--theme-ink))",
    "color-mix(in srgb, var(--theme-relation) 10%, var(--theme-surface))",
  ],
  [
    "given tile text",
    "color-mix(in srgb, var(--theme-surface) 98%, var(--theme-ink))",
    "color-mix(in srgb, var(--theme-ink) 88%, var(--theme-bg))",
  ],
] as const;

describe("theme color contrast", () => {
  it("should keep component text colors at WCAG AA contrast in light and dark mode", () => {
    for (const [themeName, theme] of [
      ["light", lightTheme],
      ["dark", darkTheme],
    ] as const) {
      const resolve = createResolver(theme);

      for (const [label, foreground, background] of contrastPairs) {
        expectAaContrast(themeName, label, resolve, foreground, background);
      }
    }
  });
});
