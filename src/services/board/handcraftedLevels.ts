import { getCellType, getGridBounds, shuffleInPlace } from "@/services/board/grid";
import { analyzeBoard } from "@/services/board/validation";
import type { TileData } from "@/services/math";
import {
  getHashSeed,
  OP_DIV,
  OP_MINUS,
  OP_MULT,
  OP_PLUS,
  REL_EQ,
  xoshiro128pp,
} from "@/services/math";
import type { GameState } from "@/services/storage";

export type CrossingLevelSpec = {
  pattern: CrossingPattern;
  removalVariant?: number;
  solutionTiles?: number;
  formulas: {
    horizontals: readonly [string, string, string];
    verticals: readonly [string, string, string];
  };
};

type HandcraftedLevel = {
  solution: Record<string, string>;
  removed: Record<string, string>;
};

type FormulaLine = {
  text: string;
  tokens: readonly string[];
  mathKey: string;
  leftRange: readonly [number, number];
  rightRange: readonly [number, number];
  resultRange: readonly [number, number];
};

type AxisOffsets = readonly [number, number, number];

type CrossingPattern = {
  cols: AxisOffsets;
  rows: AxisOffsets;
};

const MAX_CROSSING_NUMBER = 99;
const MAX_CROSSING_SOLUTION_TILE_COUNT = 30;

const bankValues = [
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
] as const;

const crossingPattern = { cols: [1, 3, 4], rows: [1, 2, 4] } as const satisfies CrossingPattern;

const crossingLevelSpec = (
  removalVariant: number,
  horizontals: readonly [string, string, string],
  verticals: readonly [string, string, string],
) =>
  ({
    pattern: crossingPattern,
    solutionTiles: 27,
    removalVariant,
    formulas: { horizontals, verticals },
  }) satisfies CrossingLevelSpec;

const levelSpecs = [
  crossingLevelSpec(2, ["9=8+1", "21÷3=7", "34=17×2"], ["5=1+4", "7+3=10", "21=27−6"]),
  crossingLevelSpec(13, ["5=4+1", "11−7=4", "96=12×8"], ["7=1+6", "3+7=10", "41=82÷2"]),
  crossingLevelSpec(2, ["7=6+1", "81÷9=9", "32=16×2"], ["3=1+2", "1+9=10", "41=46−5"]),
  crossingLevelSpec(13, ["9=8+1", "21÷3=7", "56=14×4"], ["7=1+6", "7+3=10", "41=44−3"]),
  crossingLevelSpec(8, ["7=6+1", "81÷9=9", "52=13×4"], ["3=1+2", "1+9=10", "81=83−2"]),
  crossingLevelSpec(3, ["7=6+1", "81÷9=9", "21−17=4"], ["2=1+1", "1+9=10", "51=17×3"]),
  crossingLevelSpec(1, ["7=6+1", "11−3=8", "52=13×4"], ["3=1+2", "7+3=10", "31=93÷3"]),
  crossingLevelSpec(13, ["6=5+1", "21÷3=7", "28=14×2"], ["9=1+8", "7+3=10", "71=74−3"]),
  crossingLevelSpec(8, ["6=5+1", "81÷9=9", "13=17−4"], ["4=1+3", "1+9=10", "81=27×3"]),
] as const satisfies readonly CrossingLevelSpec[];

export const CROSSING_LEVEL_COUNT = levelSpecs.length;

const sortKeys = (left: string, right: string) => {
  const [leftRow = 0, leftCol = 0] = left.split(",").map(Number);
  const [rightRow = 0, rightCol = 0] = right.split(",").map(Number);
  return leftRow - rightRow || leftCol - rightCol;
};

const countValues = (values: Iterable<string>) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

const shuffleCopy = <T>(items: readonly T[], prng: () => number) =>
  shuffleInPlace([...items], prng);

const requiredBankCounts = countValues(bankValues);

const hasRequiredBankValues = (solution: Record<string, string>) => {
  const solutionCounts = countValues(Object.values(solution));
  for (const [value, count] of requiredBankCounts) {
    if ((solutionCounts.get(value) ?? 0) < count) return false;
  }
  return true;
};

const toBoardLike = (tiles: Record<string, string>) => {
  const board: Record<string, { val: string }> = {};
  for (const [key, val] of Object.entries(tiles)) board[key] = { val };
  return board;
};

const isSingleDigit = (value: number) => value >= 0 && value <= 9;

const isAllowedNumber = (value: number) => value >= 0 && value <= MAX_CROSSING_NUMBER;

