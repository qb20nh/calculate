import typia, { type tags } from "typia";
import { CUSTOM_GAME_LIMITS, validateCustomGameConfig } from "@/services/customGameConfig";
import type {
  OP_DIV,
  OP_MINUS,
  OP_MULT,
  OP_PLUS,
  REL_EQ,
  REL_GT,
  REL_LT,
  TileData,
} from "@/services/math";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type GameMode = Difficulty | "Custom" | "Crossing";
export type ProgressMode = Difficulty | "Crossing";
type ProgressEntry = Readonly<{ current: number; max: number }>;

export interface CustomGameConfig {
  readonly givenCount: number;
  readonly inventoryCount: number;
  readonly sizeLimit: number;
  readonly seed: string;
  readonly limitSolutionSize: boolean;
  readonly attempt?: number;
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

export type Progress = Record<Difficulty, ProgressEntry> &
  Partial<Record<"Crossing", ProgressEntry>>;

type NonNegativeInt = number & tags.Type<"uint32">;
type PositiveInt = NonNegativeInt & tags.Minimum<1>;
type TileId = string & tags.MinLength<1> & tags.MaxLength<80>;
type TileDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type StoredTileValue =
  | TileDigit
  | typeof OP_PLUS
  | typeof OP_MINUS
  | typeof OP_MULT
  | typeof OP_DIV
  | typeof REL_EQ
  | typeof REL_LT
  | typeof REL_GT
  | `${typeof REL_LT}${typeof REL_GT}`;

type StoredTileData = Omit<TileData, "id" | "val"> & {
  id: TileId;
  val: StoredTileValue;
};

type StoredProgressEntry = {
  current: PositiveInt;
  max: PositiveInt;
};

type StoredCustomGameConfig = {
  givenCount: NonNegativeInt;
  inventoryCount: NonNegativeInt;
  sizeLimit: PositiveInt;
  seed: string & tags.MaxLength<typeof CUSTOM_GAME_LIMITS.maxSeedLength>;
  limitSolutionSize: boolean;
  attempt?: NonNegativeInt & tags.Maximum<typeof CUSTOM_GAME_LIMITS.maxRetryCount>;
};

type StoredGameStateShape = {
  board: Record<string, StoredTileData>;
  bank: StoredTileData[] & tags.MaxItems<typeof CUSTOM_GAME_LIMITS.maxTotalTiles>;
  initialBankSize: NonNegativeInt & tags.Maximum<typeof CUSTOM_GAME_LIMITS.maxTotalTiles>;
  status: "playing" | "won";
  difficulty: GameMode;
  stage: PositiveInt & tags.Maximum<typeof CUSTOM_GAME_LIMITS.maxRetryCount>;
  customConfig?: StoredCustomGameConfig;
  solvedAcknowledged?: boolean;
};

const STORAGE_KEY_PROGRESS = "math_scrabble_progress";
const STORAGE_KEY_STATE = "math_scrabble_state";
const STORAGE_KEY_CLEARED_STATES = "math_scrabble_cleared_states";
export const DEFAULT_PROGRESS: Record<ProgressMode, ProgressEntry> = {
  Easy: { current: 1, max: 1 },
  Medium: { current: 1, max: 1 },
  Hard: { current: 1, max: 1 },
  Crossing: { current: 1, max: 1 },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDifficulty = (value: unknown): value is Difficulty =>
  value === "Easy" || value === "Medium" || value === "Hard";

const isGameMode = (value: unknown): value is GameMode =>
  isDifficulty(value) || value === "Custom" || value === "Crossing";

const isProgressMode = (value: unknown): value is ProgressMode =>
  isDifficulty(value) || value === "Crossing";

export const getClearedStateKey = (difficulty: ProgressMode, stage: number) =>
  `${difficulty}:${stage}`;

const isProgressEntry = typia.createIs<StoredProgressEntry>();
const isStoredGameStateShape = typia.createIs<StoredGameStateShape>();
const parseStoredGameState = typia.json.createIsParse<StoredGameStateShape>();
const stringifyProgress = typia.json.createStringify<Progress>();
const stringifyGameState = typia.json.createStringify<GameState>();
const stringifyClearedGameStates = typia.json.createStringify<Record<string, GameState>>();

const normalizeProgress = (value: unknown): Progress | null => {
  if (!isRecord(value)) return null;

  const readEntry = (key: ProgressMode) => {
    const entry = value[key];
    return isProgressEntry(entry) ? entry : DEFAULT_PROGRESS[key];
  };

  return {
    Easy: readEntry("Easy"),
    Medium: readEntry("Medium"),
    Hard: readEntry("Hard"),
    Crossing: readEntry("Crossing"),
  };
};

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
  return entries.every(([key]) => isBoardKey(key));
};

const isGameState = (value: unknown): value is GameState => {
  if (!isStoredGameStateShape(value)) return false;
  if (!isBoard(value.board)) return false;
  if (!isGameMode(value.difficulty)) return false;
  if (value.difficulty === "Custom" && validateCustomGameConfig(value.customConfig) !== null) {
    return false;
  }
  if (value.difficulty !== "Custom" && value.customConfig !== undefined) return false;
  return true;
};

export const sanitizeStoredGameState = (value: unknown): GameState | null =>
  isGameState(value) ? value : null;

const sanitizeStoredClearedGameStates = (value: unknown): Record<string, GameState> => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, state]) => {
      const sanitized = sanitizeStoredGameState(state);
      if (!sanitized || !isProgressMode(sanitized.difficulty)) return [];
      if (key !== getClearedStateKey(sanitized.difficulty, sanitized.stage)) return [];
      return [[key, sanitized]];
    }),
  );
};

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const parseStoredGameStateJson = (raw: string | null) => {
  if (!raw) return null;
  try {
    return parseStoredGameState(raw);
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
    storage.setItem(STORAGE_KEY_PROGRESS, stringifyProgress(progress));
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
      storage.setItem(STORAGE_KEY_STATE, stringifyGameState(state));
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

  const saved = parseStoredGameStateJson(storage.getItem(STORAGE_KEY_STATE));
  return sanitizeStoredGameState(saved);
};

export const loadClearedGameStates = (): Record<string, GameState> => {
  const storage = getStorage();
  if (!storage) return {};

  const saved = parseJson<unknown>(storage.getItem(STORAGE_KEY_CLEARED_STATES));
  return sanitizeStoredClearedGameStates(saved);
};

export const saveClearedGameStates = (states: Record<string, GameState>) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY_CLEARED_STATES, stringifyClearedGameStates(states));
  } catch {
    // Ignore quota/private-mode storage failures.
  }
};

export const saveClearedGameState = (state: GameState) => {
  if (!isProgressMode(state.difficulty)) return;

  saveClearedGameStates({
    ...loadClearedGameStates(),
    [getClearedStateKey(state.difficulty, state.stage)]: state,
  });
};

export const loadClearedGameState = (difficulty: ProgressMode, stage: number): GameState | null => {
  const state = loadClearedGameStates()[getClearedStateKey(difficulty, stage)];
  return state ?? null;
};

export const clearClearedGameState = (difficulty: ProgressMode, stage: number) => {
  const clearedStateKey = getClearedStateKey(difficulty, stage);
  saveClearedGameStates(
    Object.fromEntries(
      Object.entries(loadClearedGameStates()).filter(([key]) => key !== clearedStateKey),
    ),
  );
};
