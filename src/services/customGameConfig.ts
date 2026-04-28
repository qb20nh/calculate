import type { CustomGameConfig } from "@/services/storage";

export const CUSTOM_GAME_LIMITS = {
  minSizeLimit: 5,
  maxSizeLimit: 20,
  minTotalTiles: 9,
  maxTotalTiles: 120,
  maxSeedLength: 64,
  minRetryCount: 0,
  maxRetryCount: 9999,
} as const;

type CustomGameValidationKey =
  | "givenCountPositive"
  | "inventoryCountPositive"
  | "sizeLimitPositive"
  | "settingsInvalid"
  | "totalTiles"
  | "sizeLimitMin"
  | "sizeLimitMax"
  | "tileCountExceeds"
  | "seedTooLong";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isValidRetryCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= CUSTOM_GAME_LIMITS.minRetryCount &&
  value <= CUSTOM_GAME_LIMITS.maxRetryCount;

export const validateCustomGameConfig = (
  config: CustomGameConfig | unknown,
): CustomGameValidationKey | null => {
  if (!isRecord(config)) return "settingsInvalid";

  const givenCount = config.givenCount;
  const inventoryCount = config.inventoryCount;
  const sizeLimit = config.sizeLimit;
  const seed = config.seed;
  const limitSolutionSize = config.limitSolutionSize;
  const attempt = config.attempt;

  if (!Number.isSafeInteger(givenCount) || Number(givenCount) <= 0) {
    return "givenCountPositive";
  }
  if (!Number.isSafeInteger(inventoryCount) || Number(inventoryCount) <= 0) {
    return "inventoryCountPositive";
  }
  if (!Number.isSafeInteger(sizeLimit) || Number(sizeLimit) <= 0) {
    return "sizeLimitPositive";
  }
  if (typeof limitSolutionSize !== "boolean" || typeof seed !== "string") {
    return "settingsInvalid";
  }
  const totalTiles = Number(givenCount) + Number(inventoryCount);
  if (totalTiles < CUSTOM_GAME_LIMITS.minTotalTiles) {
    return "totalTiles";
  }
  if (Number(sizeLimit) < CUSTOM_GAME_LIMITS.minSizeLimit) {
    return "sizeLimitMin";
  }
  if (Number(sizeLimit) > CUSTOM_GAME_LIMITS.maxSizeLimit) {
    return "sizeLimitMax";
  }
  if (totalTiles > CUSTOM_GAME_LIMITS.maxTotalTiles) {
    return "tileCountExceeds";
  }
  if (totalTiles > Number(sizeLimit) * Number(sizeLimit)) {
    return "tileCountExceeds";
  }
  if (seed.length > CUSTOM_GAME_LIMITS.maxSeedLength) {
    return "seedTooLong";
  }
  if (attempt !== undefined && !isValidRetryCount(attempt)) {
    return "settingsInvalid";
  }
  return null;
};
