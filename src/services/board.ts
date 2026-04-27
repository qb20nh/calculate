import { CUSTOM_GAME_RETRY_LIMIT } from "@/services/customGameGeneration";
import {
  evaluateExpression,
  generateValidStatement,
  getHashSeed,
  isValidEquation,
  OP_DIV,
  OP_MINUS,
  OP_MULT,
  OP_PLUS,
  REL_EQ,
  REL_GT,
  REL_LT,
  type TileData,
  xoshiro128pp,
} from "@/services/math";
import type { CustomGameConfig, Difficulty, GameState } from "@/services/storage";

type Cell = {
  val: string;
  type: "val" | "op" | "rel";
};

interface Grid {
  [key: string]: Cell;
}

type Bounds = {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
};

type EquationUsage = {
  horizontal: Set<string>;
  vertical: Set<string>;
};

type Direction = {
  dx: number;
  dy: number;
};

type BoardLikeCell = { val: string };
type BoardLike = Record<string, BoardLikeCell | undefined>;

const getKey = (r: number, c: number) => `${r},${c}`;

const parseKey = (key: string): [number, number] => {
  const [r = "0", c = "0"] = key.split(",");
  return [Number(r), Number(c)];
};

export const getGridBounds = (keys: string[]): Bounds => {
  let minR = Number.POSITIVE_INFINITY;
  let maxR = Number.NEGATIVE_INFINITY;
  let minC = Number.POSITIVE_INFINITY;
  let maxC = Number.NEGATIVE_INFINITY;
  for (const k of keys) {
    const [r, c] = parseKey(k);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }
  return { minR, maxR, minC, maxC };
};

const getCellType = (char: string): Cell["type"] => {
  if (char === OP_PLUS || char === OP_MINUS || char === OP_MULT || char === OP_DIV) return "op";
  if (char === REL_EQ || char === REL_LT || char === REL_GT) return "rel";
  return "val";
};

const shuffleInPlace = <T>(items: T[], prng: () => number) => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const current = items[i];
    const swap = items[j];
    if (current === undefined || swap === undefined) continue;
    items[i] = swap;
    items[j] = current;
  }
  return items;
};

const pickRandomKeys = (keys: string[], count: number, prng: () => number) =>
  new Set(shuffleInPlace([...keys], prng).slice(0, count));

const forEachEquation = (
  keys: string[],
  getTile: (k: string) => { val: string } | undefined,
  callback: (word: { val: string; key: string }[]) => boolean | undefined,
) => {
  const { minR, maxR, minC, maxC } = getGridBounds(keys);

  const scan = (
    outerStart: number,
    outerEnd: number,
    innerStart: number,
    innerEnd: number,
    isHoriz: boolean,
  ) => {
    for (let o = outerStart; o <= outerEnd; o++) {
      let word: { val: string; key: string }[] = [];
      for (let i = innerStart; i <= innerEnd + 1; i++) {
        const k = isHoriz ? getKey(o, i) : getKey(i, o);
        const tile = getTile(k);
        if (tile) {
          word.push({ ...tile, key: k });
        } else {
          if (word.length > 0) {
            if (callback(word) === false) return false;
          }
          word = [];
        }
      }
    }
    return true;
  };

  if (scan(minR, maxR, minC, maxC, true) === false) return; // Horizontal
  scan(minC, maxC, minR, maxR, false); // Vertical
};

type FormulaRun = {
  keys: string[];
};

type BoardValidation = { valid: true } | { valid: false; reason: string };

