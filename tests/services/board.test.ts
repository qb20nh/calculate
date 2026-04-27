import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  generateCustomGame,
  generateCustomGameAttempt,
  generateGame,
  validateBoard,
} from "@/services/board";
import { OP_MINUS, OP_PLUS, REL_EQ, REL_GT } from "@/services/math";
import type { Difficulty } from "@/services/storage";

describe("board service", () => {
  const difficultyRanges: Record<Difficulty, [number, number]> = {
    Easy: [5, 7],
    Medium: [10, 14],
    Hard: [15, 21],
  };

  it("should generate a playable game for all difficulties", () => {
    const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];
    for (const diff of difficulties) {
      for (let stage = 1; stage <= 5; stage++) {
        const game = generateGame(stage, diff);
        expect(game.status).toBe("playing");
        expect(Object.keys(game.board).length).toBeGreaterThan(0);
        expect(game.bank.length).toBeGreaterThan(0);
      }
    }
  });

  it("should preserve generation constraints across stages", () => {
    const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];
    for (const diff of difficulties) {
      const [minInventory, maxInventory] = difficultyRanges[diff];
      for (let stage = 1; stage <= 10; stage++) {
        const game = generateGame(stage, diff);

        expect(game.bank.length).toBeGreaterThanOrEqual(minInventory);
        expect(game.bank.length).toBeLessThanOrEqual(maxInventory);
        expect(validateBoard(game.board).valid).toBe(false);
      }
    }
  });

  it("should keep generation constraints under property runs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.constantFrom<Difficulty>("Easy", "Medium", "Hard"),
        (stage, diff) => {
          const game = generateGame(stage, diff);
          const [minInventory, maxInventory] = difficultyRanges[diff];

          expect(game.status).toBe("playing");
          expect(Object.keys(game.board).length).toBeGreaterThan(0);
          expect(game.bank.length).toBeGreaterThan(0);
          expect(game.bank.length).toBeGreaterThanOrEqual(minInventory);
          expect(game.bank.length).toBeLessThanOrEqual(maxInventory);
          expect(generateGame(stage, diff)).toEqual(game);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("should generate deterministic games for the same stage and difficulty", () => {
    expect(generateGame(7, "Hard")).toEqual(generateGame(7, "Hard"));
  });

  it("should handle unexpected difficulty values defensively", () => {
    expect(generateGame(1, "Custom" as Difficulty).status).toBe("playing");
  });

  it("should generate custom games with exact counts and seed persistence", () => {
    const config = {
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "12345",
      limitSolutionSize: false,
    };

    const game = generateCustomGame(config);

    expect(game).not.toBeNull();
    if (!game) return;

    expect(game.status).toBe("playing");
    expect(game.difficulty).toBe("Custom");
    expect(game.stage).toBe(1);
    expect(game.customConfig).toEqual(config);
    expect(Object.keys(game.board)).toHaveLength(6);
    expect(game.bank).toHaveLength(10);
  });

  it("should reject impossible custom settings", () => {
    expect(
      generateCustomGame({
        givenCount: 20,
        inventoryCount: 20,
        sizeLimit: 5,
        seed: "1",
        limitSolutionSize: false,
      }),
    ).toBeNull();
  });

  it("should reject custom settings with too few total tiles", () => {
    expect(
      generateCustomGame({
        givenCount: 1,
        inventoryCount: 2,
        sizeLimit: 2,
        seed: "1",
        limitSolutionSize: false,
      }),
    ).toBeNull();
  });

  it("should generate a deterministic custom attempt for a given retry", () => {
    const config = {
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "12345",
      limitSolutionSize: true,
    };

    expect(generateCustomGameAttempt(config, 0)).toEqual(generateCustomGameAttempt(config, 0));
  });

  it("should hash non-numeric custom seeds", () => {
    const config = {
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "abc",
      limitSolutionSize: false,
    };

    const game = generateCustomGameAttempt(config, 0);
    expect(game).not.toBeNull();
    if (!game) return;

    expect(game.customConfig?.seed).toBe("abc");
  });

  const createTestBoard = (overrides: Record<string, string> = {}) => {
    const base = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
      "0,3": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,4": { id: "5", val: "5", type: "val" as const, isGiven: true },
    };
    for (const [key, val] of Object.entries(overrides)) {
      if (base[key as keyof typeof base]) {
        (base[key as keyof typeof base] as { val: string }).val = val;
      }
    }
    return base;
  };

  const createCrossingNetworkBoard = () => ({
    "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
    "0,1": { id: "2", val: "0", type: "val" as const, isGiven: true },
    "0,2": { id: "3", val: OP_MINUS, type: "op" as const, isGiven: true },
    "0,3": { id: "4", val: "4", type: "val" as const, isGiven: true },
    "0,4": { id: "5", val: "=", type: "rel" as const, isGiven: true },
    "0,5": { id: "6", val: "6", type: "val" as const, isGiven: true },
    "1,3": { id: "7", val: "+", type: "op" as const, isGiven: true },
    "2,3": { id: "8", val: "1", type: "val" as const, isGiven: true },
    "3,3": { id: "9", val: "=", type: "rel" as const, isGiven: true },
    "4,3": { id: "10", val: "5", type: "val" as const, isGiven: true },
  });

  const _createFalseResidualBoard = () => ({
    "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
    "0,1": { id: "2", val: "0", type: "val" as const, isGiven: true },
    "0,2": { id: "3", val: OP_MINUS, type: "op" as const, isGiven: true },
    "0,3": { id: "4", val: "4", type: "val" as const, isGiven: true },
    "0,4": { id: "5", val: "=", type: "rel" as const, isGiven: true },
    "0,5": { id: "6", val: "6", type: "val" as const, isGiven: true },
    "1,1": { id: "7", val: "+", type: "op" as const, isGiven: true },
    "2,1": { id: "8", val: "2", type: "val" as const, isGiven: true },
    "3,1": { id: "9", val: "=", type: "rel" as const, isGiven: true },
    "4,1": { id: "10", val: "5", type: "val" as const, isGiven: true },
    "1,3": { id: "11", val: "+", type: "op" as const, isGiven: true },
    "2,3": { id: "12", val: "1", type: "val" as const, isGiven: true },
    "3,3": { id: "13", val: "=", type: "rel" as const, isGiven: true },
    "4,3": { id: "14", val: "5", type: "val" as const, isGiven: true },
  });

  it("should validate a correct board", () => {
    const board = createCrossingNetworkBoard();
    expect(validateBoard(board).valid).toBe(true);
  });

  it("should validate crossing horizontal and vertical equations", () => {
    const board = {
      "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "0,3": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,4": { id: "5", val: "3", type: "val" as const, isGiven: true },
      "1,2": { id: "6", val: OP_PLUS, type: "op" as const, isGiven: true },
      "2,2": { id: "7", val: "5", type: "val" as const, isGiven: true },
      "3,2": { id: "8", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,2": { id: "9", val: "7", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should validate a crossing formula network with dangling fragments", () => {
    const result = validateBoard(createCrossingNetworkBoard());
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 1+=2", () => {
    const board = {
      "0,4": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "1,4": { id: "2", val: "0", type: "val" as const, isGiven: true },
      "2,4": { id: "3", val: "+", type: "op" as const, isGiven: true },
      "3,4": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "4,4": { id: "5", val: "0", type: "val" as const, isGiven: true },
      "5,1": { id: "6", val: "1", type: "val" as const, isGiven: true },
      "5,2": { id: "7", val: "+", type: "op" as const, isGiven: true },
      "5,3": { id: "8", val: "2", type: "val" as const, isGiven: true },
      "5,4": { id: "9", val: "=", type: "rel" as const, isGiven: true },
      "5,5": { id: "10", val: "3", type: "val" as const, isGiven: true },
      "6,0": { id: "11", val: "1", type: "val" as const, isGiven: true },
      "6,1": { id: "12", val: "+", type: "op" as const, isGiven: true },
      "6,2": { id: "13", val: "2", type: "val" as const, isGiven: true },
      "6,3": { id: "14", val: "=", type: "rel" as const, isGiven: true },
      "6,4": { id: "15", val: "3", type: "val" as const, isGiven: true },
      "7,0": { id: "16", val: "0", type: "val" as const, isGiven: true },
      "7,1": { id: "17", val: "=", type: "rel" as const, isGiven: true },
      "7,2": { id: "18", val: "0", type: "val" as const, isGiven: true },
      "7,3": { id: "19", val: OP_MINUS, type: "op" as const, isGiven: true },
      "7,4": { id: "20", val: "0", type: "val" as const, isGiven: true },
      "8,1": { id: "21", val: "2", type: "val" as const, isGiven: true },
      "8,2": { id: "22", val: "+", type: "op" as const, isGiven: true },
      "8,3": { id: "23", val: "2", type: "val" as const, isGiven: true },
      "8,4": { id: "24", val: "=", type: "rel" as const, isGiven: true },
      "8,5": { id: "25", val: "4", type: "val" as const, isGiven: true },
      "9,4": { id: "26", val: "1", type: "val" as const, isGiven: true },
      "10,4": { id: "27", val: "5", type: "val" as const, isGiven: true },
      "11,4": { id: "28", val: "+", type: "op" as const, isGiven: true },
      "12,4": { id: "29", val: "1", type: "val" as const, isGiven: true },
      "13,4": { id: "30", val: "5", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 1-3=", () => {
    const board = {
      "0,2": { id: "1", val: "3", type: "val" as const, isGiven: true },
      "1,1": { id: "2", val: "1", type: "val" as const, isGiven: true },
      "1,2": { id: "3", val: "+", type: "op" as const, isGiven: true },
      "1,3": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "1,4": { id: "5", val: "=", type: "rel" as const, isGiven: true },
      "1,5": { id: "6", val: "2", type: "val" as const, isGiven: true },
      "2,0": { id: "7", val: "1", type: "val" as const, isGiven: true },
      "2,1": { id: "8", val: OP_MINUS, type: "op" as const, isGiven: true },
      "2,2": { id: "9", val: "1", type: "val" as const, isGiven: true },
      "2,3": { id: "10", val: "=", type: "rel" as const, isGiven: true },
      "2,4": { id: "11", val: "0", type: "val" as const, isGiven: true },
      "3,1": { id: "12", val: "3", type: "val" as const, isGiven: true },
      "3,2": { id: "13", val: OP_MINUS, type: "op" as const, isGiven: true },
      "3,3": { id: "14", val: "2", type: "val" as const, isGiven: true },
      "3,4": { id: "15", val: "=", type: "rel" as const, isGiven: true },
      "3,5": { id: "16", val: "1", type: "val" as const, isGiven: true },
      "4,0": { id: "17", val: "2", type: "val" as const, isGiven: true },
      "4,1": { id: "18", val: "=", type: "rel" as const, isGiven: true },
      "4,2": { id: "19", val: "4", type: "val" as const, isGiven: true },
      "4,3": { id: "20", val: OP_MINUS, type: "op" as const, isGiven: true },
      "4,4": { id: "21", val: "2", type: "val" as const, isGiven: true },
      "5,2": { id: "22", val: "=", type: "rel" as const, isGiven: true },
      "6,2": { id: "23", val: "0", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 1++2=3", () => {
    const board = {
      "0,2": { id: "1", val: "0", type: "val" as const, isGiven: true },
      "1,1": { id: "2", val: "1", type: "val" as const, isGiven: true },
      "1,2": { id: "3", val: "+", type: "op" as const, isGiven: true },
      "1,3": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "1,4": { id: "5", val: "=", type: "rel" as const, isGiven: true },
      "1,5": { id: "6", val: "2", type: "val" as const, isGiven: true },
      "2,0": { id: "7", val: "0", type: "val" as const, isGiven: true },
      "2,1": { id: "8", val: "+", type: "op" as const, isGiven: true },
      "2,2": { id: "9", val: "1", type: "val" as const, isGiven: true },
      "2,3": { id: "10", val: "=", type: "rel" as const, isGiven: true },
      "2,4": { id: "11", val: "1", type: "val" as const, isGiven: true },
      "3,0": { id: "12", val: "0", type: "val" as const, isGiven: true },
      "3,1": { id: "13", val: "+", type: "op" as const, isGiven: true },
      "3,2": { id: "14", val: "2", type: "val" as const, isGiven: true },
      "3,3": { id: "15", val: "=", type: "rel" as const, isGiven: true },
      "3,4": { id: "16", val: "2", type: "val" as const, isGiven: true },
      "4,1": { id: "17", val: "2", type: "val" as const, isGiven: true },
      "4,2": { id: "18", val: OP_MINUS, type: "op" as const, isGiven: true },
      "4,3": { id: "19", val: "1", type: "val" as const, isGiven: true },
      "4,4": { id: "20", val: "=", type: "rel" as const, isGiven: true },
      "4,5": { id: "21", val: "1", type: "val" as const, isGiven: true },
      "5,0": { id: "22", val: "1", type: "val" as const, isGiven: true },
      "5,1": { id: "23", val: "=", type: "rel" as const, isGiven: true },
      "5,2": { id: "24", val: "3", type: "val" as const, isGiven: true },
      "5,3": { id: "25", val: OP_MINUS, type: "op" as const, isGiven: true },
      "5,4": { id: "26", val: "2", type: "val" as const, isGiven: true },
      "6,1": { id: "27", val: "3", type: "val" as const, isGiven: true },
      "6,2": { id: "28", val: "=", type: "rel" as const, isGiven: true },
      "6,3": { id: "29", val: "1", type: "val" as const, isGiven: true },
      "6,4": { id: "30", val: "+", type: "op" as const, isGiven: true },
      "6,5": { id: "31", val: "2", type: "val" as const, isGiven: true },
      "7,2": { id: "32", val: "9", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 2+3", () => {
    const board = {
      "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: "+", type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "0,3": { id: "4", val: "=", type: "rel" as const, isGiven: true },
      "0,4": { id: "5", val: "3", type: "val" as const, isGiven: true },
      "1,1": { id: "6", val: "1", type: "val" as const, isGiven: true },
      "1,2": { id: "7", val: "+", type: "op" as const, isGiven: true },
      "1,3": { id: "8", val: "1", type: "val" as const, isGiven: true },
      "1,4": { id: "9", val: "=", type: "rel" as const, isGiven: true },
      "1,5": { id: "10", val: "2", type: "val" as const, isGiven: true },
      "2,2": { id: "11", val: "3", type: "val" as const, isGiven: true },
      "2,3": { id: "12", val: OP_MINUS, type: "op" as const, isGiven: true },
      "2,4": { id: "13", val: "4", type: "val" as const, isGiven: true },
      "2,5": { id: "14", val: "=", type: "rel" as const, isGiven: true },
      "2,6": { id: "15", val: OP_MINUS, type: "op" as const, isGiven: true },
      "2,7": { id: "16", val: "1", type: "val" as const, isGiven: true },
      "3,4": { id: "17", val: OP_MINUS, type: "op" as const, isGiven: true },
      "4,4": { id: "18", val: "1", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 12", () => {
    const board = {
      "0,4": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,5": { id: "2", val: "+", type: "op" as const, isGiven: true },
      "0,6": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "0,7": { id: "4", val: "=", type: "rel" as const, isGiven: true },
      "0,8": { id: "5", val: "3", type: "val" as const, isGiven: true },
      "1,0": { id: "6", val: "1", type: "val" as const, isGiven: true },
      "1,1": { id: "7", val: "+", type: "op" as const, isGiven: true },
      "1,2": { id: "8", val: "3", type: "val" as const, isGiven: true },
      "1,3": { id: "9", val: "=", type: "rel" as const, isGiven: true },
      "1,4": { id: "10", val: "2", type: "val" as const, isGiven: true },
      "1,8": { id: "11", val: "+", type: "op" as const, isGiven: true },
      "2,2": { id: "12", val: "+", type: "op" as const, isGiven: true },
      "2,8": { id: "13", val: "9", type: "val" as const, isGiven: true },
      "3,2": { id: "14", val: "9", type: "val" as const, isGiven: true },
      "3,8": { id: "15", val: "=", type: "rel" as const, isGiven: true },
      "4,2": { id: "16", val: "=", type: "rel" as const, isGiven: true },
      "4,8": { id: "17", val: "1", type: "val" as const, isGiven: true },
      "5,2": { id: "18", val: "1", type: "val" as const, isGiven: true },
      "5,3": { id: "19", val: "1", type: "val" as const, isGiven: true },
      "5,4": { id: "20", val: "+", type: "op" as const, isGiven: true },
      "5,5": { id: "21", val: "1", type: "val" as const, isGiven: true },
      "5,6": { id: "22", val: "=", type: "rel" as const, isGiven: true },
      "5,7": { id: "23", val: "1", type: "val" as const, isGiven: true },
      "5,8": { id: "24", val: "2", type: "val" as const, isGiven: true },
      "6,2": { id: "25", val: "2", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject the malformed residual crossing board", () => {
    const board = {
      "0,4": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "1,4": { id: "2", val: "0", type: "val" as const, isGiven: true },
      "2,4": { id: "3", val: OP_PLUS, type: "op" as const, isGiven: true },
      "3,4": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "4,4": { id: "5", val: "0", type: "val" as const, isGiven: true },
      "5,1": { id: "6", val: "1", type: "val" as const, isGiven: true },
      "5,2": { id: "7", val: OP_PLUS, type: "op" as const, isGiven: true },
      "5,3": { id: "8", val: "2", type: "val" as const, isGiven: true },
      "5,4": { id: "9", val: REL_EQ, type: "rel" as const, isGiven: true },
      "5,5": { id: "10", val: "3", type: "val" as const, isGiven: true },
      "6,0": { id: "11", val: "1", type: "val" as const, isGiven: true },
      "6,1": { id: "12", val: OP_PLUS, type: "op" as const, isGiven: true },
      "6,2": { id: "13", val: "2", type: "val" as const, isGiven: true },
      "6,3": { id: "14", val: REL_EQ, type: "rel" as const, isGiven: true },
      "6,4": { id: "15", val: "3", type: "val" as const, isGiven: true },
      "7,0": { id: "16", val: "0", type: "val" as const, isGiven: true },
      "7,1": { id: "17", val: REL_EQ, type: "rel" as const, isGiven: true },
      "7,2": { id: "18", val: "0", type: "val" as const, isGiven: true },
      "7,3": { id: "19", val: OP_MINUS, type: "op" as const, isGiven: true },
      "7,4": { id: "20", val: "0", type: "val" as const, isGiven: true },
      "8,1": { id: "21", val: "2", type: "val" as const, isGiven: true },
      "8,2": { id: "22", val: OP_PLUS, type: "op" as const, isGiven: true },
      "8,3": { id: "23", val: "2", type: "val" as const, isGiven: true },
      "8,4": { id: "24", val: REL_EQ, type: "rel" as const, isGiven: true },
      "8,5": { id: "25", val: "4", type: "val" as const, isGiven: true },
      "9,4": { id: "26", val: "1", type: "val" as const, isGiven: true },
      "10,4": { id: "27", val: "5", type: "val" as const, isGiven: true },
      "11,4": { id: "28", val: OP_PLUS, type: "op" as const, isGiven: true },
      "12,4": { id: "29", val: "1", type: "val" as const, isGiven: true },
      "13,4": { id: "30", val: "5", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residuals 30 and 4-", () => {
    const board = {
      "0,4": { id: "1", val: "9", type: "val" as const, isGiven: true },
      "1,3": { id: "2", val: "4", type: "val" as const, isGiven: true },
      "1,4": { id: "3", val: OP_MINUS, type: "op" as const, isGiven: true },
      "2,1": { id: "4", val: "3", type: "val" as const, isGiven: true },
      "2,2": { id: "5", val: "5", type: "val" as const, isGiven: true },
      "2,3": { id: "6", val: "÷", type: "op" as const, isGiven: true },
      "2,4": { id: "7", val: "7", type: "val" as const, isGiven: true },
      "2,5": { id: "8", val: ">", type: "rel" as const, isGiven: true },
      "2,6": { id: "9", val: "3", type: "val" as const, isGiven: true },
      "3,0": { id: "10", val: "1", type: "val" as const, isGiven: true },
      "3,1": { id: "11", val: "0", type: "val" as const, isGiven: true },
      "3,2": { id: "12", val: OP_MINUS, type: "op" as const, isGiven: true },
      "3,3": { id: "13", val: "4", type: "val" as const, isGiven: true },
      "3,4": { id: "14", val: "=", type: "rel" as const, isGiven: true },
      "3,5": { id: "15", val: "6", type: "val" as const, isGiven: true },
      "4,2": { id: "16", val: "1", type: "val" as const, isGiven: true },
      "4,3": { id: "17", val: "=", type: "rel" as const, isGiven: true },
      "4,4": { id: "18", val: "2", type: "val" as const, isGiven: true },
      "4,5": { id: "19", val: "÷", type: "op" as const, isGiven: true },
      "4,6": { id: "20", val: "2", type: "val" as const, isGiven: true },
      "5,2": { id: "21", val: "=", type: "rel" as const, isGiven: true },
      "5,3": { id: "22", val: "1", type: "val" as const, isGiven: true },
      "6,2": { id: "23", val: "4", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should invalidate an incorrect board", () => {
    const board = createTestBoard({ "0,4": "6" });
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should invalidate a single true formula board", () => {
    const board = {
      "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: "0", type: "val" as const, isGiven: true },
      "0,2": { id: "3", val: OP_MINUS, type: "op" as const, isGiven: true },
      "0,3": { id: "4", val: "4", type: "val" as const, isGiven: true },
      "0,4": { id: "5", val: "=", type: "rel" as const, isGiven: true },
      "0,5": { id: "6", val: "6", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("crossing formulas");
    }
  });

  it("should invalidate an all-given board with a single false statement", () => {
    const board = {
      "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "1", type: "val" as const, isGiven: true },
      "0,3": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,4": { id: "5", val: "3", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should invalidate an all-given board with a single invalid formula", () => {
    const board = {
      "0,0": { id: "1", val: "5", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "5", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should invalidate an empty board", () => {
    expect(validateBoard({}).valid).toBe(false);
  });

  it("should invalidate a board with no valid equations", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toMatch(/cross|operator|formula/);
    }
  });

  it("should invalidate a board where some tiles are not part of any equation", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "0,3": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,4": { id: "5", val: "4", type: "val" as const, isGiven: true },
      "1,0": { id: "6", val: "9", type: "val" as const, isGiven: true }, // Extra tile
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toMatch(/cross|operator|formula/);
    }
  });

  it("should invalidate a single tile board", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("formula");
    }
  });

  it("should invalidate a board with a relation but no operators", () => {
    const board = {
      "0,0": { id: "1", val: "5", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "5", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should invalidate a board with a greater-than formula that is false", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_GT, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should ignore formulas that start with a relation token", () => {
    const board = {
      "0,0": { id: "1", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,1": { id: "2", val: "1", type: "val" as const, isGiven: true },
      "0,2": { id: "3", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,3": { id: "4", val: "1", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should report an isolated invalid formula when a valid one also exists", () => {
    const board = {
      ...createCrossingNetworkBoard(),
      "20,0": { id: "99", val: "2", type: "val" as const, isGiven: true },
      "20,1": { id: "100", val: OP_PLUS, type: "op" as const, isGiven: true },
      "20,2": { id: "101", val: "3", type: "val" as const, isGiven: true },
      "20,3": { id: "102", val: REL_GT, type: "rel" as const, isGiven: true },
      "20,4": { id: "103", val: "10", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('Invalid formula: "2+3>10"');
    }
  });
});
