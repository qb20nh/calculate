import {
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
import type { Difficulty } from "@/services/storage";

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
  callback: (word: { val: string; key: string }[]) => boolean | void,
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

const placeEquation = (
  grid: Grid,
  gridKeys: string[],
  usage: EquationUsage,
  bounds: Bounds,
  prng: () => number,
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
          if (nextMaxR - nextMinR + 1 > 10 || nextMaxC - nextMinC + 1 > 10) {
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

          return stmt.length - 1;
        }
      }
    }
  }
  return 0;
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
  } else {
    diffPercent = 0.2;
    minInv = 15;
    maxInv = 21;
  }

  const targetInv = minInv + Math.floor(prng() * (maxInv - minInv + 1));
  const targetTotalTiles = Math.ceil(targetInv / (1 - diffPercent));

  let bestGrid: Grid = {};
  let bestGridKeys: string[] = [];

  for (let attempt = 0; attempt < 30; attempt++) {
    const grid: Grid = {};
    const gridKeys: string[] = [];
    const usage: EquationUsage = { horizontal: new Set(), vertical: new Set() };
    const stmt = generateValidStatement(prng);
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
      fails += Number(placeEquation(grid, gridKeys, usage, bounds, prng) === 0);
    }

    if (gridKeys.length > bestGridKeys.length) {
      bestGrid = grid;
      bestGridKeys = gridKeys;
    }

    if (gridKeys.length >= targetTotalTiles) {
      break;
    }
  }

  const board: { [key: string]: TileData } = {};
  const bank: TileData[] = [];

  const totalTiles = bestGridKeys.length;
  let numGivens = Math.round(totalTiles * diffPercent);
  let numInventory = totalTiles - numGivens;

  const maxInventory = Math.min(maxInv, totalTiles > 0 ? totalTiles - 1 : 0);
  numInventory = Math.min(Math.max(numInventory, minInv), maxInventory);
  numGivens = totalTiles - numInventory;

  const allKeys = bestGridKeys;
  let givenKeys = new Set<string>();
  let safeGivens = false;
  let givenAttempts = 0;

  while (!safeGivens && givenAttempts < 200) {
    givenAttempts++;
    givenKeys = pickRandomKeys(allKeys, numGivens, prng);

    let foundTrueStatement = false;
    forEachEquation(
      Array.from(givenKeys),
      (k) => (givenKeys.has(k) ? bestGrid[k] : undefined),
      (word) => {
        if (word.length >= 3 && isValidEquation(word)) foundTrueStatement = true;
      },
    );

    if (!foundTrueStatement) {
      safeGivens = true;
    }
  }

  for (const k of allKeys) {
    const cell = bestGrid[k];
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

  return { board, bank, initialBankSize: bank.length, status: "playing" as const };
};

type ValidationResult = { valid: true } | { valid: false; reason: string };

export const validateBoard = (board: { [key: string]: TileData }): ValidationResult => {
  const placedKeys = Object.keys(board);
  if (placedKeys.length === 0) return { valid: false, reason: "Board is empty." };

  const visited = new Set<string>();
  const firstKey = placedKeys[0] as string;
  const queue = [firstKey];
  visited.add(firstKey);

  for (const item of queue) {
    const [r, c] = parseKey(item);
    const neighbors = [getKey(r + 1, c), getKey(r - 1, c), getKey(r, c + 1), getKey(r, c - 1)];

    for (const nk of neighbors) {
      if (board[nk] && !visited.has(nk)) {
        visited.add(nk);
        queue.push(nk);
      }
    }
  }

  if (visited.size !== placedKeys.length)
    return { valid: false, reason: "All tiles must be connected together." };

  let invalidFormula: string | null = null;
  let missingOperator: string | null = null;
  let nonCrossingSequence: string | null = null;
  let equationsCount = 0;

  forEachEquation(
    placedKeys,
    (k) => board[k],
    (word) => {
      if (word.length >= 2) {
        if (isValidEquation(word)) {
          equationsCount++;
        } else {
          const sequence = word.map((w) => w.val).join("");
          const hasRel = word.some((t) => t.val === "=" || t.val === "<" || t.val === ">");
          const hasOp = word.some(
            (t) => t.val === OP_PLUS || t.val === OP_MINUS || t.val === OP_MULT || t.val === OP_DIV,
          );

          if (word.length >= 3 && hasRel && !hasOp) {
            missingOperator = sequence;
          } else if (word.length >= 3 && hasRel) {
            invalidFormula = sequence;
          } else {
            nonCrossingSequence = sequence;
          }
          return false; // Break immediately
        }
      }
    },
  );

  if (missingOperator) {
    return {
      valid: false,
      reason: `Formulas must include at least one operator. "${missingOperator}"`,
    };
  }

  if (invalidFormula) {
    return { valid: false, reason: `Invalid formula: "${invalidFormula}"` };
  }

  if (nonCrossingSequence) {
    return {
      valid: false,
      reason: `All formulas must cross at least once.`,
    };
  }

  if (equationsCount === 0) return { valid: false, reason: "No valid mathematical formula found." };

  return { valid: true };
};
