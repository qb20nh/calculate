import type { Difficulty } from "@/services/storage";

const DIFFICULTY_BY_SLUG = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const satisfies Record<string, Difficulty>;

type DifficultySlug = keyof typeof DIFFICULTY_BY_SLUG;

const FALLBACK_ORIGIN = "https://calculate.local";

const isDifficultySlug = (slug: string): slug is DifficultySlug => slug in DIFFICULTY_BY_SLUG;

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

export const parseDifficultySlug = (slug?: string): Difficulty | null => {
  if (!slug || !isDifficultySlug(slug)) return null;
  return DIFFICULTY_BY_SLUG[slug];
};

export const parseStageParam = (stageParam?: string | null): number | null => {
  if (stageParam === undefined || stageParam === null) return null;
  const stage = Number(stageParam);
  return Number.isSafeInteger(stage) && stage >= 1 ? stage : null;
};
