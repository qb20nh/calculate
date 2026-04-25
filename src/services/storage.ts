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
  storage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
};

export const loadProgress = (): Progress => {
  const storage = getStorage();
  if (!storage) {
    return {
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    };
  }

  const saved = storage.getItem(STORAGE_KEY_PROGRESS);
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    Easy: { current: 1, max: 1 },
    Medium: { current: 1, max: 1 },
    Hard: { current: 1, max: 1 },
  };
};

export const saveGameState = (state: GameState | null) => {
  const storage = getStorage();
  if (!storage) return;

  if (state) {
    storage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
  } else {
    storage.removeItem(STORAGE_KEY_STATE);
  }
};

export const loadGameState = (): GameState | null => {
  const storage = getStorage();
  if (!storage) return null;

  const saved = storage.getItem(STORAGE_KEY_STATE);
  if (saved) {
    return JSON.parse(saved);
  }
  return null;
};
