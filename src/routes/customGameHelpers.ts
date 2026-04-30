import type { CustomGameConfig } from "@/services/storage";

export const readRandomSeed = () => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(buf[0] ?? Date.now());
  }
  return String(Date.now());
};

export const normalizeSeed = (rawSeed: string) => {
  const trimmed = rawSeed.trim();
  if (trimmed === "" || trimmed === "0") {
    return readRandomSeed();
  }
  return trimmed;
};

export const sameCustomConfig = (
  left: CustomGameConfig | null | undefined,
  right: CustomGameConfig,
  compareAttempt: boolean,
) =>
  !!left &&
  left.givenCount === right.givenCount &&
  left.inventoryCount === right.inventoryCount &&
  left.sizeLimit === right.sizeLimit &&
  left.seed === right.seed &&
  (left.limitSolutionSize ?? false) === right.limitSolutionSize &&
  (!compareAttempt || left.attempt === right.attempt);
