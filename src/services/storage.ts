import type { TileData } from "@/services/math";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface GameState {
  board: { [key: string]: TileData };
  bank: TileData[];
  initialBankSize: number;
  status: "playing" | "won";
  difficulty: Difficulty;
  stage: number;
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

const isProgressEntry = (value: unknown): value is { current: number; max: number } =>
  isRecord(value) &&
  typeof value.current === "number" &&
  Number.isFinite(value.current) &&
  typeof value.max === "number" &&
  Number.isFinite(value.max);

const isProgress = (value: unknown): value is Progress =>
  isRecord(value) &&
  isProgressEntry(value.Easy) &&
  isProgressEntry(value.Medium) &&
  isProgressEntry(value.Hard);

const isGameState = (value: unknown): value is GameState =>
  isRecord(value) &&
  isRecord(value.board) &&
  Array.isArray(value.bank) &&
  typeof value.initialBankSize === "number" &&
  Number.isFinite(value.initialBankSize) &&
  (value.status === "playing" || value.status === "won") &&
  isDifficulty(value.difficulty) &&
  typeof value.stage === "number" &&
  Number.isSafeInteger(value.stage) &&
  value.stage >= 1;

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
  return isProgress(saved) ? saved : DEFAULT_PROGRESS;
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
  return isGameState(saved) ? saved : null;
};
