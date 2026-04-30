import { describe, expect, it } from "vitest";
import { normalizeSeed, readRandomSeed, sameCustomConfig } from "@/routes/customGameHelpers";
import type { CustomGameConfig } from "@/services/storage";

describe("custom game helper utilities", () => {
  it("should normalize blank and explicit zero seeds as random values", () => {
    const blankSeed = normalizeSeed("");
    const zeroSeed = normalizeSeed("0");

    expect(blankSeed).toEqual(expect.any(String));
    expect(zeroSeed).toEqual(expect.any(String));
    expect(blankSeed).not.toEqual("");
    expect(zeroSeed).not.toEqual("");
  });

  it("should normalize whitespace without changing valid seed", () => {
    expect(normalizeSeed("  abc  ")).toBe("abc");
  });

  it("should compare custom configs with and without attempt", () => {
    const left: CustomGameConfig = {
      givenCount: 8,
      inventoryCount: 12,
      sizeLimit: 10,
      seed: "abc",
      limitSolutionSize: false,
      attempt: 4,
    };
    const right: CustomGameConfig = {
      givenCount: 8,
      inventoryCount: 12,
      sizeLimit: 10,
      seed: "abc",
      limitSolutionSize: false,
      attempt: 4,
    };

    expect(sameCustomConfig(left, right, true)).toBe(true);
    expect(sameCustomConfig({ ...left, attempt: 3 }, right, true)).toBe(false);
    expect(sameCustomConfig({ ...left, attempt: 3 }, right, false)).toBe(true);
  });

  it("should expose random seed strings", () => {
    const seed = readRandomSeed();
    expect(seed).toEqual(expect.any(String));
    expect(seed).not.toEqual("");
  });
});