const hasSingleDigitNumber = (left: number, right: number, result: number) =>
  isSingleDigit(left) || isSingleDigit(right) || isSingleDigit(result);

const isTrivialFormula = (left: number, op: string, right: number, result: number) => {
  if (op === OP_PLUS) return left === 0 || right === 0;
  if (op === OP_MINUS) return right === 0 || left === right;
  if (op === OP_MULT) return left === 0 || right === 0 || left === 1 || right === 1;
  return right === 1 || left === right || result === 0;
};

const mathKeyFor = (left: number, op: string, right: number, result: number) => {
  if (op === OP_PLUS || op === OP_MINUS) {
    const addends = op === OP_PLUS ? [left, right] : [right, result];
    addends.sort((a, b) => a - b);
    return `add:${addends[0]}:${addends[1]}:${op === OP_PLUS ? result : left}`;
  }

  const factors = op === OP_MULT ? [left, right] : [right, result];
  factors.sort((a, b) => a - b);
  return `mult:${factors[0]}:${factors[1]}:${op === OP_MULT ? result : left}`;
};

const buildFormulaLine = (
  left: number,
  op: string,
  right: number,
  result: number,
  reversed: boolean,
): FormulaLine => {
  const leftTokens = String(left).split("");
  const rightTokens = String(right).split("");
  const resultTokens = String(result).split("");

  if (reversed) {
    const leftStart = resultTokens.length + 1;
    const rightStart = leftStart + leftTokens.length + 1;
    const tokens = [...resultTokens, REL_EQ, ...leftTokens, op, ...rightTokens];

    return {
      text: tokens.join(""),
      tokens,
      mathKey: mathKeyFor(left, op, right, result),
      resultRange: [0, resultTokens.length],
      leftRange: [leftStart, leftStart + leftTokens.length],
      rightRange: [rightStart, rightStart + rightTokens.length],
    };
  }

  const rightStart = leftTokens.length + 1;
  const resultStart = rightStart + rightTokens.length + 1;
  const tokens = [...leftTokens, op, ...rightTokens, REL_EQ, ...resultTokens];

  return {
    text: tokens.join(""),
    tokens,
    mathKey: mathKeyFor(left, op, right, result),
    leftRange: [0, leftTokens.length],
    rightRange: [rightStart, rightStart + rightTokens.length],
    resultRange: [resultStart, resultStart + resultTokens.length],
  };
};

const candidateFormulas = (() => {
  const byText = new Map<string, FormulaLine>();
  const addFormula = (left: number, op: string, right: number, result: number) => {
    if (!isAllowedNumber(left) || !isAllowedNumber(right) || !isAllowedNumber(result)) return;
    if (!hasSingleDigitNumber(left, right, result)) return;
    if (isTrivialFormula(left, op, right, result)) return;

    for (const reversed of [false, true]) {
      const formula = buildFormulaLine(left, op, right, result, reversed);
      byText.set(formula.text, formula);
    }
  };

  for (let left = 0; left <= 99; left++) {
    for (let right = 0; right <= 99; right++) {
      addFormula(left, OP_PLUS, right, left + right);
      if (left >= right) addFormula(left, OP_MINUS, right, left - right);
      addFormula(left, OP_MULT, right, left * right);
    }
  }

  for (let right = 1; right <= 99; right++) {
    for (let result = 0; result <= 99; result++) {
      addFormula(right * result, OP_DIV, right, result);
    }
  }

  return Array.from(byText.values()).sort((left, right) => left.text.localeCompare(right.text));
})();

const formulaByText = new Map(candidateFormulas.map((formula) => [formula.text, formula]));

const allRangeKeysRemoved = (
  keys: readonly string[],
  [start, end]: readonly [number, number],
  removedKeys: Set<string>,
) => keys.slice(start, end).every((key) => removedKeys.has(key));

const isDirectComputeVisible = (
  formula: FormulaLine,
  keys: readonly string[],
  removedKeys: Set<string>,
) => {
  const ranges = [formula.leftRange, formula.rightRange, formula.resultRange];
  const missingRanges = ranges.filter((range) => allRangeKeysRemoved(keys, range, removedKeys));
  if (missingRanges.length !== 1) return false;
  const missingRange = missingRanges[0];
  if (missingRange === undefined) return false;

  return keys.every((key, index) => {
    if (index >= missingRange[0] && index < missingRange[1]) return removedKeys.has(key);
    return !removedKeys.has(key);
  });
};

