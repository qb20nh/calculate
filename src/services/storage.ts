import {
  CUSTOM_GAME_LIMITS,
  isValidRetryCount,
  validateCustomGameConfig,
} from "@/services/customGameConfig";
import type { TileData } from "@/services/math";
import { OP_DIV, OP_MINUS, OP_MULT, OP_PLUS, REL_EQ, REL_GT, REL_LT } from "@/services/math";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type GameMode = Difficulty | "Custom" | "Crossing";

export interface CustomGameConfig {
  givenCount: number;
  inventoryCount: number;
  sizeLimit: number;
  seed: string;
  limitSolutionSize: boolean;
  attempt?: number;
}

export interface GameState {
  board: { [key: string]: TileData };
  bank: TileData[];
  initialBankSize: number;
  status: "playing" | "won";
  difficulty: GameMode;
  stage: number;
  customConfig?: CustomGameConfig;
  solvedAcknowledged?: boolean;
}

export type Progress = Record<Difficulty, { current: number; max: number }>;

const STORAGE_KEY_PROGRESS = "math_scrabble_progress";
const STORAGE_KEY_STATE = "math_scrabble_state";
export const DEFAULT_PROGRESS: Progress = {
  Easy: { current: 1, max: 1 },
  Medium: { current: 1, max: 1 },
  Hard: { current: 1, max: 1 },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDifficulty = (value: unknown): value is Difficulty =>
  value === "Easy" || value === "Medium" || value === "Hard";

const isGameMode = (value: unknown): value is GameMode =>
  isDifficulty(value) || value === "Custom" || value === "Crossing";

const isCustomGameConfig = (value: unknown): value is CustomGameConfig =>
  isRecord(value) &&
  typeof value.givenCount === "number" &&
  typeof value.inventoryCount === "number" &&
  typeof value.sizeLimit === "number" &&
  typeof value.seed === "string" &&
  typeof value.limitSolutionSize === "boolean" &&
  (value.attempt === undefined || isValidRetryCount(value.attempt)) &&
  validateCustomGameConfig(value) === null;

const isProgressEntry = (value: unknown): value is { current: number; max: number } =>
  isRecord(value) &&
  typeof value.current === "number" &&
  Number.isSafeInteger(value.current) &&
  value.current >= 1 &&
  typeof value.max === "number" &&
  Number.isSafeInteger(value.max) &&
  value.max >= 1;

const normalizeProgress = (value: unknown): Progress | null => {
  if (!isRecord(value)) return null;

  const readEntry = (key: Difficulty) => {
    const entry = value[key];
    return isProgressEntry(entry) ? entry : DEFAULT_PROGRESS[key];
  };

  return {
    Easy: readEntry("Easy"),
    Medium: readEntry("Medium"),
    Hard: readEntry("Hard"),
  };
};

const isTileType = (value: unknown): value is TileData["type"] =>
  value === "val" || value === "op" || value === "rel";

const VALID_SINGLE_TILE_VALUES = new Set([
  OP_PLUS,
  OP_MINUS,
  OP_MULT,
  OP_DIV,
  REL_EQ,
  REL_LT,
  REL_GT,
  ..."0123456789",
]);

const isTileValue = (value: unknown): value is string =>
  typeof value === "string" &&
  ((value.length === 1 && VALID_SINGLE_TILE_VALUES.has(value)) ||
    (value.length === 2 && value === `${REL_LT}${REL_GT}`));

const isTileData = (value: unknown): value is TileData =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  value.id.length <= 80 &&
  isTileValue(value.val) &&
  isTileType(value.type) &&
  (value.isGiven === undefined || typeof value.isGiven === "boolean");

const isBoardKey = (key: string) => {
  const match = /^-?\d+,-?\d+$/.exec(key);
  if (!match) return false;
  const [rowRaw, colRaw] = key.split(",");
  const row = Number(rowRaw);
  const col = Number(colRaw);
  const maxCoordinate = CUSTOM_GAME_LIMITS.maxSizeLimit * 5;
  return (
    Number.isSafeInteger(row) &&
    Number.isSafeInteger(col) &&
    Math.abs(row) <= maxCoordinate &&
    Math.abs(col) <= maxCoordinate
  );
};

const isBoard = (value: unknown): value is GameState["board"] => {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > CUSTOM_GAME_LIMITS.maxTotalTiles) return false;
  return entries.every(([key, tile]) => isBoardKey(key) && isTileData(tile));
};

const isGameState = (value: unknown): value is GameState => {
  if (!isRecord(value)) return false;
  if (!isBoard(value.board)) return false;
  if (!Array.isArray(value.bank) || value.bank.length > CUSTOM_GAME_LIMITS.maxTotalTiles) {
    return false;
  }
  if (!value.bank.every(isTileData)) return false;
  if (
    typeof value.initialBankSize !== "number" ||
    !Number.isSafeInteger(value.initialBankSize) ||
    value.initialBankSize < 0 ||
    value.initialBankSize > CUSTOM_GAME_LIMITS.maxTotalTiles
  ) {
    return false;
  }
  if (value.status !== "playing" && value.status !== "won") return false;
  if (!isGameMode(value.difficulty)) return false;
  if (
    typeof value.stage !== "number" ||
    !Number.isSafeInteger(value.stage) ||
    value.stage < 1 ||
    value.stage > CUSTOM_GAME_LIMITS.maxRetryCount
  ) {
    return false;
  }
  if (value.difficulty === "Custom" && !isCustomGameConfig(value.customConfig)) return false;
  if (value.difficulty !== "Custom" && value.customConfig !== undefined) return false;
  if (value.solvedAcknowledged !== undefined && typeof value.solvedAcknowledged !== "boolean") {
    return false;
  }
  return true;
};

export const sanitizeStoredGameState = (value: unknown): GameState | null =>
  isGameState(value) ? value : null;

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const getStorage = () =>
  typeof localStorage !== "undefined" &&
  typeof localStorage.getItem === "function" &&
  typeof localStorage.setItem === "function" &&
  typeof localStorage.removeItem === "function"
    ? localStorage
    : null;

export const saveProgress = (progress: Progress) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
  } catch {
    // Ignore quota/private-mode storage failures.
  }
};

export const loadProgress = (): Progress => {
  const storage = getStorage();
  if (!storage) {
    return DEFAULT_PROGRESS;
  }

  const saved = parseJson<unknown>(storage.getItem(STORAGE_KEY_PROGRESS));
  return normalizeProgress(saved) ?? DEFAULT_PROGRESS;
};

export const saveGameState = (state: GameState | null) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (state) {
      storage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    } else {
      storage.removeItem(STORAGE_KEY_STATE);
    }
  } catch {
    // Ignore quota/private-mode storage failures.
  }
};

export const loadGameState = (): GameState | null => {
  const storage = getStorage();
  if (!storage) return null;

  const saved = parseJson<unknown>(storage.getItem(STORAGE_KEY_STATE));
  return sanitizeStoredGameState(saved);
};
