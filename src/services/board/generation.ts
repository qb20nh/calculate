import {
  type Bounds,
  type Direction,
  type EquationUsage,
  forEachEquation,
  type Grid,
  getCellType,
  getKey,
  parseKey,
  pickRandomKeys,
  shuffleInPlace,
} from "@/services/board/grid";
import { buildCrossingGame } from "@/services/board/handcraftedLevels";
import { analyzeBoard } from "@/services/board/validation";
import { isValidRetryCount, validateCustomGameConfig } from "@/services/customGameConfig";
import {
  generateValidStatement,
  getHashSeed,
  isValidEquation,
  type TileData,
  xoshiro128pp,
} from "@/services/math";
import type { CustomGameConfig, Difficulty, GameState } from "@/services/storage";

const sortBank = (bank: TileData[]) =>
  bank.sort((a, b) => {
    const w = (tile: TileData) => (tile.type === "val" ? 1 : tile.type === "op" ? 2 : 3);
    if (w(a) !== w(b)) return w(a) - w(b);
    return String(a.val).localeCompare(String(b.val));
  });

const placeEquation = (
  grid: Grid,
  gridKeys: string[],
  usage: EquationUsage,
  bounds: Bounds,
  prng: () => number,
  maxSideLength: number,
  remainingTiles?: number,
) => {
  const stmt = generateValidStatement(prng);

  const possibleIntersections: { k: string; idx: number }[] = [];
  for (const key of gridKeys) {
    const cell = grid[key];
    if (!cell) continue;
    const cellVal = String(cell.val);
    for (let index = 0; index < stmt.length; index++) {
      const char = stmt[index];
      if (char && char === cellVal) {
        possibleIntersections.push({ k: key, idx: index });
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
      for (let index = 0; index < stmt.length; index++) {
        const cr = startR + index * dir.dy;
        const cc = startC + index * dir.dx;
        cells.push(getKey(cr, cc));
      }

      const newEquationCells = new Set(cells);
      let collision = false;
      let nextMinR = bounds.minR;
      let nextMaxR = bounds.maxR;
      let nextMinC = bounds.minC;
      let nextMaxC = bounds.maxC;

      for (let index = 0; index < stmt.length; index++) {
        const cr = startR + index * dir.dy;
        const cc = startC + index * dir.dx;
        const cellKey = cells[index];
        if (!cellKey) {
          collision = true;
          break;
        }

        nextMinR = Math.min(nextMinR, cr);
        nextMaxR = Math.max(nextMaxR, cr);
        nextMinC = Math.min(nextMinC, cc);
        nextMaxC = Math.max(nextMaxC, cc);

        if (index === match.idx) continue;

        if (grid[cellKey]) {
          collision = true;
          break;
        }

        const neighbors = [
          getKey(cr + 1, cc),
          getKey(cr - 1, cc),
          getKey(cr, cc + 1),
          getKey(cr, cc - 1),
        ];
        for (const neighborKey of neighbors) {
          if (grid[neighborKey] && !newEquationCells.has(neighborKey)) {
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
        for (let index = 0; index < stmt.length; index++) {
          const char = stmt[index];
          if (!char) continue;
          const cellKey = cells[index];
          if (!cellKey) continue;
          grid[cellKey] = { type: getCellType(char), val: char };
          if (index !== match.idx) gridKeys.push(cellKey);
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
      (key) => (givenKeys.has(key) ? grid[key] : undefined),
      (word) => {
        if (word.length >= 3 && isValidEquation(word)) foundTrueStatement = true;
      },
    );

    if (!foundTrueStatement) {
      safeGivens = true;
    }
  }

  if (!safeGivens) return null;

  for (const key of allKeys) {
    const cell = grid[key];
    if (!cell) continue;
    if (givenKeys.has(key)) {
      board[key] = { id: `g_${key}`, ...cell, isGiven: true };
    } else {
      bank.push({ id: `b_${key}`, val: cell.val, type: cell.type });
    }
  }

  sortBank(bank);

  return {
    board,
    bank,
    initialBankSize: bank.length,
    status: "playing",
  };
};

const buildExactGrid = (prng: () => number, targetTotalTiles: number, maxSideLength: number) => {
  const grid: Grid = {};
  const gridKeys: string[] = [];
  const usage: EquationUsage = { horizontal: new Set(), vertical: new Set() };
  const stmt = generateValidStatement(prng);
  if (stmt.length > maxSideLength) return null;

  const bounds: Bounds = { minR: 0, maxR: 0, minC: 0, maxC: stmt.length - 1 };

  for (let index = 0; index < stmt.length; index++) {
    const char = stmt[index];
    if (!char) continue;
    const key = getKey(0, index);
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

  if (gridKeys.length === targetTotalTiles && analyzeBoard(grid).valid) {
    return { grid, gridKeys };
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
  const candidate = buildExactGrid(prng, targetTotalTiles, maxSideLength);
  if (!candidate) return null;

  return finalizeGame(candidate.grid, candidate.gridKeys, prng, {
    givenCount,
    inventoryCount,
  });
};

export const generateCustomGameAttempt = (
  config: CustomGameConfig,
  attempt: number,
): GameState | null => {
  if (!isValidRetryCount(attempt)) return null;
  const configWithAttempt = { ...config, attempt };
  if (validateCustomGameConfig(configWithAttempt) !== null) return null;

  const targetTotalTiles = config.givenCount + config.inventoryCount;
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
    customConfig: configWithAttempt,
  };
};

const DIFFICULTY_PARAMS: Record<
  Difficulty,
  { diffPercent: number; minInv: number; maxInv: number }
> = {
  Easy: { diffPercent: 0.6, minInv: 5, maxInv: 7 },
  Medium: { diffPercent: 0.4, minInv: 10, maxInv: 14 },
  Hard: { diffPercent: 0.2, minInv: 15, maxInv: 21 },
};

export const generateGame = (stage: number, difficulty: Difficulty, attempt = 0) => {
  const seedStr = `${difficulty}_${stage}_${attempt}`;
  const prng = xoshiro128pp(getHashSeed(seedStr));
  const { diffPercent, minInv, maxInv } = DIFFICULTY_PARAMS[difficulty] ?? DIFFICULTY_PARAMS.Hard;

  const targetInv = minInv + Math.floor(prng() * (maxInv - minInv + 1));
  const targetTotalTiles = Math.ceil(targetInv / (1 - diffPercent));
  const numInventory = Math.min(Math.max(targetInv, minInv), maxInv);
  const numGivens = Math.max(1, targetTotalTiles - numInventory);
  return (
    buildGameFromTarget(prng, targetTotalTiles, 10, numGivens, numInventory) || {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing" as const,
    }
  );
};

export const generateCrossingGame = (stage: number) => buildCrossingGame(stage);

export const generateStandardGame = (
  stage: number,
  difficulty: Difficulty,
  maxAttempts = 3000,
): GameState => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const game = generateGame(stage, difficulty, attempt);
    if (Object.keys(game.board).length > 0) {
      return { ...game, difficulty, stage, solvedAcknowledged: false };
    }
  }

  return {
    board: {},
    bank: [],
    initialBankSize: 0,
    status: "playing",
    difficulty,
    stage,
    solvedAcknowledged: false,
  };
};

export const generateCustomGame = (config: CustomGameConfig, attempt = 0): GameState | null =>
  generateCustomGameAttempt(config, attempt);