const buildSolution = (
  horizontals: readonly FormulaLine[],
  verticals: readonly FormulaLine[],
  pattern: CrossingPattern,
) => {
  const solution: Record<string, string> = {};
  const usage = new Map<string, number>();
  const rowBase = pattern.rows[0];
  const colBase = pattern.cols[0];
  const rowCoords = pattern.rows.map((offset) => offset - rowBase);
  const colCoords = pattern.cols.map((offset) => offset - colBase);

  const placeTile = (key: string, val: string) => {
    const existing = solution[key];
    if (existing !== undefined && existing !== val) return false;
    solution[key] = val;
    usage.set(key, (usage.get(key) ?? 0) + 1);
    return true;
  };

  for (const [rowIndex, formula] of horizontals.entries()) {
    const row = rowCoords[rowIndex] as number;

    for (const [tokenIndex, token] of formula.tokens.entries()) {
      if (!placeTile(`${row},${tokenIndex - colBase}`, token)) return null;
    }
  }

  for (const [colIndex, formula] of verticals.entries()) {
    const col = colCoords[colIndex] as number;

    for (const [tokenIndex, token] of formula.tokens.entries()) {
      if (!placeTile(`${tokenIndex - rowBase},${col}`, token)) return null;
    }
  }

  let crossingCount = 0;
  for (const count of usage.values()) {
    if (count > 2) return null;
    if (count === 2) crossingCount++;
  }
  if (crossingCount !== 9) return null;

  return solution;
};

const buildFormulaLayouts = (
  horizontals: readonly FormulaLine[],
  verticals: readonly FormulaLine[],
  pattern: CrossingPattern,
) => {
  const rowBase = pattern.rows[0];
  const colBase = pattern.cols[0];
  const rowCoords = pattern.rows.map((offset) => offset - rowBase);
  const colCoords = pattern.cols.map((offset) => offset - colBase);
  const layouts: { formula: FormulaLine; keys: string[] }[] = [];

  for (const [rowIndex, formula] of horizontals.entries()) {
    const row = rowCoords[rowIndex] as number;
    layouts.push({
      formula,
      keys: formula.tokens.map((_, tokenIndex) => `${row},${tokenIndex - colBase}`),
    });
  }

  for (const [colIndex, formula] of verticals.entries()) {
    const col = colCoords[colIndex] as number;
    layouts.push({
      formula,
      keys: formula.tokens.map((_, tokenIndex) => `${tokenIndex - rowBase},${col}`),
    });
  }

  return layouts;
};

const canUseAsInitialBoard = (
  solution: Record<string, string>,
  removedKeys: Set<string>,
  layouts: readonly { formula: FormulaLine; keys: string[] }[],
) => {
  const given: Record<string, string> = {};
  const givenKeys: string[] = [];
  for (const [key, val] of Object.entries(solution)) {
    if (removedKeys.has(key)) continue;
    given[key] = val;
    givenKeys.push(key);
  }

  if (givenKeys.length === 0) return false;

  const bounds = getGridBounds(givenKeys);
  if (bounds.minR >= 0 && bounds.minC >= 0) return false;
  for (const { formula, keys } of layouts) {
    const missing = keys.filter((key) => removedKeys.has(key)).length;
    if (missing === 1) return false;
    if (isDirectComputeVisible(formula, keys, removedKeys)) return false;
  }

  return !analyzeBoard(toBoardLike(given)).valid;
};

const pickRemovedTiles = (
  solution: Record<string, string>,
  layouts: readonly { formula: FormulaLine; keys: string[] }[],
  prng: () => number,
  removalVariant = 0,
) => {
  const keysByValue = new Map<string, string[]>();
  for (const [key, value] of Object.entries(solution).sort(([left], [right]) =>
    sortKeys(left, right),
  )) {
    const keys = keysByValue.get(value);
    if (keys) {
      keys.push(key);
    } else {
      keysByValue.set(value, [key]);
    }
  }

  for (let attempt = 0; attempt < 3000; attempt++) {
    const removed: Record<string, string> = {};
    const removedKeys = new Set<string>();
    let failed = false;

    for (const value of shuffleCopy(bankValues, prng)) {
      const candidates = (keysByValue.get(value) ?? []).filter((key) => !removedKeys.has(key));
      const key = candidates[Math.floor(prng() * candidates.length)];
      /* v8 ignore next 3 -- hasRequiredBankValues prechecks this inventory path. */
      if (key === undefined) {
        failed = true;
        break;
      }

      removedKeys.add(key);
      removed[key] = value;
    }

    if (!failed && canUseAsInitialBoard(solution, removedKeys, layouts)) {
      if (removalVariant <= 0) return removed;
      removalVariant--;
    }
  }

  return null;
};

