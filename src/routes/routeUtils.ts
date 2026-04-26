import type { CustomGameConfig, Difficulty, GameMode } from "@/services/storage";

const DIFFICULTY_BY_SLUG = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const satisfies Record<string, Difficulty>;

type DifficultySlug = keyof typeof DIFFICULTY_BY_SLUG;
type GameModeSlug = DifficultySlug | "custom";

const FALLBACK_ORIGIN = "https://calculate.local";

const isDifficultySlug = (slug: string): slug is DifficultySlug => slug in DIFFICULTY_BY_SLUG;
const isGameModeSlug = (slug: string): slug is GameModeSlug =>
  slug === "custom" || isDifficultySlug(slug);

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

const toDifficultySlug = (difficulty: Difficulty): DifficultySlug =>
  difficulty.toLowerCase() as DifficultySlug;

export const toGamePath = (difficulty: Difficulty, stage: number) => {
  return `/game/${toDifficultySlug(difficulty)}?stage=${stage}`;
};

export const toCustomGamePath = (config: CustomGameConfig) => {
  const searchParams = new URLSearchParams();
  searchParams.set("given", String(config.givenCount));
  searchParams.set("inventory", String(config.inventoryCount));
  searchParams.set("size", String(config.sizeLimit));
  searchParams.set("seed", config.seed);
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
  return slug === "custom" ? "Custom" : DIFFICULTY_BY_SLUG[slug];
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
    seedRaw === null
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

  return {
    givenCount,
    inventoryCount,
    sizeLimit,
    seed: seedRaw,
    limitSolutionSize: limitSolutionSizeRaw === "1" || limitSolutionSizeRaw === "true",
  };
};

export const parseStageParam = (stageParam?: string | null): number | null => {
  if (stageParam === undefined || stageParam === null) return null;
  const stage = Number(stageParam);
  return Number.isSafeInteger(stage) && stage >= 1 ? stage : null;
};