const analyzeBoard = (board: BoardLike): BoardValidation => {
  const placedKeys = Object.keys(board);
  if (placedKeys.length === 0) return { valid: false, reason: "Board is empty." };

  const trueFormulas: FormulaRun[] = [];
  const invalidFormulas: FormulaRun[] = [];
  let invalidFormula: string | null = null;
  const isRelation = (token: string) => token === REL_EQ || token === REL_LT || token === REL_GT;
  const isOperator = (token: string) =>
    token === OP_PLUS || token === OP_MINUS || token === OP_MULT || token === OP_DIV;

  const classifyFormula = (word: { val: string; key: string }[]) => {
    const tokens = word.map((w) => w.val);
    const relationIndices = tokens.flatMap((token, index) => (isRelation(token) ? [index] : []));
    const hasOperator = tokens.some((t) => isOperator(t));
    const firstRelationIndex = relationIndices[0];
    const secondRelationIndex = relationIndices[1];

    if (!hasOperator || relationIndices.length === 0) return "ignore" as const;

    const firstRelation = relationIndices[0];
    const lastRelation = relationIndices[relationIndices.length - 1];
    if (firstRelation === undefined || lastRelation === undefined) return "ignore" as const;

    const isAllEquals = relationIndices.every((index) => tokens[index] === REL_EQ);
    if (isAllEquals) {
      if (firstRelation === 0 || lastRelation === tokens.length - 1) return "ignore" as const;

      const values: number[] = [];
      let start = 0;
      for (const relationIndex of relationIndices) {
        const segment = tokens.slice(start, relationIndex).join("");
        const value = evaluateExpression(segment);
        if (value === null) return "ignore" as const;
        values.push(value);
        start = relationIndex + 1;
      }

      const finalSegment = tokens.slice(start).join("");
      const finalValue = evaluateExpression(finalSegment);
      if (finalValue === null) return "ignore" as const;
      values.push(finalValue);

      const base = values[0];
      if (base === undefined) return "ignore" as const;
      if (values.some((value) => Math.abs(value - base) >= 0.0001)) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }

      return { status: "valid" as const };
    }

    if (
      relationIndices.length === 1 ||
      (relationIndices.length === 2 &&
        firstRelationIndex !== undefined &&
        secondRelationIndex !== undefined &&
        tokens[firstRelationIndex] === REL_LT &&
        tokens[secondRelationIndex] === REL_GT &&
        secondRelationIndex === firstRelationIndex + 1)
    ) {
      if (firstRelation === 0 || lastRelation === tokens.length - 1) return "ignore" as const;

      const relationStart = firstRelation;
      const relationEnd = lastRelation;
      const leftSide = tokens.slice(0, relationStart).join("");
      const rightSide = tokens.slice(relationEnd + 1).join("");
      const leftVal = evaluateExpression(leftSide);
      const rightVal = evaluateExpression(rightSide);
      if (leftVal === null || rightVal === null) return "ignore" as const;

      if (
        relationIndices.length === 2 &&
        firstRelationIndex !== undefined &&
        secondRelationIndex !== undefined &&
        tokens[firstRelationIndex] === REL_LT &&
        tokens[secondRelationIndex] === REL_GT
      ) {
        if (Math.abs(leftVal - rightVal) < 0.0001) {
          return { status: "invalid" as const, formula: tokens.join("") };
        }
        return { status: "valid" as const };
      }

      const relation = tokens[firstRelation];
      if (relation === REL_EQ && Math.abs(leftVal - rightVal) >= 0.0001) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }
      if (relation === REL_LT && !(leftVal < rightVal)) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }
      if (relation === REL_GT && !(leftVal > rightVal)) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }

      return { status: "valid" as const };
    }

    return "ignore" as const;
  };

  forEachEquation(
    placedKeys,
    (k) => board[k],
    (word) => {
      const result = classifyFormula(word);
      if (result === "ignore") return;

      if (result.status === "invalid") {
        invalidFormula = result.formula;
        invalidFormulas.push({ keys: word.map((w) => w.key) });
        return;
      }

      const keys = word.map((w) => w.key);
      trueFormulas.push({ keys });
    },
  );

  if (trueFormulas.length === 0) {
    return { valid: false, reason: "No valid mathematical formula found." };
  }

  if (trueFormulas.length < 2) {
    return { valid: false, reason: "At least two crossing formulas are required." };
  }

  const trueTileKeys = new Set<string>();
  for (const formula of trueFormulas) {
    for (const key of formula.keys) trueTileKeys.add(key);
  }

  const hasIsolatedInvalidFormula = invalidFormulas.some((formula) =>
    formula.keys.every((key) => !trueTileKeys.has(key)),
  );
  if (hasIsolatedInvalidFormula && invalidFormula) {
    return { valid: false, reason: `Invalid formula: "${invalidFormula}"` };
  }

  return { valid: true };
};

