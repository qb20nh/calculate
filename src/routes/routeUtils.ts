import { match, P } from "ts-pattern";
import {
  CUSTOM_GAME_LIMITS,
  isValidRetryCount,
  validateCustomGameConfig,
} from "@/services/customGameConfig";
import type { CustomGameConfig, Difficulty, GameMode } from "@/services/storage";

const DIFFICULTY_BY_SLUG = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const satisfies Record<string, Difficulty>;

type DifficultySlug = keyof typeof DIFFICULTY_BY_SLUG;
type StandardGameMode = Exclude<GameMode, "Custom">;
type GameModeSlug = DifficultySlug | "custom" | "crossing";

const FALLBACK_ORIGIN = "https://calculate.local";

const isDifficultySlug = (slug: string): slug is DifficultySlug => slug in DIFFICULTY_BY_SLUG;
const isGameModeSlug = (slug: string): slug is GameModeSlug =>
  slug === "custom" || slug === "crossing" || isDifficultySlug(slug);

export const normalizeBasePath = (basePath: string) => {
  const pathname = new URL(basePath || "/", FALLBACK_ORIGIN).pathname.replaceAll(/\/+$/g, "");
  return pathname || "/";
};

const BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

export const addBasePath = (url: string, basePath = BASE_PATH) => {
  const parsedUrl = new URL(url, FALLBACK_ORIGIN);
  const base = normalizeBasePath(basePath);
  if (base === "/" || parsedUrl.pathname === base || parsedUrl.pathname.startsWith(`${base}/`)) {
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  }
  return `${base}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
};

export const removeBasePath = (url: string, basePath = BASE_PATH) => {
  const parsedUrl = new URL(url, FALLBACK_ORIGIN);
  const base = normalizeBasePath(basePath);
  if (base === "/") return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  if (parsedUrl.pathname === base) return `/${parsedUrl.search}${parsedUrl.hash}`;
  if (parsedUrl.pathname.startsWith(`${base}/`)) {
    return `${parsedUrl.pathname.slice(base.length)}${parsedUrl.search}${parsedUrl.hash}`;
  }
  return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
};

const toGameModeSlug = (mode: StandardGameMode): DifficultySlug | "crossing" =>
  match(mode)
    .with("Easy", () => "easy" as const)
    .with("Medium", () => "medium" as const)
    .with("Hard", () => "hard" as const)
    .with("Crossing", () => "crossing" as const)
    .exhaustive();

export const toGamePath = (mode: StandardGameMode, stage: number) => {
  return `/game/${toGameModeSlug(mode)}?stage=${stage}`;
};

export const toCustomGamePath = (config: CustomGameConfig, retryCount?: number) => {
  const searchParams = new URLSearchParams();
  searchParams.set("given", String(config.givenCount));
  searchParams.set("inventory", String(config.inventoryCount));
  searchParams.set("size", String(config.sizeLimit));
  searchParams.set("seed", config.seed);
  const finalRetry = retryCount ?? config.attempt ?? 0;
  searchParams.set("retryCount", String(finalRetry));
  if (config.limitSolutionSize) {
    searchParams.set("limitSolutionSize", "1");
  }
  return `/game/custom?${searchParams.toString()}`;
};

export const parseDifficultySlug = (slug?: string): Difficulty | null => {
  if (!slug || !isDifficultySlug(slug)) return null;
  return DIFFICULTY_BY_SLUG[slug];
};

export const parseGameModeSlug = (slug?: string): GameMode | null => {
  if (!slug || !isGameModeSlug(slug)) return null;
  return match(slug)
    .with("custom", () => "Custom" as const)
    .with("crossing", () => "Crossing" as const)
    .with(P.union("easy", "medium", "hard"), (difficultySlug) => DIFFICULTY_BY_SLUG[difficultySlug])
    .exhaustive();
};

export const parseCustomGameConfig = (searchParams: URLSearchParams): CustomGameConfig | null => {
  const givenRaw = searchParams.get("given");
  const inventoryRaw = searchParams.get("inventory");
  const sizeRaw = searchParams.get("size");
  const seedRaw = searchParams.get("seed");
  const limitSolutionSizeRaw = searchParams.get("limitSolutionSize");

  if (givenRaw === null && inventoryRaw === null && sizeRaw === null && seedRaw === null) {
    return null;
  }

  const givenCount = Number(givenRaw);
  const inventoryCount = Number(inventoryRaw);
  const sizeLimit = Number(sizeRaw);
  if (
    !Number.isSafeInteger(givenCount) ||
    givenCount < 0 ||
    !Number.isSafeInteger(inventoryCount) ||
    inventoryCount < 0 ||
    !Number.isSafeInteger(sizeLimit) ||
    sizeLimit < 1 ||
    seedRaw === null ||
    seedRaw.length > CUSTOM_GAME_LIMITS.maxSeedLength
  ) {
    return null;
  }

  if (
    limitSolutionSizeRaw !== null &&
    limitSolutionSizeRaw !== "0" &&
    limitSolutionSizeRaw !== "1" &&
    limitSolutionSizeRaw !== "false" &&
    limitSolutionSizeRaw !== "true"
  ) {
    return null;
  }

  const baseConfig: CustomGameConfig = {
    givenCount,
    inventoryCount,
    sizeLimit,
    seed: seedRaw,
    limitSolutionSize: limitSolutionSizeRaw === "1" || limitSolutionSizeRaw === "true",
  };

  const retryCountRaw = searchParams.get("retryCount");
  const config =
    retryCountRaw === null
      ? baseConfig
      : (() => {
          const attempt = Number(retryCountRaw);
          if (!isValidRetryCount(attempt)) return null;
          return { ...baseConfig, attempt };
        })();

  return config && validateCustomGameConfig(config) === null ? config : null;
};

export const parseCustomGameRetryCount = (searchParams: URLSearchParams): number => {
  const retryCountRaw = searchParams.get("retryCount");
  if (retryCountRaw === null) return 0;

  const retryCount = Number(retryCountRaw);
  return isValidRetryCount(retryCount) ? retryCount : 0;
};

export const parseStageParam = (stageParam?: string | null): number | null => {
  if (stageParam === undefined || stageParam === null) return null;
  const stage = Number(stageParam);
  return Number.isSafeInteger(stage) && stage >= 1 ? stage : null;
};
