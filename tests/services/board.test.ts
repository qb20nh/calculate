import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  generateCrossingGame,
  generateCustomGame,
  generateCustomGameAttempt,
  generateGame,
  generateStandardGame,
  getBoardGeometry,
  getGridBounds,
  validateBoard,
} from "@/services/board";
import { forEachEquation } from "@/services/board/grid";
import { getCrossingLevelSolution } from "@/services/board/handcraftedLevels";
import {
  isValidEquation,
  OP_DIV,
  OP_MINUS,
  OP_MULT,
  OP_PLUS,
  REL_EQ,
  REL_GT,
  REL_LT,
} from "@/services/math";
import type { Difficulty, GameState } from "@/services/storage";

describe("board service", () => {
  const difficultyRanges: Record<Difficulty, [number, number]> = {
    Easy: [5, 7],
    Medium: [10, 14],
    Hard: [15, 21],
  };
  const crossingGivenCountTargets = [9, 9, 9, 9, 9, 9, 9, 9, 9];
  const expectInvalidCode = (result: ReturnType<typeof validateBoard>, code: string | string[]) => {
    expect(result.valid).toBe(false);
    if (!result.valid) expect(Array.isArray(code) ? code : [code]).toContain(result.reason.code);
  };

  const getBoardLike = (solution: Record<string, string>) => {
    const board: Record<string, { val: string }> = {};
    for (const [key, val] of Object.entries(solution)) board[key] = { val };
    return board;
  };

  it("should compute shared board geometry for layout and pan callers", () => {
    const geometry = getBoardGeometry({
      "0,0": { val: "1" },
      "0,1": { val: OP_PLUS },
    });

    expect(geometry.occupiedBounds).toEqual({ minR: 0, maxR: 0, minC: 0, maxC: 1 });
    expect(geometry.layoutBounds).toEqual({ minR: -2, maxR: 2, minC: -2, maxC: 3 });
    expect(geometry.rows).toBe(5);
    expect(geometry.cols).toBe(6);
    expect(geometry.fringe).toEqual(new Set(["1,0", "-1,0", "0,-1", "1,1", "-1,1", "0,2"]));
    expect(getBoardGeometry({}).occupiedBounds).toBe(null);
  });

  const countValidFormulaRuns = (solution: Record<string, string>) => {
    let formulas = 0;
    forEachEquation(
      Object.keys(solution),
      (key) => {
        const val = solution[key];
        return val === undefined ? undefined : { val };
      },
      (word) => {
        if (isValidEquation(word)) formulas++;
      },
    );
    return formulas;
  };

  const collectNumberRuns = (tiles: Record<string, string>) => {
    const bounds = getGridBounds(Object.keys(tiles));
    const runs: string[] = [];

    const scan = (
      outerStart: number,
      outerEnd: number,
      innerStart: number,
      innerEnd: number,
      horizontal: boolean,
    ) => {
      for (let outer = outerStart; outer <= outerEnd; outer++) {
        let digits = "";
        for (let inner = innerStart; inner <= innerEnd + 1; inner++) {
          const key = horizontal ? `${outer},${inner}` : `${inner},${outer}`;
          const val = tiles[key];
          if (val !== undefined && /^\d$/.test(val)) {
            digits += val;
            continue;
          }

          if (digits.length > 0) runs.push(digits);
          digits = "";
        }
      }
    };

    scan(bounds.minR, bounds.maxR, bounds.minC, bounds.maxC, true);
    scan(bounds.minC, bounds.maxC, bounds.minR, bounds.maxR, false);

    return runs;
  };

  type ParsedFormula = {
    keys: string[];
    left: number;
    op: string;
    right: number;
    result: number;
    leftRange: [number, number];
    rightRange: [number, number];
    resultRange: [number, number];
  };

  const isOperator = (token: string) =>
    token === OP_PLUS || token === OP_MINUS || token === OP_MULT || token === OP_DIV;

  const readNumber = (tokens: string[]) => (tokens.length > 0 ? Number(tokens.join("")) : null);

  const parseFormulaRun = (word: { val: string; key: string }[]): ParsedFormula | null => {
    const tokens = word.map((item) => item.val);
    const relationIndex = tokens.indexOf(REL_EQ);
    const opIndex = tokens.findIndex(
      (token, index) => index !== relationIndex && isOperator(token),
    );
    if (relationIndex <= 0 || relationIndex === tokens.length - 1 || opIndex < 0) return null;

    const op = tokens[opIndex];
    if (op === undefined) return null;
    if (opIndex < relationIndex) {
      const left = readNumber(tokens.slice(0, opIndex));
      const right = readNumber(tokens.slice(opIndex + 1, relationIndex));
      const result = readNumber(tokens.slice(relationIndex + 1));
      if (left === null || right === null || result === null) return null;
      return {
        keys: word.map((item) => item.key),
        left,
        op,
        right,
        result,
        leftRange: [0, opIndex],
        rightRange: [opIndex + 1, relationIndex],
        resultRange: [relationIndex + 1, tokens.length],
      };
    }

    const result = readNumber(tokens.slice(0, relationIndex));
    const left = readNumber(tokens.slice(relationIndex + 1, opIndex));
    const right = readNumber(tokens.slice(opIndex + 1));
    if (left === null || right === null || result === null) return null;
    return {
      keys: word.map((item) => item.key),
      left,
      op,
      right,
      result,
      resultRange: [0, relationIndex],
      leftRange: [relationIndex + 1, opIndex],
      rightRange: [opIndex + 1, tokens.length],
    };
  };

  const collectParsedFormulaRuns = (solution: Record<string, string>) => {
    const formulas: ParsedFormula[] = [];
    forEachEquation(
      Object.keys(solution),
      (key) => {
        const val = solution[key];
        return val === undefined ? undefined : { val };
      },
      (word) => {
        if (!isValidEquation(word)) return;
        const formula = parseFormulaRun(word);
        if (formula) formulas.push(formula);
      },
    );
    return formulas;
  };

  const hasSingleDigitNumber = ({ left, right, result }: ParsedFormula) =>
    left < 10 || right < 10 || result < 10;

  const isTrivialFormula = ({ left, op, right, result }: ParsedFormula) => {
    if (op === OP_PLUS) return left === 0 || right === 0;
    if (op === OP_MINUS) return right === 0 || left === right;
    if (op === OP_MULT) return left === 0 || right === 0 || left === 1 || right === 1;
    if (op === OP_DIV) return right === 1 || left === right || result === 0;
    return false;
  };

  const mathKeyFor = ({ left, op, right, result }: ParsedFormula) => {
    if (op === OP_PLUS || op === OP_MINUS) {
      const addends = op === OP_PLUS ? [left, right] : [right, result];
      addends.sort((a, b) => a - b);
      return `add:${addends[0]}:${addends[1]}:${op === OP_PLUS ? result : left}`;
    }

    const factors = op === OP_MULT ? [left, right] : [right, result];
    factors.sort((a, b) => a - b);
    return `mult:${factors[0]}:${factors[1]}:${op === OP_MULT ? result : left}`;
  };

  const isDirectComputeVisible = (formula: ParsedFormula, board: GameState["board"]) => {
    const ranges = [formula.leftRange, formula.rightRange, formula.resultRange];
    const missingRanges = ranges.filter(([start, end]) =>
      formula.keys.slice(start, end).every((key) => !board[key]),
    );
    if (missingRanges.length !== 1) return false;

    const missingRange = missingRanges[0];
    if (!missingRange) return false;
    return formula.keys.every((key, index) => {
      if (index >= missingRange[0] && index < missingRange[1]) return !board[key];
      return Boolean(board[key]);
    });
  };

  const countCrossingTiles = (solution: Record<string, string>) => {
    const horizontalKeys = new Set<string>();
    const verticalKeys = new Set<string>();
    const bounds = getGridBounds(Object.keys(solution));

    const scan = (
      outerStart: number,
      outerEnd: number,
      innerStart: number,
      innerEnd: number,
      horizontal: boolean,
    ) => {
      for (let outer = outerStart; outer <= outerEnd; outer++) {
        let run: { key: string; val: string }[] = [];
        for (let inner = innerStart; inner <= innerEnd + 1; inner++) {
          const key = horizontal ? `${outer},${inner}` : `${inner},${outer}`;
          const val = solution[key];
          if (val !== undefined) {
            run.push({ key, val });
            continue;
          }

          if (run.length > 0 && isValidEquation(run)) {
            for (const item of run) {
              (horizontal ? horizontalKeys : verticalKeys).add(item.key);
            }
          }
          run = [];
        }
      }
    };

    scan(bounds.minR, bounds.maxR, bounds.minC, bounds.maxC, true);
    scan(bounds.minC, bounds.maxC, bounds.minR, bounds.maxR, false);

    let crossings = 0;
    for (const key of horizontalKeys) {
      if (verticalKeys.has(key)) crossings++;
    }
    return crossings;
  };

  it("should generate a playable game for all difficulties", () => {
    const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];
    for (const diff of difficulties) {
      for (let stage = 1; stage <= 5; stage++) {
        let game = generateGame(stage, diff, 0);
        for (let i = 0; i < 100; i++) {
          game = generateGame(stage, diff, i);
          if (Object.keys(game.board).length > 0) break;
        }
        expect(game?.status).toBe("playing");
        expect(Object.keys(game?.board || {}).length).toBeGreaterThan(0);
        expect(game?.bank.length).toBeGreaterThan(0);
      }
    }
  });

  it("should preserve generation constraints across stages", () => {
    const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];
    for (const diff of difficulties) {
      const [minInventory, maxInventory] = difficultyRanges[diff];
      for (let stage = 1; stage <= 10; stage++) {
        let game = generateGame(stage, diff, 0);
        for (let i = 0; i < 100; i++) {
          game = generateGame(stage, diff, i);
          if (Object.keys(game.board).length > 0) break;
        }

        expect(game?.bank.length).toBeGreaterThanOrEqual(minInventory);
        expect(game?.bank.length).toBeLessThanOrEqual(maxInventory);
        expect(validateBoard(game?.board || {}).valid).toBe(false);
      }
    }
  });

  it("should keep generation constraints under property runs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.constantFrom<Difficulty>("Easy", "Medium", "Hard"),
        (stage, diff) => {
          let game = generateGame(stage, diff, 0);
          for (let i = 0; i < 100; i++) {
            game = generateGame(stage, diff, i);
            if (Object.keys(game.board).length > 0) break;
          }
          const [minInventory, maxInventory] = difficultyRanges[diff];

          expect(game?.status).toBe("playing");
          expect(Object.keys(game?.board || {}).length).toBeGreaterThan(0);
          expect(game?.bank.length).toBeGreaterThan(0);
          expect(game?.bank.length).toBeGreaterThanOrEqual(minInventory);
          expect(game?.bank.length).toBeLessThanOrEqual(maxInventory);
          expect(generateGame(stage, diff)).toEqual(generateGame(stage, diff, 0));
        },
      ),
      { numRuns: 20 },
    );
  });

  it("should generate deterministic games for the same stage and difficulty", () => {
    expect(generateGame(7, "Hard", 5)).toEqual(generateGame(7, "Hard", 5));
  });

  it("should generate a standard game state with difficulty and stage metadata", () => {
    const game = generateStandardGame(3, "Easy", 100);

    expect(game.difficulty).toBe("Easy");
    expect(game.stage).toBe(3);
    expect(game.solvedAcknowledged).toBe(false);
    expect(Object.keys(game.board).length).toBeGreaterThan(0);
  });

  it("should generate crossing games with a fixed inventory", () => {
    const visibleEdgeSignatures = new Set<string>();
    const givenCounts: number[] = [];
    let hasVisibleNegativeRow = false;
    let hasVisibleNegativeCol = false;

    for (let stage = 1; stage <= 9; stage++) {
      const game = generateCrossingGame(stage);
      expect(game).not.toBeNull();
      if (!game) continue;

      expect(game.status).toBe("playing");
      givenCounts.push(Object.keys(game.board).length);
      expect(game.initialBankSize).toBe(18);
      expect(game.bank.map((tile) => tile.val)).toEqual([
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        OP_PLUS,
        OP_MINUS,
        OP_MULT,
        OP_DIV,
        REL_EQ,
        REL_EQ,
        REL_EQ,
        REL_EQ,
      ]);
      const bounds = getGridBounds(Object.keys(game.board));
      expect(bounds.minR < 0 || bounds.minC < 0).toBe(true);
      hasVisibleNegativeRow ||= bounds.minR < 0;
      hasVisibleNegativeCol ||= bounds.minC < 0;
      visibleEdgeSignatures.add(`${bounds.minR},${bounds.minC},${bounds.maxR},${bounds.maxC}`);
      expect(validateBoard(game.board).valid).toBe(false);
      expect(
        collectNumberRuns(
          Object.fromEntries(Object.entries(game.board).map(([key, tile]) => [key, tile.val])),
        ).every((value) => value.length <= 2),
      ).toBe(true);

      const solution = getCrossingLevelSolution(stage);
      expect(solution).not.toBeNull();
      if (!solution) continue;

      expect(Object.keys(solution)).toHaveLength(Object.keys(game.board).length + 18);
      for (const formula of collectParsedFormulaRuns(solution)) {
        const missing = formula.keys.filter((key) => !game.board[key]).length;
        expect(missing).not.toBe(1);
        expect(isDirectComputeVisible(formula, game.board)).toBe(false);
      }
    }

    expect(hasVisibleNegativeRow).toBe(true);
    expect(hasVisibleNegativeCol).toBe(true);
    expect(visibleEdgeSignatures.size).toBeGreaterThan(1);
    expect([...givenCounts].sort((left, right) => left - right)).toEqual(crossingGivenCountTargets);
    expect(generateCrossingGame(10)).toBeNull();
    expect(getCrossingLevelSolution(10)).toBeNull();
  });

  it("should generate crossing solutions with non-flush bounds", () => {
    const solutionTileCounts: number[] = [];
    let hasNegativeRow = false;
    let hasNegativeCol = false;

    for (let stage = 1; stage <= 9; stage++) {
      const solution = getCrossingLevelSolution(stage);
      expect(solution).not.toBeNull();
      if (!solution) continue;

      expect(validateBoard(getBoardLike(solution)).valid).toBe(true);
      expect(Object.keys(solution).length).toBeLessThanOrEqual(30);
      solutionTileCounts.push(Object.keys(solution).length);
      expect(collectNumberRuns(solution).every((value) => value.length <= 2)).toBe(true);
      expect(countValidFormulaRuns(solution)).toBe(6);
      expect(countCrossingTiles(solution)).toBe(9);
      const formulas = collectParsedFormulaRuns(solution);
      expect(formulas).toHaveLength(6);
      expect(new Set(formulas.map(mathKeyFor)).size).toBe(6);
      for (const formula of formulas) {
        expect(formula.left).toBeLessThanOrEqual(99);
        expect(formula.right).toBeLessThanOrEqual(99);
        expect(formula.result).toBeLessThanOrEqual(99);
        expect(hasSingleDigitNumber(formula)).toBe(true);
        expect(isTrivialFormula(formula)).toBe(false);
      }

      const bounds = getGridBounds(Object.keys(solution));
      expect(bounds.minR < 0 || bounds.minC < 0).toBe(true);
      hasNegativeRow ||= bounds.minR < 0;
      hasNegativeCol ||= bounds.minC < 0;
    }

    expect(hasNegativeRow).toBe(true);
    expect(hasNegativeCol).toBe(true);
    expect([...solutionTileCounts].sort((left, right) => left - right)).toEqual(
      crossingGivenCountTargets.map((count) => count + 18),
    );
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

    let game: GameState | null = null;
    for (let i = 0; i < 100; i++) {
      game = generateCustomGame(config, i);
      if (game) break;
    }

    expect(game).not.toBeNull();
    if (!game) return;

    expect(game.status).toBe("playing");
    expect(game.difficulty).toBe("Custom");
    expect(game.stage).toBe(1);
    expect(game.customConfig).toMatchObject(config);
    expect(game.customConfig?.attempt).toBeDefined();
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

    // Try a few attempts to find one that works with the new math range
    let game: GameState | null = null;
    for (let i = 0; i < 50; i++) {
      game = generateCustomGameAttempt(config, i);
      if (game) break;
    }
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
    "0,4": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
    "0,5": { id: "6", val: "6", type: "val" as const, isGiven: true },
    "1,3": { id: "7", val: OP_PLUS, type: "op" as const, isGiven: true },
    "2,3": { id: "8", val: "1", type: "val" as const, isGiven: true },
    "3,3": { id: "9", val: REL_EQ, type: "rel" as const, isGiven: true },
    "4,3": { id: "10", val: "5", type: "val" as const, isGiven: true },
  });

  const _createFalseResidualBoard = () => ({
    "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
    "0,1": { id: "2", val: "0", type: "val" as const, isGiven: true },
    "0,2": { id: "3", val: OP_MINUS, type: "op" as const, isGiven: true },
    "0,3": { id: "4", val: "4", type: "val" as const, isGiven: true },
    "0,4": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
    "0,5": { id: "6", val: "6", type: "val" as const, isGiven: true },
    "1,1": { id: "7", val: OP_PLUS, type: "op" as const, isGiven: true },
    "2,1": { id: "8", val: "2", type: "val" as const, isGiven: true },
    "3,1": { id: "9", val: REL_EQ, type: "rel" as const, isGiven: true },
    "4,1": { id: "10", val: "5", type: "val" as const, isGiven: true },
    "1,3": { id: "11", val: OP_PLUS, type: "op" as const, isGiven: true },
    "2,3": { id: "12", val: "1", type: "val" as const, isGiven: true },
    "3,3": { id: "13", val: REL_EQ, type: "rel" as const, isGiven: true },
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

  it("should not reject residual 1-3=", () => {
    const board = {
      "0,2": { id: "1", val: "3", type: "val" as const, isGiven: true },
      "1,1": { id: "2", val: "1", type: "val" as const, isGiven: true },
      "1,2": { id: "3", val: OP_PLUS, type: "op" as const, isGiven: true },
      "1,3": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "1,4": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
      "1,5": { id: "6", val: "2", type: "val" as const, isGiven: true },
      "2,0": { id: "7", val: "1", type: "val" as const, isGiven: true },
      "2,1": { id: "8", val: OP_MINUS, type: "op" as const, isGiven: true },
      "2,2": { id: "9", val: "1", type: "val" as const, isGiven: true },
      "2,3": { id: "10", val: REL_EQ, type: "rel" as const, isGiven: true },
      "2,4": { id: "11", val: "0", type: "val" as const, isGiven: true },
      "3,1": { id: "12", val: "3", type: "val" as const, isGiven: true },
      "3,2": { id: "13", val: OP_MINUS, type: "op" as const, isGiven: true },
      "3,3": { id: "14", val: "2", type: "val" as const, isGiven: true },
      "3,4": { id: "15", val: REL_EQ, type: "rel" as const, isGiven: true },
      "3,5": { id: "16", val: "1", type: "val" as const, isGiven: true },
      "4,0": { id: "17", val: "2", type: "val" as const, isGiven: true },
      "4,1": { id: "18", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,2": { id: "19", val: "4", type: "val" as const, isGiven: true },
      "4,3": { id: "20", val: OP_MINUS, type: "op" as const, isGiven: true },
      "4,4": { id: "21", val: "2", type: "val" as const, isGiven: true },
      "5,2": { id: "22", val: REL_EQ, type: "rel" as const, isGiven: true },
      "6,2": { id: "23", val: "0", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 1++2=3", () => {
    const board = {
      "0,2": { id: "1", val: "0", type: "val" as const, isGiven: true },
      "1,1": { id: "2", val: "1", type: "val" as const, isGiven: true },
      "1,2": { id: "3", val: OP_PLUS, type: "op" as const, isGiven: true },
      "1,3": { id: "4", val: "1", type: "val" as const, isGiven: true },
      "1,4": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
      "1,5": { id: "6", val: "2", type: "val" as const, isGiven: true },
      "2,0": { id: "7", val: "0", type: "val" as const, isGiven: true },
      "2,1": { id: "8", val: OP_PLUS, type: "op" as const, isGiven: true },
      "2,2": { id: "9", val: "1", type: "val" as const, isGiven: true },
      "2,3": { id: "10", val: REL_EQ, type: "rel" as const, isGiven: true },
      "2,4": { id: "11", val: "1", type: "val" as const, isGiven: true },
      "3,0": { id: "12", val: "0", type: "val" as const, isGiven: true },
      "3,1": { id: "13", val: OP_PLUS, type: "op" as const, isGiven: true },
      "3,2": { id: "14", val: "2", type: "val" as const, isGiven: true },
      "3,3": { id: "15", val: REL_EQ, type: "rel" as const, isGiven: true },
      "3,4": { id: "16", val: "2", type: "val" as const, isGiven: true },
      "4,1": { id: "17", val: "2", type: "val" as const, isGiven: true },
      "4,2": { id: "18", val: OP_MINUS, type: "op" as const, isGiven: true },
      "4,3": { id: "19", val: "1", type: "val" as const, isGiven: true },
      "4,4": { id: "20", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,5": { id: "21", val: "1", type: "val" as const, isGiven: true },
      "5,0": { id: "22", val: "1", type: "val" as const, isGiven: true },
      "5,1": { id: "23", val: REL_EQ, type: "rel" as const, isGiven: true },
      "5,2": { id: "24", val: "3", type: "val" as const, isGiven: true },
      "5,3": { id: "25", val: OP_MINUS, type: "op" as const, isGiven: true },
      "5,4": { id: "26", val: "2", type: "val" as const, isGiven: true },
      "6,1": { id: "27", val: "3", type: "val" as const, isGiven: true },
      "6,2": { id: "28", val: REL_EQ, type: "rel" as const, isGiven: true },
      "6,3": { id: "29", val: "1", type: "val" as const, isGiven: true },
      "6,4": { id: "30", val: OP_PLUS, type: "op" as const, isGiven: true },
      "6,5": { id: "31", val: "2", type: "val" as const, isGiven: true },
      "7,2": { id: "32", val: "9", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should not reject residual 2+3", () => {
    const board = {
      "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "0,3": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,4": { id: "5", val: "3", type: "val" as const, isGiven: true },
      "1,1": { id: "6", val: "1", type: "val" as const, isGiven: true },
      "1,2": { id: "7", val: OP_PLUS, type: "op" as const, isGiven: true },
      "1,3": { id: "8", val: "1", type: "val" as const, isGiven: true },
      "1,4": { id: "9", val: REL_EQ, type: "rel" as const, isGiven: true },
      "1,5": { id: "10", val: "2", type: "val" as const, isGiven: true },
      "2,2": { id: "11", val: "3", type: "val" as const, isGiven: true },
      "2,3": { id: "12", val: OP_MINUS, type: "op" as const, isGiven: true },
      "2,4": { id: "13", val: "4", type: "val" as const, isGiven: true },
      "2,5": { id: "14", val: REL_EQ, type: "rel" as const, isGiven: true },
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
      "0,5": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,6": { id: "3", val: "2", type: "val" as const, isGiven: true },
      "0,7": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,8": { id: "5", val: "3", type: "val" as const, isGiven: true },
      "1,0": { id: "6", val: "1", type: "val" as const, isGiven: true },
      "1,1": { id: "7", val: OP_PLUS, type: "op" as const, isGiven: true },
      "1,2": { id: "8", val: "3", type: "val" as const, isGiven: true },
      "1,3": { id: "9", val: REL_EQ, type: "rel" as const, isGiven: true },
      "1,4": { id: "10", val: "2", type: "val" as const, isGiven: true },
      "1,8": { id: "11", val: OP_PLUS, type: "op" as const, isGiven: true },
      "2,2": { id: "12", val: OP_PLUS, type: "op" as const, isGiven: true },
      "2,8": { id: "13", val: "9", type: "val" as const, isGiven: true },
      "3,2": { id: "14", val: "9", type: "val" as const, isGiven: true },
      "3,8": { id: "15", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,2": { id: "16", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,8": { id: "17", val: "1", type: "val" as const, isGiven: true },
      "5,2": { id: "18", val: "1", type: "val" as const, isGiven: true },
      "5,3": { id: "19", val: "1", type: "val" as const, isGiven: true },
      "5,4": { id: "20", val: OP_PLUS, type: "op" as const, isGiven: true },
      "5,5": { id: "21", val: "1", type: "val" as const, isGiven: true },
      "5,6": { id: "22", val: REL_EQ, type: "rel" as const, isGiven: true },
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
      "2,3": { id: "6", val: OP_DIV, type: "op" as const, isGiven: true },
      "2,4": { id: "7", val: "7", type: "val" as const, isGiven: true },
      "2,5": { id: "8", val: REL_GT, type: "rel" as const, isGiven: true },
      "2,6": { id: "9", val: "3", type: "val" as const, isGiven: true },
      "3,0": { id: "10", val: "1", type: "val" as const, isGiven: true },
      "3,1": { id: "11", val: "0", type: "val" as const, isGiven: true },
      "3,2": { id: "12", val: OP_MINUS, type: "op" as const, isGiven: true },
      "3,3": { id: "13", val: "4", type: "val" as const, isGiven: true },
      "3,4": { id: "14", val: REL_EQ, type: "rel" as const, isGiven: true },
      "3,5": { id: "15", val: "6", type: "val" as const, isGiven: true },
      "4,2": { id: "16", val: "1", type: "val" as const, isGiven: true },
      "4,3": { id: "17", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,4": { id: "18", val: "2", type: "val" as const, isGiven: true },
      "4,5": { id: "19", val: OP_DIV, type: "op" as const, isGiven: true },
      "4,6": { id: "20", val: "2", type: "val" as const, isGiven: true },
      "5,2": { id: "21", val: REL_EQ, type: "rel" as const, isGiven: true },
      "5,3": { id: "22", val: "1", type: "val" as const, isGiven: true },
      "6,2": { id: "23", val: "4", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expect(result.valid).toBe(true);
  });

  it("should invalidate an incorrect board", () => {
    const board = createTestBoard({ "0,4": "6" });
    const result = validateBoard(board);
    expectInvalidCode(result, ["noFormula", "noCrossing", "invalidFormula"]);
  });

  it("should invalidate a single true formula board", () => {
    const board = {
      "0,0": { id: "1", val: "1", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: "0", type: "val" as const, isGiven: true },
      "0,2": { id: "3", val: OP_MINUS, type: "op" as const, isGiven: true },
      "0,3": { id: "4", val: "4", type: "val" as const, isGiven: true },
      "0,4": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,5": { id: "6", val: "6", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expectInvalidCode(result, "noCrossing");
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
    expectInvalidCode(result, "noFormula");
  });

  it("should invalidate an all-given board with a single invalid formula", () => {
    const board = {
      "0,0": { id: "1", val: "5", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "5", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expectInvalidCode(result, "noFormula");
  });

  it("should invalidate an empty board", () => {
    expectInvalidCode(validateBoard({}), "boardEmpty");
  });

  it("should invalidate a board with no valid equations", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expectInvalidCode(result, "noFormula");
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
    expectInvalidCode(result, "noCrossing");
  });

  it("should invalidate a single tile board", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expectInvalidCode(result, "noFormula");
  });

  it("should invalidate a board with a relation but no operators", () => {
    const board = {
      "0,0": { id: "1", val: "5", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "5", type: "val" as const, isGiven: true },
    };
    const result = validateBoard(board);
    expectInvalidCode(result, "noFormula");
  });

  it("should invalidate a board with a greater-than formula that is false", () => {
    const board = {
      "0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_GT, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expectInvalidCode(result, "noFormula");
  });

  it("should ignore formulas that start with a relation token", () => {
    const board = {
      "0,0": { id: "1", val: REL_EQ, type: "rel" as const, isGiven: true },
      "0,1": { id: "2", val: "1", type: "val" as const, isGiven: true },
      "0,2": { id: "3", val: OP_PLUS, type: "op" as const, isGiven: true },
      "0,3": { id: "4", val: "1", type: "val" as const, isGiven: true },
    };

    const result = validateBoard(board);
    expectInvalidCode(result, "noFormula");
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
    expectInvalidCode(result, "invalidFormula");
    if (!result.valid) expect(result.reason).toEqual({ code: "invalidFormula", formula: "2+3>10" });
  });
  it("should mark a board with an invalid inequality as invalid", () => {
    const board: Record<string, { id: string; val: string; type: string; isGiven: boolean }> = {
      "0,0": { id: "1", val: "1", type: "val", isGiven: true },
      "0,1": { id: "2", val: OP_PLUS, type: "op", isGiven: true },
      "0,2": { id: "3", val: "1", type: "val", isGiven: true },
      "0,3": { id: "4", val: REL_LT, type: "rel", isGiven: true },
      "0,4": { id: "5", val: REL_GT, type: "rel", isGiven: true },
      "0,5": { id: "6", val: "2", type: "val", isGiven: true },
      "1,0": { id: "7", val: OP_PLUS, type: "op", isGiven: true },
      "2,0": { id: "8", val: "1", type: "val", isGiven: true },
      "3,0": { id: "9", val: REL_EQ, type: "rel", isGiven: true },
      "4,0": { id: "10", val: "2", type: "val", isGiven: true },
    };
    expect(validateBoard(board).valid).toBe(false);
  });

  it("should return null for invalid custom attempt", () => {
    const config = {
      givenCount: 1,
      inventoryCount: 1,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: false,
    };
    expect(generateCustomGameAttempt(config, 0)).toBeNull();
  });

  it("should invalidate an incorrect inequality board", () => {
    const boardLT = {
      "0,0": { id: "1", val: "5", type: "val" as const, isGiven: true },
      "0,1": { id: "2", val: REL_LT, type: "rel" as const, isGiven: true },
      "0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
      "1,0": { id: "4", val: OP_PLUS, type: "op" as const, isGiven: true },
      "2,0": { id: "5", val: "2", type: "val" as const, isGiven: true },
      "3,0": { id: "6", val: REL_EQ, type: "rel" as const, isGiven: true },
      "4,0": { id: "7", val: "7", type: "val" as const, isGiven: true },
    };
    expect(validateBoard(boardLT).valid).toBe(false);
  });
});