const placeEquation = (
  grid: Grid,
  gridKeys: string[],
  usage: EquationUsage,
  bounds: Bounds,
  prng: () => number,
  maxSideLength: number,
  remainingTiles?: number,
) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const stmt = generateValidStatement(prng);

    const possibleIntersections: { k: string; idx: number }[] = [];
    for (const k of gridKeys) {
      const cell = grid[k];
      if (!cell) continue;
      const cellVal = String(cell.val);
      for (let i = 0; i < stmt.length; i++) {
        const char = stmt[i];
        if (char && char === cellVal) {
          possibleIntersections.push({ k, idx: i });
        }
      }
    }

    shuffleInPlace(possibleIntersections, prng);

    for (const match of possibleIntersections) {
      const [r, c] = parseKey(match.k);

      const dirs: Direction[] = [];
      if (!usage.horizontal.has(match.k)) dirs.push({ dx: 1, dy: 0 });
      if (!usage.vertical.has(match.k)) dirs.push({ dx: 0, dy: 1 });
      shuffleInPlace(dirs, prng);

      for (const dir of dirs) {
        const addedTiles = stmt.length - 1;
        if (remainingTiles !== undefined && addedTiles > remainingTiles) {
          continue;
        }

        const startR = r - match.idx * dir.dy;
        const startC = c - match.idx * dir.dx;

        const cells: string[] = [];
        for (let i = 0; i < stmt.length; i++) {
          const cr = startR + i * dir.dy;
          const cc = startC + i * dir.dx;
          cells.push(getKey(cr, cc));
        }

        const newEquationCells = new Set(cells);
        let collision = false;
        let nextMinR = bounds.minR;
        let nextMaxR = bounds.maxR;
        let nextMinC = bounds.minC;
        let nextMaxC = bounds.maxC;

        for (let i = 0; i < stmt.length; i++) {
          const cr = startR + i * dir.dy;
          const cc = startC + i * dir.dx;
          const ck = cells[i];
          /* istanbul ignore next */
          if (!ck) {
            collision = true;
            break;
          }

          nextMinR = Math.min(nextMinR, cr);
          nextMaxR = Math.max(nextMaxR, cr);
          nextMinC = Math.min(nextMinC, cc);
          nextMaxC = Math.max(nextMaxC, cc);

          if (i === match.idx) continue;

          if (grid[ck]) {
            collision = true;
            break;
          }

          const neighbors = [
            getKey(cr + 1, cc),
            getKey(cr - 1, cc),
            getKey(cr, cc + 1),
            getKey(cr, cc - 1),
          ];
          for (const nk of neighbors) {
            if (grid[nk] && !newEquationCells.has(nk)) {
              collision = true;
              break;
            }
          }
          if (collision) break;
        }

        if (!collision) {
          if (nextMaxR - nextMinR + 1 > maxSideLength || nextMaxC - nextMinC + 1 > maxSideLength) {
            collision = true;
          }
        }

        if (!collision) {
          for (let i = 0; i < stmt.length; i++) {
            const char = stmt[i];
            if (!char) continue;
            const cellKey = cells[i];
            if (!cellKey) continue;
            grid[cellKey] = { type: getCellType(char), val: char };
            if (i !== match.idx) gridKeys.push(cellKey);
          }

          const usageSet = dir.dx === 1 ? usage.horizontal : usage.vertical;
          for (const cell of cells) usageSet.add(cell);

          bounds.minR = nextMinR;
          bounds.maxR = nextMaxR;
          bounds.minC = nextMinC;
          bounds.maxC = nextMaxC;

          return addedTiles;
        }
      }
    }
  }
  return 0;
};

const getSeedNumber = (seed: string) => {
  const trimmed = seed.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed) >>> 0;
  }
  return getHashSeed(trimmed);
};

const finalizeGame = (
  grid: Grid,
  gridKeys: string[],
  prng: () => number,
  config: {
    givenCount: number;
    inventoryCount: number;
  },
): Pick<GameState, "board" | "bank" | "initialBankSize" | "status"> | null => {
  const totalTiles = gridKeys.length;
  if (config.givenCount < 0 || config.inventoryCount < 0) return null;
  if (config.givenCount + config.inventoryCount !== totalTiles) return null;

  const board: { [key: string]: TileData } = {};
  const bank: TileData[] = [];

  const allKeys = gridKeys;
  let givenKeys = new Set<string>();
  let safeGivens = false;
  let givenAttempts = 0;

  while (!safeGivens && givenAttempts < 200) {
    givenAttempts++;
    givenKeys = pickRandomKeys(allKeys, config.givenCount, prng);

    let foundTrueStatement = false;
    forEachEquation(
      Array.from(givenKeys),
      (k) => (givenKeys.has(k) ? grid[k] : undefined),
      (word) => {
        if (word.length >= 3 && isValidEquation(word)) foundTrueStatement = true;
      },
    );

    if (!foundTrueStatement) {
      safeGivens = true;
    }
  }

  if (!safeGivens) return null;

  for (const k of allKeys) {
    const cell = grid[k];
    if (!cell) continue;
    if (givenKeys.has(k)) {
      board[k] = { id: `g_${k}`, ...cell, isGiven: true };
    } else {
      bank.push({ id: `b_${k}`, val: cell.val, type: cell.type });
    }
  }

  bank.sort((a, b) => {
    const w = (t: TileData) => (t.type === "val" ? 1 : t.type === "op" ? 2 : 3);
    if (w(a) !== w(b)) return w(a) - w(b);
    return String(a.val).localeCompare(String(b.val));
  });

  return {
    board,
    bank,
    initialBankSize: bank.length,
    status: "playing",
  };
};