const tryBuildLevel = (
  horizontals: readonly FormulaLine[],
  verticals: readonly FormulaLine[],
  pattern: CrossingPattern,
  prng: () => number,
  removalVariant = 0,
) => {
  const solution = buildSolution(horizontals, verticals, pattern);
  /* v8 ignore next -- search only passes compatible crossing signatures. */
  if (!solution) return null;
  if (Object.keys(solution).length > MAX_CROSSING_SOLUTION_TILE_COUNT) return null;
  if (!hasRequiredBankValues(solution)) return null;
  /* v8 ignore next -- candidate formulas are valid equations; this is a defensive verifier gate. */
  if (!analyzeBoard(toBoardLike(solution)).valid) return null;

  const removed = pickRemovedTiles(
    solution,
    buildFormulaLayouts(horizontals, verticals, pattern),
    prng,
    removalVariant,
  );
  if (removed) return { solution, removed };
  /* v8 ignore next 2 -- fixed level specs are searched until a removable board is found. */
  return null;
};

const specSeedFor = (spec: CrossingLevelSpec) =>
  `${spec.pattern.cols.join("-")}|${spec.pattern.rows.join("-")}|${spec.formulas.horizontals.join("|")}|${spec.formulas.verticals.join("|")}`;

const buildConfiguredLevel = (spec: CrossingLevelSpec) => {
  const horizontals = spec.formulas.horizontals.map((text) => formulaByText.get(text));
  const verticals = spec.formulas.verticals.map((text) => formulaByText.get(text));
  if (horizontals.some((formula) => !formula) || verticals.some((formula) => !formula)) return null;

  const mathKeys = new Set(
    [...horizontals, ...verticals].map((formula) => (formula as FormulaLine).mathKey),
  );
  if (mathKeys.size !== 6) return null;

  const level = tryBuildLevel(
    horizontals as FormulaLine[],
    verticals as FormulaLine[],
    spec.pattern,
    xoshiro128pp(getHashSeed(specSeedFor(spec))),
    spec.removalVariant,
  );
  if (
    level &&
    spec.solutionTiles !== undefined &&
    Object.keys(level.solution).length !== spec.solutionTiles
  ) {
    return null;
  }
  return level;
};

const levelCache = new Map<number, HandcraftedLevel>();

const getCrossingLevel = (stage: number) => {
  if (stage < 1 || stage > CROSSING_LEVEL_COUNT) return null;
  const cached = levelCache.get(stage);
  if (cached) return cached;

  const level = buildConfiguredLevel(levelSpecs[stage - 1] as CrossingLevelSpec);
  /* v8 ignore next -- checked current level specs all resolve during quality. */
  if (level) levelCache.set(stage, level);
  return level;
};

export const getCrossingLevelSolution = (stage: number) => {
  const level = getCrossingLevel(stage);
  return level ? { ...level.solution } : null;
};

const buildGameFromLevel = (level: HandcraftedLevel, idPrefix: string) => {
  const removedKeys = new Set(Object.keys(level.removed));
  const board: GameState["board"] = {};

  for (const [key, val] of Object.entries(level.solution).sort(([left], [right]) =>
    sortKeys(left, right),
  )) {
    if (removedKeys.has(key)) continue;
    board[key] = { id: `${idPrefix}_g_${key}`, val, type: getCellType(val), isGiven: true };
  }

  const bank: TileData[] = bankValues.map((val, index) => ({
    id: `${idPrefix}_b_${index}_${val}`,
    val,
    type: getCellType(val),
  }));

  return {
    board,
    bank,
    initialBankSize: bank.length,
    status: "playing" as const,
  };
};

export const buildCrossingGameFromSpec = (spec: CrossingLevelSpec) => {
  const level = buildConfiguredLevel(spec);
  if (!level) return null;

  return {
    game: buildGameFromLevel(
      level,
      `m_${getHashSeed(specSeedFor(spec))}_v${spec.removalVariant ?? 0}`,
    ),
    solution: { ...level.solution },
  };
};

export const buildCrossingGame = (
  stage: number,
): Pick<GameState, "board" | "bank" | "initialBankSize" | "status"> | null => {
  const level = getCrossingLevel(stage);
  return level ? buildGameFromLevel(level, `m${stage}`) : null;
};
