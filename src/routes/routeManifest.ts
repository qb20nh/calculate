import type { Difficulty, GameMode } from "../services/storage";

export const DIFFICULTY_BY_SLUG = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const satisfies Record<string, Difficulty>;

type DifficultySlug = keyof typeof DIFFICULTY_BY_SLUG;
export type StandardGameMode = Exclude<GameMode, "Custom">;
type GameModeSlug = DifficultySlug | "custom" | "crossing";
type ReadyRoute = "menu" | "game" | "custom-setup" | "notfound";

export const GAME_MODE_BY_SLUG = {
  ...DIFFICULTY_BY_SLUG,
  custom: "Custom",
  crossing: "Crossing",
} as const satisfies Record<GameModeSlug, GameMode>;

export const STANDARD_GAME_MODE_SLUG_BY_MODE = {
  Easy: "easy",
  Medium: "medium",
  Hard: "hard",
  Crossing: "crossing",
} as const satisfies Record<StandardGameMode, DifficultySlug | "crossing">;

const GAME_ROUTE_SLUGS = Object.keys(GAME_MODE_BY_SLUG) as GameModeSlug[];

export const PRERENDER_ROUTE_PATHS = [
  "/404",
  "/game",
  ...GAME_ROUTE_SLUGS.map((slug) => `/game/${slug}`),
];

export const isDifficultySlug = (slug: string): slug is DifficultySlug =>
  slug in DIFFICULTY_BY_SLUG;

export const isGameModeSlug = (slug: string): slug is GameModeSlug => slug in GAME_MODE_BY_SLUG;

const normalizeRoutePath = (pathname: string) => pathname.replace(/\/$/, "") || "/";

export const getReadyRouteForPath = (pathname: string, search = ""): ReadyRoute => {
  const routePath = normalizeRoutePath(pathname);
  if (routePath === "/") return "menu";
  if (!routePath.startsWith("/game/")) return "notfound";

  const slug = routePath.slice("/game/".length);
  if (!isGameModeSlug(slug)) return "notfound";
  if (slug === "custom") {
    return new URLSearchParams(search).has("given") ? "game" : "custom-setup";
  }
  return "game";
};

export const shouldPreloadRoutePath = (pathname: string) =>
  getReadyRouteForPath(pathname) !== "notfound" && normalizeRoutePath(pathname) !== "/";

export const isDynamicCustomGameRoutePath = (pathname: string, search: string) =>
  normalizeRoutePath(pathname) === "/game/custom" && search.length > 0;