const buildExactGrid = (prng: () => number, targetTotalTiles: number, maxSideLength: number) => {
  for (let attempt = 0; attempt < 30; attempt++) {
    const grid: Grid = {};
    const gridKeys: string[] = [];
    const usage: EquationUsage = { horizontal: new Set(), vertical: new Set() };
    const stmt = generateValidStatement(prng);
    if (stmt.length > maxSideLength) continue;

    const bounds: Bounds = { minR: 0, maxR: 0, minC: 0, maxC: stmt.length - 1 };

    for (let i = 0; i < stmt.length; i++) {
      const char = stmt[i];
      if (!char) continue;
      const key = getKey(0, i);
      grid[key] = { type: getCellType(char), val: char };
      gridKeys.push(key);
      usage.horizontal.add(key);
    }

    let fails = 0;
    while (gridKeys.length < targetTotalTiles && fails < 40) {
      const added = placeEquation(
        grid,
        gridKeys,
        usage,
        bounds,
        prng,
        maxSideLength,
        targetTotalTiles - gridKeys.length,
      );
      fails += Number(added === 0);
    }

    if (gridKeys.length === targetTotalTiles) {
      if (analyzeBoard(grid).valid) {
        return { grid, gridKeys };
      }
    }
  }

  return null;
};

const buildGameFromTarget = (
  prng: () => number,
  targetTotalTiles: number,
  maxSideLength: number,
  givenCount: number,
  inventoryCount: number,
) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = buildExactGrid(prng, targetTotalTiles, maxSideLength);
    /* istanbul ignore next */
    if (!candidate) continue;

    const finalGame = finalizeGame(candidate.grid, candidate.gridKeys, prng, {
      givenCount,
      inventoryCount,
    });
    /* istanbul ignore next */
    if (!finalGame) continue;

    return finalGame;
  }

  /* istanbul ignore next */
  return null;
};

export const generateCustomGameAttempt = (
  config: CustomGameConfig,
  attempt: number,
): GameState | null => {
  const targetTotalTiles = config.givenCount + config.inventoryCount;
  if (config.givenCount <= 0 || config.inventoryCount <= 0 || config.sizeLimit < 5) return null;
  if (targetTotalTiles < 9) return null;
  if (targetTotalTiles > config.sizeLimit * config.sizeLimit) return null;

  const baseSeed = getSeedNumber(config.seed);
  const prng = xoshiro128pp((baseSeed + Math.imul(attempt + 1, 0x9e3779b9)) >>> 0);
  const finalGame = buildGameFromTarget(
    prng,
    targetTotalTiles,
    config.sizeLimit,
    config.givenCount,
    config.inventoryCount,
  );
  if (!finalGame) return null;

  return {
    ...finalGame,
    difficulty: "Custom",
    stage: 1,
    customConfig: config,
  };
};

export const generateGame = (stage: number, difficulty: Difficulty) => {
  const seedStr = `${difficulty}_${stage}`;
  const prng = xoshiro128pp(getHashSeed(seedStr));

  let diffPercent: number;
  let minInv: number;
  let maxInv: number;
  if (difficulty === "Easy") {
    diffPercent = 0.6;
    minInv = 5;
    maxInv = 7;
  } else if (difficulty === "Medium") {
    diffPercent = 0.4;
    minInv = 10;
    maxInv = 14;
  } else if (difficulty === "Hard") {
    diffPercent = 0.2;
    minInv = 15;
    maxInv = 21;
  } else {
    diffPercent = 0.2;
    minInv = 15;
    maxInv = 21;
  }

  const targetInv = minInv + Math.floor(prng() * (maxInv - minInv + 1));
  const targetTotalTiles = Math.ceil(targetInv / (1 - diffPercent));
  const numInventory = Math.min(Math.max(minInv, 1), maxInv);
  const numGivens = Math.max(1, targetTotalTiles - numInventory);
  const finalGame = buildGameFromTarget(prng, targetTotalTiles, 10, numGivens, numInventory);
  if (!finalGame) return { board: {}, bank: [], initialBankSize: 0, status: "playing" as const };
  return finalGame;
};

export const generateCustomGame = (config: CustomGameConfig): GameState | null => {
  for (let attempt = 0; attempt < CUSTOM_GAME_RETRY_LIMIT; attempt++) {
    const finalGame = generateCustomGameAttempt(config, attempt);
    if (!finalGame) continue;
    return finalGame;
  }

  return null;
};

type ValidationResult = { valid: true } | { valid: false; reason: string };

export const validateBoard = (board: BoardLike): ValidationResult => {
  return analyzeBoard(board);
};
