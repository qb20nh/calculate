import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateGame, validateBoard } from "@/services/board";
import { OP_PLUS, REL_EQ } from "@/services/math";
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
      { numRuns: 200 },
    );
  });

  it("should generate deterministic games for the same stage and difficulty", () => {
    expect(generateGame(7, "Hard")).toEqual(generateGame(7, "Hard"));
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

  it("should validate a correct board", () => {
    const board = createTestBoard();
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

  it("should invalidate an incorrect board", () => {
    const board = createTestBoard({ "0,4": "6" });
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason.toLowerCase()).toContain("formula");
    }
  });

  it("should invalidate a disconnected board", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "5,5": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "5,6": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
      "5,7": { id: "6", val: "1", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("connected together");
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
});
