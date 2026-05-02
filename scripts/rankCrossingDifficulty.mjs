#!/usr/bin/env node
// @ts-nocheck
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = fileURLToPath(import.meta.url);
const FINAL_DIFFICULTY_RATIO = 10;
const TARGET_STEP_RATIO = FINAL_DIFFICULTY_RATIO ** (1 / 8);
const MAX_CROSSING_SOLUTION_TILE_COUNT = 30;
const SCORE_MARGIN = 1.1;
const MAX_SCORE_DISTANCE = Math.log(SCORE_MARGIN);
const MIN_TARGET_SOLUTION_TILES = 27;
const TRACE_SEARCH = process.env.CROSSING_SEARCH_TRACE === "1";

const makeCounter = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

const cloneMap = (map) => new Map(map);

const mapValue = (map, key) => map.get(key) ?? 0;

const scoreDistance = (score, target) => Math.abs(Math.log(score / target));

const traceSearch = (message) => {
  if (TRACE_SEARCH) process.stderr.write(`${message}\n`);
};

const buildTileSequences = (tiles) => {
  const counts = makeCounter(tiles);
  const uniqueTiles = [...counts.keys()].sort((left, right) => left - right);
  const sequences = [];
  const current = [];

  const recurse = () => {
    if (current.length === tiles.length) {
      sequences.push([...current]);
      return;
    }

    for (const tile of uniqueTiles) {
      const count = mapValue(counts, tile);
      if (count <= 0) continue;

      counts.set(tile, count - 1);
      current.push(tile);
      recurse();
      current.pop();
      counts.set(tile, count);
    }
  };

  recurse();
  return sequences;
};

const parseKey = (key) => {
  const [row = "0", col = "0"] = key.split(",");
  return [Number(row), Number(col)];
};

const getBounds = (keys) => {
  let minR = Infinity;
  let maxR = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;

  for (const key of keys) {
    const [row, col] = parseKey(key);
    minR = Math.min(minR, row);
    maxR = Math.max(maxR, row);
    minC = Math.min(minC, col);
    maxC = Math.max(maxC, col);
  }

  return { minR, maxR, minC, maxC };
};

const buildSymbolBits = (math) =>
  new Map(
    [
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
      math.OP_PLUS,
      math.OP_MINUS,
      math.OP_MULT,
      math.OP_DIV,
      math.REL_EQ,
    ].map((symbol, index) => [symbol, 1 << index]),
  );

const symbolMaskFor = (tokens, symbolBits) =>
  tokens.reduce((mask, token) => mask | mapValue(symbolBits, token), 0);

const sortedKeys = (keys) =>
  [...keys].sort((left, right) => {
    const [leftRow, leftCol] = parseKey(left);
    const [rightRow, rightCol] = parseKey(right);
    return leftRow - rightRow || leftCol - rightCol;
  });

const collectFormulaRuns = (solution, isValidEquation) => {
  const keys = Object.keys(solution);
  const bounds = getBounds(keys);
  const runs = [];

  const scan = (outerStart, outerEnd, innerStart, innerEnd, horizontal) => {
    for (let outer = outerStart; outer <= outerEnd; outer++) {
      let run = [];

      for (let inner = innerStart; inner <= innerEnd + 1; inner++) {
        const key = horizontal ? `${outer},${inner}` : `${inner},${outer}`;
        const val = solution[key];

        if (val !== undefined) {
          run.push({ key, val });
          continue;
        }

        if (run.length > 0) {
          if (run.length >= 3 && isValidEquation(run)) {
            runs.push({
              axis: horizontal ? "H" : "V",
              keys: run.map((item) => item.key),
              text: run.map((item) => item.val).join(""),
            });
          }
          run = [];
        }
      }
    }
  };

  scan(bounds.minR, bounds.maxR, bounds.minC, bounds.maxC, true);
  scan(bounds.minC, bounds.maxC, bounds.minR, bounds.maxR, false);

  return runs;
};

const digitLoad = (value) => {
  const text = String(value);
  if (text.length === 1) return 0.4;
  return 1.1 + (text.length - 2) * 0.8;
};

const isSingleDigit = (value) => value >= 0 && value <= 9;

const isAllowedNumber = (value) => value >= 0 && value <= 99;

const hasSingleDigitNumber = (left, right, result) =>
  isSingleDigit(left) || isSingleDigit(right) || isSingleDigit(result);

const isTrivialFormula = (left, op, right, result, { OP_PLUS, OP_MINUS, OP_MULT, OP_DIV }) => {
  if (op === OP_PLUS) return left === 0 || right === 0;
  if (op === OP_MINUS) return right === 0 || left === right;
  if (op === OP_MULT) return left === 0 || right === 0 || left === 1 || right === 1;
  if (op === OP_DIV) return right === 1 || left === right || result === 0;
  return false;
};

const mathKeyFor = (left, op, right, result, { OP_PLUS, OP_MINUS, OP_MULT }) => {
  if (op === OP_PLUS || op === OP_MINUS) {
    const addends = op === OP_PLUS ? [left, right] : [right, result];
    addends.sort((a, b) => a - b);
    return `add:${addends[0]}:${addends[1]}:${op === OP_PLUS ? result : left}`;
  }

  const factors = op === OP_MULT ? [left, right] : [right, result];
  factors.sort((a, b) => a - b);
  return `mult:${factors[0]}:${factors[1]}:${op === OP_MULT ? result : left}`;
};

const buildFormulaTokens = (left, op, right, result, reversed, { REL_EQ }) => {
  const leftTokens = String(left).split("");
  const rightTokens = String(right).split("");
  const resultTokens = String(result).split("");

  return reversed
    ? [...resultTokens, REL_EQ, ...leftTokens, op, ...rightTokens]
    : [...leftTokens, op, ...rightTokens, REL_EQ, ...resultTokens];
};

const parseFormulaTokens = (tokens, { OP_PLUS, OP_MINUS, OP_MULT, OP_DIV, REL_EQ }) => {
  const relationIndex = tokens.indexOf(REL_EQ);
  const opIndex = tokens.findIndex(
    (token, index) =>
      index !== relationIndex &&
      (token === OP_PLUS || token === OP_MINUS || token === OP_MULT || token === OP_DIV),
  );
  if (relationIndex <= 0 || relationIndex === tokens.length - 1 || opIndex < 0) return null;

  const readNumber = (items) => {
    if (items.length === 0 || items.some((item) => !/^\d$/.test(item))) return null;
    return Number(items.join(""));
  };

  const op = tokens[opIndex];
  if (opIndex < relationIndex) {
    const left = readNumber(tokens.slice(0, opIndex));
    const right = readNumber(tokens.slice(opIndex + 1, relationIndex));
    const result = readNumber(tokens.slice(relationIndex + 1));
    if (left === null || right === null || result === null) return null;
    return {
      left,
      op,
      right,
      result,
      reversed: false,
      opIndex,
      relationIndex,
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
    left,
    op,
    right,
    result,
    reversed: true,
    opIndex,
    relationIndex,
    resultRange: [0, relationIndex],
    leftRange: [relationIndex + 1, opIndex],
    rightRange: [opIndex + 1, tokens.length],
  };
};

const estimateArithmeticEffort = (tokens, { OP_PLUS, OP_MINUS, OP_MULT, OP_DIV, REL_EQ }) => {
  const parsed = parseFormulaTokens(tokens, { OP_PLUS, OP_MINUS, OP_MULT, OP_DIV, REL_EQ });
  if (!parsed) return tokens.length;

  const { left, op, right, result } = parsed;

  let effort = 1.5 + digitLoad(left) + digitLoad(right) + digitLoad(result);
  if (parsed.reversed) effort += 1.1;
  if (op === OP_PLUS) {
    effort += 1.2;
    if ((left % 10) + (right % 10) >= 10) effort += 1.4;
  } else if (op === OP_MINUS) {
    effort += 1.7;
    if (left % 10 < right % 10) effort += 1.6;
  } else if (op === OP_MULT) {
    effort += 3.2 + Math.min(4, Math.log2(Math.max(1, left * right)));
    if (left > 9 && right > 9) effort += 3.5;
  } else if (op === OP_DIV) {
    effort += 3.8 + Math.min(4, Math.log2(Math.max(1, left)));
    if (right > 9 || result > 9) effort += 2.2;
  }

  if (left === 0 || right === 0 || result === 0) effort -= 0.7;
  return Math.max(1, effort);
};

const buildFormulaCatalog = ({ OP_PLUS, OP_MINUS, OP_MULT, OP_DIV, REL_EQ }) => {
  const byLength = new Map();
  const byText = new Map();
  const symbolBits = buildSymbolBits({ OP_PLUS, OP_MINUS, OP_MULT, OP_DIV, REL_EQ });

  const add = (left, op, right, result) => {
    if (!isAllowedNumber(left) || !isAllowedNumber(right) || !isAllowedNumber(result)) return;
    if (!hasSingleDigitNumber(left, right, result)) return;
    if (isTrivialFormula(left, op, right, result, { OP_PLUS, OP_MINUS, OP_MULT, OP_DIV })) return;

    for (const reversed of [false, true]) {
      const tokens = buildFormulaTokens(left, op, right, result, reversed, { REL_EQ });
      const text = tokens.join("");
      if (byText.has(text)) continue;
      const formula = {
        text,
        tokens,
        mathKey: mathKeyFor(left, op, right, result, { OP_PLUS, OP_MINUS, OP_MULT }),
        symbolMask: symbolMaskFor(tokens, symbolBits),
        arithmeticEffort: estimateArithmeticEffort(tokens, {
          OP_PLUS,
          OP_MINUS,
          OP_MULT,
          OP_DIV,
          REL_EQ,
        }),
      };
      byText.set(text, formula);

      const formulas = byLength.get(tokens.length);
      if (formulas) {
        formulas.push(formula);
      } else {
        byLength.set(tokens.length, [formula]);
      }
    }
  };

  for (let left = 0; left <= 99; left++) {
    for (let right = 0; right <= 99; right++) {
      add(left, OP_PLUS, right, left + right);
      if (left >= right) add(left, OP_MINUS, right, left - right);
      add(left, OP_MULT, right, left * right);
    }
  }

  for (let right = 1; right <= 99; right++) {
    for (let result = 0; result <= 99; result++) {
      add(right * result, OP_DIV, right, result);
    }
  }

  for (const formulas of byLength.values()) {
    formulas.sort((left, right) => left.text.localeCompare(right.text));
  }

  return byLength;
};

const buildFormulaOptions = (run, board, bankCounts, catalog) => {
  const formulas = catalog.get(run.keys.length) ?? [];
  const options = [];

  for (const formula of formulas) {
    let matchesGivens = true;
    const assignments = new Map();
    const needed = new Map();

    for (let index = 0; index < run.keys.length; index++) {
      const key = run.keys[index];
      const token = formula.tokens[index];
      const given = board[key];

      if (key === undefined || token === undefined) {
        matchesGivens = false;
        break;
      }

      if (given) {
        if (given.val !== token) {
          matchesGivens = false;
          break;
        }
        continue;
      }

      assignments.set(key, token);
      needed.set(token, mapValue(needed, token) + 1);
    }

    if (!matchesGivens) continue;

    let hasBank = true;
    for (const [value, count] of needed) {
      if (mapValue(bankCounts, value) < count) {
        hasBank = false;
        break;
      }
    }
    if (!hasBank) continue;

    options.push({ text: formula.text, arithmeticEffort: formula.arithmeticEffort, assignments });
  }

  return options;
};

const adjacentKeys = (key) => {
  const [row, col] = parseKey(key);
  return [`${row - 1},${col}`, `${row + 1},${col}`, `${row},${col - 1}`, `${row},${col + 1}`];
};

const countMissingInRange = (keys, range, board) =>
  keys.slice(range[0], range[1]).filter((key) => !board[key]).length;

const calculateLinePatternEffort = (line, board, modules) => {
  const parsed = parseFormulaTokens([...line.text], modules);
  if (!parsed) return 0;

  let effort = parsed.reversed ? 4 : 0;
  for (const range of [parsed.leftRange, parsed.rightRange, parsed.resultRange]) {
    const length = range[1] - range[0];
    const missing = countMissingInRange(line.keys, range, board);
    if (missing === 0) continue;

    if (missing < length) {
      effort += 6 + missing * 2;
    } else if (length > 1) {
      effort += 2 + length * 0.8;
    } else {
      effort += 0.5;
    }
  }

  if (!board[line.keys[parsed.opIndex]]) effort += 5;
  if (!board[line.keys[parsed.relationIndex]]) effort += 3;
  return effort;
};

const calculateVisualEffort = (game, solution, lines, modules) => {
  const solutionKeys = Object.keys(solution);
  const bounds = getBounds(solutionKeys);
  const area = (bounds.maxR - bounds.minR + 1) * (bounds.maxC - bounds.minC + 1);
  let effort = area * 0.7;

  for (const key of solutionKeys) {
    if (game.board[key]) continue;
    const givenNeighbors = adjacentKeys(key).filter((neighbor) => game.board[neighbor]).length;
    effort += givenNeighbors === 0 ? 8 : givenNeighbors === 1 ? 4 : 1.5;
  }

  for (const line of lines) {
    const blanks = line.keys.filter((key) => !game.board[key]).length;
    const givens = line.keys.length - blanks;
    effort += blanks * 1.4 + Math.max(0, 3 - givens) * 3;
    effort += calculateLinePatternEffort(line, game.board, modules);
  }

  return effort;
};

const calculateInitialAmbiguity = (missingKeys, lineOptions, linesByKey, state) => {
  const candidatesByKey = computeCandidates(missingKeys, lineOptions, linesByKey, state);
  const formulaAmbiguity = lineOptions.reduce(
    (total, options) => total + Math.log2(options.length + 1),
    0,
  );
  const slotAmbiguity = [...candidatesByKey.values()].reduce(
    (total, candidates) => total + Math.log2(candidates.length + 1),
    0,
  );
  const crowdedSlots = [...candidatesByKey.values()].filter((candidates) => candidates.length > 3);

  return {
    candidatesByKey,
    effort: formulaAmbiguity * 5 + slotAmbiguity * 3 + crowdedSlots.length * 4,
  };
};

const calculateLineArithmeticEffort = (lines, catalog) =>
  lines.reduce((total, line) => {
    const option = (catalog.get(line.keys.length) ?? []).find(
      (formula) => formula.text === line.text,
    );
    return total + (option?.arithmeticEffort ?? line.text.length);
  }, 0);

const optionCompatible = (option, assignment, remaining) => {
  const needed = new Map();

  for (const [key, value] of option.assignments) {
    const assigned = assignment.get(key);
    if (assigned !== undefined) {
      if (assigned !== value) return false;
      continue;
    }

    needed.set(value, mapValue(needed, value) + 1);
  }

  for (const [value, count] of needed) {
    if (mapValue(remaining, value) < count) return false;
  }

  return true;
};

const assignValue = (state, key, value) => {
  const assigned = state.assignment.get(key);
  if (assigned !== undefined) return assigned === value;

  const count = mapValue(state.remaining, value);
  if (count <= 0) return false;

  state.assignment.set(key, value);
  if (count === 1) {
    state.remaining.delete(value);
  } else {
    state.remaining.set(value, count - 1);
  }
  return true;
};

const cloneState = (state) => ({
  assignment: cloneMap(state.assignment),
  remaining: cloneMap(state.remaining),
});

const buildLineOptions = (formulaOptions, state) =>
  formulaOptions.map((options) =>
    options.filter((option) => optionCompatible(option, state.assignment, state.remaining)),
  );

const computeCandidates = (missingKeys, lineOptions, linesByKey, state) => {
  const candidatesByKey = new Map();

  for (const key of missingKeys) {
    if (state.assignment.has(key)) continue;

    let candidates = new Set(state.remaining.keys());
    const lineIndexes = linesByKey.get(key) ?? [];

    for (const lineIndex of lineIndexes) {
      const allowed = new Set();
      for (const option of lineOptions[lineIndex] ?? []) {
        const value = option.assignments.get(key);
        if (value !== undefined) allowed.add(value);
      }
      candidates = new Set([...candidates].filter((value) => allowed.has(value)));
    }

    candidatesByKey.set(key, [...candidates].sort());
  }

  return candidatesByKey;
};

const propagate = (inputState, context, stats) => {
  const state = cloneState(inputState);
  let changed = true;
  let lineOptions = [];
  let candidatesByKey = new Map();

  while (changed) {
    changed = false;
    lineOptions = buildLineOptions(context.formulaOptions, state);

    if (lineOptions.some((options) => options.length === 0)) {
      return { status: "dead" };
    }

    const unresolved = context.missingKeys.length - state.assignment.size;
    const scanAmbiguity = lineOptions.reduce(
      (total, options) => total + Math.log2(options.length + 1),
      0,
    );
    stats.scanEffort += scanAmbiguity * 1.2 + unresolved * 0.45;

    for (const options of lineOptions) {
      if (options.length !== 1) continue;

      const option = options[0];
      for (const [key, value] of option.assignments) {
        if (state.assignment.has(key)) continue;
        if (!assignValue(state, key, value)) return { status: "dead" };
        stats.forcedByFormula++;
        stats.deductionEffort += 7 + option.arithmeticEffort * 0.7;
        changed = true;
      }
    }

    if (changed) continue;

    candidatesByKey = computeCandidates(
      context.missingKeys,
      lineOptions,
      context.linesByKey,
      state,
    );

    for (const [key, candidates] of candidatesByKey) {
      if (candidates.length === 0) return { status: "dead" };
      if (candidates.length === 1) {
        if (!assignValue(state, key, candidates[0])) return { status: "dead" };
        stats.forcedMoves++;
        stats.deductionEffort += 9;
        changed = true;
      }
    }

    if (changed) continue;

    for (const [value, count] of state.remaining) {
      const slots = [];
      for (const [key, candidates] of candidatesByKey) {
        if (candidates.includes(value)) slots.push(key);
      }

      if (slots.length < count) return { status: "dead" };
      if (slots.length === count) {
        for (const key of slots) {
          if (state.assignment.has(key)) continue;
          if (!assignValue(state, key, value)) return { status: "dead" };
          stats.forcedByBank++;
          stats.deductionEffort += 12 + slots.length;
          changed = true;
        }
      }
    }
  }

  return { status: "alive", state, lineOptions, candidatesByKey };
};

const chooseBranch = (candidatesByKey) => {
  let best = null;

  for (const [key, candidates] of candidatesByKey) {
    if (candidates.length <= 1) continue;
    if (!best || candidates.length < best.candidates.length) best = { key, candidates };
  }

  return best;
};

const createSolveStats = () => ({
  states: 0,
  deadEnds: 0,
  branchDecisions: 0,
  branchOptions: 0,
  maxDepth: 0,
  forcedMoves: 0,
  forcedByFormula: 0,
  forcedByBank: 0,
  scanEffort: 0,
  deductionEffort: 0,
  branchEffort: 0,
});

const countSolutions = (context, cap = 2) => {
  let solutions = 0;
  const initialState = {
    assignment: new Map(),
    remaining: cloneMap(context.bankCounts),
  };

  const recurse = (state) => {
    const reduced = propagate(state, context, createSolveStats());
    if (reduced.status === "dead") return false;

    if (reduced.state.assignment.size === context.missingKeys.length) {
      if ([...reduced.state.remaining.values()].every((count) => count === 0)) solutions++;
      return solutions >= cap;
    }

    const branch = chooseBranch(reduced.candidatesByKey);
    if (!branch) return false;

    for (const value of branch.candidates) {
      const nextState = cloneState(reduced.state);
      if (!assignValue(nextState, branch.key, value)) continue;
      if (recurse(nextState)) return true;
    }

    return false;
  };

  recurse(initialState);
  return solutions;
};

const solveDifficulty = (context) => {
  const stats = createSolveStats();
  const initialState = {
    assignment: new Map(),
    remaining: cloneMap(context.bankCounts),
  };

  const recurse = (state, depth) => {
    stats.states++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    const reduced = propagate(state, context, stats);
    if (reduced.status === "dead") {
      stats.deadEnds++;
      return false;
    }

    if (reduced.state.assignment.size === context.missingKeys.length) {
      return [...reduced.state.remaining.values()].every((count) => count === 0);
    }

    const branch = chooseBranch(reduced.candidatesByKey);
    if (!branch) {
      stats.deadEnds++;
      return false;
    }

    stats.branchDecisions++;
    stats.branchOptions += branch.candidates.length;
    stats.branchEffort += 300 + branch.candidates.length * 100 + depth * 420 + depth ** 2 * 180;

    for (const value of branch.candidates) {
      const nextState = cloneState(reduced.state);
      if (!assignValue(nextState, branch.key, value)) continue;
      if (recurse(nextState, depth + 1)) return true;
    }

    stats.deadEnds++;
    stats.branchEffort += 420;
    return false;
  };

  const solved = recurse(initialState, 0);
  const solutionCount = countSolutions(context);
  const initialOptions = context.formulaOptions.reduce(
    (total, options) => total + options.length,
    0,
  );
  const score = Math.round(
    context.visualEffort * 1.1 +
      context.initialAmbiguityEffort * 0.85 +
      context.solutionArithmeticEffort * 2.2 +
      stats.scanEffort +
      stats.deductionEffort +
      stats.branchEffort +
      stats.states * 8 +
      stats.deadEnds * 45,
  );

  return { solved, solutionCount, initialOptions, score, ...stats };
};

const analyzePuzzle = (stage, game, solution, modules, catalog, prepared = {}) => {
  if (!game || !solution) {
    return { stage, score: Infinity, solved: false, error: "missing generated level" };
  }

  const solutionKeys = prepared.solutionKeys ?? Object.keys(solution);
  const lines = prepared.lines ?? collectFormulaRuns(solution, modules.isValidEquation);
  const missingKeys =
    prepared.missingKeys ?? sortedKeys(solutionKeys.filter((key) => !game.board[key]));
  const bankCounts = makeCounter(game.bank.map((tile) => tile.val));
  const linesByKey = new Map();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    for (const key of lines[lineIndex].keys) {
      if (game.board[key]) continue;
      const indexes = linesByKey.get(key);
      if (indexes) {
        indexes.push(lineIndex);
      } else {
        linesByKey.set(key, [lineIndex]);
      }
    }
  }

  const formulaOptions = lines.map((line) =>
    buildFormulaOptions(line, game.board, bankCounts, catalog),
  );
  const initialState = { assignment: new Map(), remaining: cloneMap(bankCounts) };
  const initialLineOptions = buildLineOptions(formulaOptions, initialState);
  const initialAmbiguity = calculateInitialAmbiguity(
    missingKeys,
    initialLineOptions,
    linesByKey,
    initialState,
  );
  const visualEffort = calculateVisualEffort(game, solution, lines, modules);
  const solutionArithmeticEffort = calculateLineArithmeticEffort(lines, catalog);
  const difficulty = solveDifficulty({
    missingKeys,
    bankCounts,
    linesByKey,
    formulaOptions,
    visualEffort,
    initialAmbiguityEffort: initialAmbiguity.effort,
    solutionArithmeticEffort,
  });
  const boardBounds = getBounds(Object.keys(game.board));
  const solutionBounds = getBounds(solutionKeys);

  return {
    stage,
    score: difficulty.score,
    solved: difficulty.solved,
    solutionCount: difficulty.solutionCount,
    solutionTiles: solutionKeys.length,
    formulas: lines.length,
    missingTiles: missingKeys.length,
    initialOptions: difficulty.initialOptions,
    maxDepth: difficulty.maxDepth,
    branchDecisions: difficulty.branchDecisions,
    branchOptions: difficulty.branchOptions,
    deadEnds: difficulty.deadEnds,
    states: difficulty.states,
    forcedMoves: difficulty.forcedMoves,
    forcedByFormula: difficulty.forcedByFormula,
    forcedByBank: difficulty.forcedByBank,
    scanEffort: Math.round(difficulty.scanEffort),
    deductionEffort: Math.round(difficulty.deductionEffort),
    branchEffort: Math.round(difficulty.branchEffort),
    visualEffort: Math.round(visualEffort),
    initialAmbiguityEffort: Math.round(initialAmbiguity.effort),
    arithmeticEffort: Math.round(solutionArithmeticEffort),
    boardBounds,
    solutionBounds,
  };
};

const analyzeStage = (stage, modules, catalog) =>
  analyzePuzzle(
    stage,
    modules.buildCrossingGame(stage),
    modules.getCrossingLevelSolution(stage),
    modules,
    catalog,
  );

const puzzleSignature = (solution) =>
  sortedKeys(Object.keys(solution))
    .map((key) => `${key}:${solution[key]}`)
    .join("|");

const prepareSpecCandidate = (spec, modules) => {
  const candidate = modules.buildCrossingGameFromSpec(spec);
  if (!candidate) return null;

  const solutionKeys = Object.keys(candidate.solution);
  const missingKeys = sortedKeys(solutionKeys.filter((key) => !candidate.game.board[key]));
  const boardSignature = sortedKeys(Object.keys(candidate.game.board))
    .map((key) => `${key}:${candidate.game.board[key].val}`)
    .join("|");

  return {
    ...candidate,
    solutionKeys,
    missingKeys,
    boardSignature,
    signature: puzzleSignature(candidate.solution),
  };
};

const dedupeCandidates = (candidates) => {
  const bySignature = new Map();
  for (const candidate of candidates) {
    if (bySignature.has(candidate.signature)) continue;
    bySignature.set(candidate.signature, candidate);
  }
  return [...bySignature.values()].sort((left, right) => left.score - right.score);
};

const buildAxisPatterns = (maxOffset) => {
  const preferredRank = new Map(
    [
      [1, 3, 5],
      [0, 2, 4],
      [0, 2, 5],
      [0, 3, 5],
      [1, 3, 4],
      [1, 2, 5],
      [0, 3, 4],
    ].map((pattern, index) => [pattern.join(","), index]),
  );
  const patterns = [];
  for (let first = 0; first <= maxOffset - 2; first++) {
    for (let second = first + 1; second <= maxOffset - 1; second++) {
      for (let third = second + 1; third <= maxOffset; third++) {
        patterns.push([first, second, third]);
      }
    }
  }
  return patterns.sort(
    (left, right) =>
      (preferredRank.get(left.join(",")) ?? Infinity) -
        (preferredRank.get(right.join(",")) ?? Infinity) ||
      left[2] - right[2] ||
      left[0] - right[0] ||
      left[1] - right[1] ||
      left[2] - right[2],
  );
};

const buildLengthTuples = (lengths, count, total) => {
  const tuples = [];
  const current = [];

  const recurse = (remainingCount, remainingTotal) => {
    if (remainingCount === 0) {
      if (remainingTotal === 0) tuples.push([...current]);
      return;
    }

    const minLength = lengths[0] ?? 0;
    const maxLength = lengths.at(-1) ?? 0;
    for (const length of lengths) {
      if (remainingTotal - length < (remainingCount - 1) * minLength) continue;
      if (remainingTotal - length > (remainingCount - 1) * maxLength) continue;
      current.push(length);
      recurse(remainingCount - 1, remainingTotal - length);
      current.pop();
    }
  };

  recurse(count, total);
  return tuples;
};

const orderedTotals = (min, max, preferred) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index).sort(
    (left, right) => Math.abs(left - preferred) - Math.abs(right - preferred) || left - right,
  );

const signatureForOffsets = (formula, offsets) => {
  let signature = "";
  for (const offset of offsets) {
    const token = formula.tokens[offset];
    if (token === undefined) return null;
    signature += token;
  }
  return signature;
};

const buildOffsetIndex = (catalog, offsets) => {
  const index = new Map();
  for (const [length, formulas] of catalog) {
    const bySignature = new Map();
    for (const formula of formulas) {
      const signature = signatureForOffsets(formula, offsets);
      if (signature === null) continue;
      const entries = bySignature.get(signature);
      if (entries) {
        entries.push(formula);
      } else {
        bySignature.set(signature, [formula]);
      }
    }
    index.set(length, bySignature);
  }
  return index;
};

const offsetKey = (offsets) => offsets.join(",");

const getOffsetIndex = (catalog, offsets, cache) => {
  const key = offsetKey(offsets);
  const cached = cache.get(key);
  if (cached) return cached;
  const index = buildOffsetIndex(catalog, offsets);
  cache.set(key, index);
  return index;
};

const buildSolutionFromFormulas = (horizontals, verticals, pattern) => {
  const solution = {};
  const usage = new Map();
  const rowBase = pattern.rows[0];
  const colBase = pattern.cols[0];
  const rowCoords = pattern.rows.map((offset) => offset - rowBase);
  const colCoords = pattern.cols.map((offset) => offset - colBase);

  const placeTile = (key, val) => {
    const existing = solution[key];
    if (existing !== undefined && existing !== val) return false;
    solution[key] = val;
    usage.set(key, mapValue(usage, key) + 1);
    return true;
  };

  for (const [rowIndex, formula] of horizontals.entries()) {
    const row = rowCoords[rowIndex];
    for (const [tokenIndex, token] of formula.tokens.entries()) {
      if (!placeTile(`${row},${tokenIndex - colBase}`, token)) return null;
    }
  }

  for (const [colIndex, formula] of verticals.entries()) {
    const col = colCoords[colIndex];
    for (const [tokenIndex, token] of formula.tokens.entries()) {
      if (!placeTile(`${tokenIndex - rowBase},${col}`, token)) return null;
    }
  }

  let crossingCount = 0;
  for (const count of usage.values()) {
    if (count > 2) return null;
    if (count === 2) crossingCount++;
  }

  return crossingCount === 9 ? solution : null;
};

const canonicalSolutionSignature = (solution) => {
  const keys = Object.keys(solution);
  const bounds = getBounds(keys);
  return sortedKeys(keys)
    .map((key) => {
      const [row, col] = parseKey(key);
      return `${row - bounds.minR},${col - bounds.minC}:${solution[key]}`;
    })
    .join("|");
};

const hasRequiredBankValues = (solution, math) => {
  const counts = makeCounter(Object.values(solution));
  const requiredValues = [
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
    math.OP_PLUS,
    math.OP_MINUS,
    math.OP_MULT,
    math.OP_DIV,
    math.REL_EQ,
    math.REL_EQ,
    math.REL_EQ,
    math.REL_EQ,
  ];

  for (const [value, count] of makeCounter(requiredValues)) {
    if (mapValue(counts, value) < count) return false;
  }
  return true;
};

const requiredSymbolMaskFor = (math) => {
  const symbolBits = buildSymbolBits(math);
  let mask = 0;
  for (const bit of symbolBits.values()) mask |= bit;
  return mask;
};

const formulasSymbolMask = (formulas) =>
  formulas.reduce((mask, formula) => mask | formula.symbolMask, 0);

const collectNumberRuns = (solution) => {
  const keys = Object.keys(solution);
  const bounds = getBounds(keys);
  const runs = [];

  const scan = (outerStart, outerEnd, innerStart, innerEnd, horizontal) => {
    for (let outer = outerStart; outer <= outerEnd; outer++) {
      let run = "";

      for (let inner = innerStart; inner <= innerEnd + 1; inner++) {
        const key = horizontal ? `${outer},${inner}` : `${inner},${outer}`;
        const val = solution[key];

        if (/^\d$/.test(val ?? "")) {
          run += val;
          continue;
        }

        if (run.length > 0) {
          runs.push(run);
          run = "";
        }
      }
    }
  };

  scan(bounds.minR, bounds.maxR, bounds.minC, bounds.maxC, true);
  scan(bounds.minC, bounds.maxC, bounds.minR, bounds.maxR, false);
  return runs;
};

const isValidIntendedSolution = (solution, modules, math) =>
  hasRequiredBankValues(solution, math) &&
  collectNumberRuns(solution).every((value) => value.length <= 2) &&
  collectFormulaRuns(solution, modules.isValidEquation).length === 6;

const createEnumeratedSpec = (pattern, horizontals, verticals, solutionTiles) => ({
  pattern,
  solutionTiles,
  formulas: {
    horizontals: horizontals.map((formula) => formula.text),
    verticals: verticals.map((formula) => formula.text),
  },
});

const removalVariants = [0, 1, 2, 3, 5, 8, 13, 21];

const collectIntendedSolutionSpecs = (
  targetCount,
  modules,
  math,
  catalog,
  { minTiles = MIN_TARGET_SOLUTION_TILES, maxTiles = MAX_CROSSING_SOLUTION_TILE_COUNT } = {},
) => {
  const lengths = [...catalog.keys()].sort((left, right) => left - right);
  const minFormulaLength = lengths[0] ?? 0;
  const maxFormulaLength = lengths.at(-1) ?? 0;
  const minSolutionTiles = Math.max(18, minTiles, minFormulaLength * 6 - 9);
  const maxSolutionTiles = Math.min(MAX_CROSSING_SOLUTION_TILE_COUNT, maxTiles);
  const axisPatterns = buildAxisPatterns(maxFormulaLength - 1);
  const offsetIndexCache = new Map();
  const specs = [];
  const seen = new Set();
  const byTileCount = new Map();
  const requiredSymbolMask = requiredSymbolMaskFor(math);

  for (
    let solutionTiles = minSolutionTiles;
    solutionTiles <= maxSolutionTiles && specs.length < targetCount;
    solutionTiles++
  ) {
    const formulaTotal = solutionTiles + 9;
    traceSearch(`tile ${solutionTiles} start`);

    for (const horizontalTotal of orderedTotals(
      minFormulaLength * 3,
      maxFormulaLength * 3,
      formulaTotal / 2,
    )) {
      const verticalTotal = formulaTotal - horizontalTotal;
      if (verticalTotal < minFormulaLength * 3 || verticalTotal > maxFormulaLength * 3) continue;
      traceSearch(
        `tile ${solutionTiles} totals h=${horizontalTotal} v=${verticalTotal} found=${specs.length}`,
      );

      const horizontalTuples = buildLengthTuples(lengths, 3, horizontalTotal);
      const verticalTuples = buildLengthTuples(lengths, 3, verticalTotal);

      for (const horizontalLengths of horizontalTuples) {
        const colPatterns = axisPatterns.filter(
          (offsets) => offsets[2] < Math.min(...horizontalLengths),
        );

        for (const verticalLengths of verticalTuples) {
          const rowPatterns = axisPatterns.filter(
            (offsets) => offsets[2] < Math.min(...verticalLengths),
          );

          for (const patternCols of colPatterns) {
            const horizontalIndex = getOffsetIndex(catalog, patternCols, offsetIndexCache);
            const horizontalGroups = horizontalLengths.map((length) => [
              ...(horizontalIndex.get(length)?.entries() ?? []),
            ]);
            if (horizontalGroups.some((groups) => groups.length === 0)) continue;

            const possibleRowPatterns = rowPatterns.filter(
              (patternRows) => patternCols[0] > 0 || patternRows[0] > 0,
            );

            for (const [firstSignature, firstGroup] of horizontalGroups[0]) {
              const firstSignatureTokens = [...firstSignature];
              for (const [secondSignature, secondGroup] of horizontalGroups[1]) {
                const secondSignatureTokens = [...secondSignature];
                for (const [thirdSignature, thirdGroup] of horizontalGroups[2]) {
                  const thirdSignatureTokens = [...thirdSignature];
                  const verticalSignatures = [0, 1, 2].map(
                    (index) =>
                      `${firstSignatureTokens[index]}${secondSignatureTokens[index]}${thirdSignatureTokens[index]}`,
                  );

                  for (const patternRows of possibleRowPatterns) {
                    const verticalIndex = getOffsetIndex(catalog, patternRows, offsetIndexCache);
                    const verticalOptions = verticalLengths.map(
                      (length, index) =>
                        verticalIndex.get(length)?.get(verticalSignatures[index]) ?? [],
                    );
                    if (verticalOptions.some((options) => options.length === 0)) continue;
                    const possibleSymbolMask =
                      formulasSymbolMask(firstGroup) |
                      formulasSymbolMask(secondGroup) |
                      formulasSymbolMask(thirdGroup) |
                      formulasSymbolMask(verticalOptions[0]) |
                      formulasSymbolMask(verticalOptions[1]) |
                      formulasSymbolMask(verticalOptions[2]);
                    if ((possibleSymbolMask & requiredSymbolMask) !== requiredSymbolMask) {
                      continue;
                    }

                    for (const firstHorizontal of firstGroup) {
                      const usedAfterFirst = new Set([firstHorizontal.mathKey]);
                      for (const secondHorizontal of secondGroup) {
                        if (usedAfterFirst.has(secondHorizontal.mathKey)) continue;
                        const usedAfterSecond = new Set([
                          ...usedAfterFirst,
                          secondHorizontal.mathKey,
                        ]);
                        for (const thirdHorizontal of thirdGroup) {
                          if (usedAfterSecond.has(thirdHorizontal.mathKey)) continue;
                          const horizontals = [firstHorizontal, secondHorizontal, thirdHorizontal];
                          const usedHorizontal = new Set([
                            ...usedAfterSecond,
                            thirdHorizontal.mathKey,
                          ]);

                          for (const firstVertical of verticalOptions[0]) {
                            if (usedHorizontal.has(firstVertical.mathKey)) continue;
                            const usedAfterV1 = new Set([...usedHorizontal, firstVertical.mathKey]);
                            for (const secondVertical of verticalOptions[1]) {
                              if (usedAfterV1.has(secondVertical.mathKey)) continue;
                              const usedAfterV2 = new Set([...usedAfterV1, secondVertical.mathKey]);
                              for (const thirdVertical of verticalOptions[2]) {
                                if (usedAfterV2.has(thirdVertical.mathKey)) continue;
                                const verticals = [firstVertical, secondVertical, thirdVertical];
                                const actualSymbolMask =
                                  formulasSymbolMask(horizontals) | formulasSymbolMask(verticals);
                                if (
                                  (actualSymbolMask & requiredSymbolMask) !==
                                  requiredSymbolMask
                                ) {
                                  continue;
                                }
                                const pattern = { cols: patternCols, rows: patternRows };
                                const solution = buildSolutionFromFormulas(
                                  horizontals,
                                  verticals,
                                  pattern,
                                );
                                if (!solution || Object.keys(solution).length !== solutionTiles) {
                                  continue;
                                }
                                if (!isValidIntendedSolution(solution, modules, math)) continue;

                                const canonical = canonicalSolutionSignature(solution);
                                if (seen.has(canonical)) continue;
                                seen.add(canonical);
                                const spec = createEnumeratedSpec(
                                  pattern,
                                  horizontals,
                                  verticals,
                                  solutionTiles,
                                );
                                spec.intendedKey = canonical;
                                specs.push(spec);
                                byTileCount.set(
                                  solutionTiles,
                                  mapValue(byTileCount, solutionTiles) + 1,
                                );
                                if (specs.length >= targetCount) break;
                              }
                              if (specs.length >= targetCount) break;
                            }
                            if (specs.length >= targetCount) break;
                          }
                          if (specs.length >= targetCount) break;
                        }
                        if (specs.length >= targetCount) break;
                      }
                      if (specs.length >= targetCount) break;
                    }
                    if (specs.length >= targetCount) break;
                  }
                  if (specs.length >= targetCount) break;
                }
                if (specs.length >= targetCount) break;
              }
              if (specs.length >= targetCount) break;
            }
            if (specs.length >= targetCount) break;
          }
          if (specs.length >= targetCount) break;
        }
        if (specs.length >= targetCount) break;
      }
      if (specs.length >= targetCount) break;
    }
  }

  return {
    specs,
    stats: {
      requested: targetCount,
      minSolutionTiles,
      maxSolutionTiles,
      byTileCount: Object.fromEntries(
        [...byTileCount.entries()].sort(([left], [right]) => left - right),
      ),
    },
  };
};

const collectCandidates = (targetCount, modules, math, catalog, options) => {
  const candidates = [];
  const bySignature = new Map();
  const intended = collectIntendedSolutionSpecs(targetCount, modules, math, catalog, options);

  for (let index = 0; index < intended.specs.length; index++) {
    const spec = intended.specs[index];
    for (const removalVariant of removalVariants) {
      const variantSpec = removalVariant === 0 ? spec : { ...spec, removalVariant };
      const prepared = prepareSpecCandidate(variantSpec, modules);
      if (!prepared) continue;
      const candidateSignature = `${prepared.signature}||${prepared.boardSignature}`;
      if (
        prepared.solutionKeys.length > MAX_CROSSING_SOLUTION_TILE_COUNT ||
        prepared.missingKeys.length !== 18 ||
        bySignature.has(candidateSignature)
      ) {
        continue;
      }

      const lines = collectFormulaRuns(prepared.solution, modules.isValidEquation);
      if (lines.length !== 6) continue;

      const candidate = {
        ...analyzePuzzle(index + 1, prepared.game, prepared.solution, modules, catalog, {
          solutionKeys: prepared.solutionKeys,
          missingKeys: prepared.missingKeys,
          lines,
        }),
        spec: variantSpec,
        intendedKey: spec.intendedKey,
        signature: candidateSignature,
      };
      if (
        !candidate?.solved ||
        candidate.solutionCount !== 1 ||
        candidate.solutionTiles > MAX_CROSSING_SOLUTION_TILE_COUNT ||
        candidate.formulas !== 6 ||
        candidate.missingTiles !== 18
      ) {
        continue;
      }
      bySignature.set(candidate.signature, candidate);
      candidates.push(candidate);
    }
  }

  return { candidates: dedupeCandidates(candidates), intended: intended.stats };
};

const selectExponentialCurve = (candidates) => {
  let best = null;
  const pool = candidates.filter((candidate) => Number.isFinite(candidate.score));
  const targetSolutionTiles = pool
    .map((candidate) => candidate.solutionTiles)
    .sort((left, right) => left - right)
    .slice(0, 9);
  if (targetSolutionTiles.length < 9) return null;
  const targetTileSequences = buildTileSequences(targetSolutionTiles);
  const bySolutionTiles = new Map();

  for (const candidate of pool) {
    const entries = bySolutionTiles.get(candidate.solutionTiles);
    if (entries) {
      entries.push(candidate);
    } else {
      bySolutionTiles.set(candidate.solutionTiles, [candidate]);
    }
  }

  for (const entries of bySolutionTiles.values()) {
    entries.sort((left, right) => left.score - right.score);
  }

  const upperBoundScore = (entries, score) => {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (entries[mid].score <= score) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  };

  const pickClosestCandidate = (solutionTiles, minScore, targetScore, usedIntendedKeys) => {
    const entries = bySolutionTiles.get(solutionTiles) ?? [];
    const minIndex = upperBoundScore(entries, minScore);
    if (minIndex >= entries.length) return null;

    let bestCandidate = null;
    let bestDistance = Infinity;

    for (let index = minIndex; index < entries.length; index++) {
      const candidate = entries[index];
      if (candidate.intendedKey && usedIntendedKeys.has(candidate.intendedKey)) continue;
      const distance = scoreDistance(candidate.score, targetScore);
      if (candidate.score > targetScore && distance > bestDistance) break;
      if (distance < bestDistance) {
        bestCandidate = candidate;
        bestDistance = distance;
      }
    }

    return bestCandidate ? { candidate: bestCandidate, distance: bestDistance } : null;
  };

  for (const tileSequence of targetTileSequences) {
    const firstEntries = bySolutionTiles.get(tileSequence[0]) ?? [];

    for (const firstCandidate of firstEntries) {
      const targets = Array.from(
        { length: 9 },
        (_, index) => firstCandidate.score * TARGET_STEP_RATIO ** index,
      );
      const selected = [firstCandidate];
      const usedIntendedKeys = new Set(
        firstCandidate.intendedKey ? [firstCandidate.intendedKey] : [],
      );
      let minScore = firstCandidate.score;
      let cost = 0;
      let maxDistance = 0;

      for (let index = 1; index < targets.length; index++) {
        const target = targets[index];
        const solutionTiles = tileSequence[index];
        const picked = pickClosestCandidate(solutionTiles, minScore, target, usedIntendedKeys);

        if (!picked || picked.distance > MAX_SCORE_DISTANCE) {
          cost = Infinity;
          break;
        }

        selected.push(picked.candidate);
        if (picked.candidate.intendedKey) usedIntendedKeys.add(picked.candidate.intendedKey);
        minScore = picked.candidate.score;
        cost += picked.distance ** 2;
        maxDistance = Math.max(maxDistance, picked.distance);
      }

      if (selected.length !== 9 || !Number.isFinite(cost)) continue;

      const ratio = selected.at(-1).score / selected[0].score;
      const ratioDistance = scoreDistance(ratio, FINAL_DIFFICULTY_RATIO);
      if (ratioDistance > MAX_SCORE_DISTANCE) continue;

      cost += ratioDistance ** 2 * 100;
      cost += maxDistance ** 2 * 16;

      if (!best || cost < best.cost) {
        best = { cost, targets, selected, ratio, targetSolutionTiles };
      }
    }
  }

  return best;
};

const withAnalysisContext = async (callback) => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "error",
    root: repoRoot,
    server: { hmr: false, middlewareMode: true, ws: false },
    resolve: {
      alias: {
        "@": path.join(repoRoot, "src"),
      },
    },
  });

  try {
    const crossing = await vite.ssrLoadModule("/src/services/board/handcraftedLevels.ts");
    const math = await vite.ssrLoadModule("/src/services/math.ts");
    const catalog = buildFormulaCatalog(math);
    const modules = {
      buildCrossingGame: crossing.buildCrossingGame,
      buildCrossingGameFromSpec: crossing.buildCrossingGameFromSpec,
      getCrossingLevelSolution: crossing.getCrossingLevelSolution,
      isValidEquation: math.isValidEquation,
    };
    return await callback({ crossing, modules, math, catalog });
  } finally {
    await vite.close();
  }
};

export const rankCrossingDifficulty = async ({ searchCount = 0, minTiles, maxTiles } = {}) =>
  withAnalysisContext(async ({ crossing, modules, math, catalog }) => {
    const results = [];
    for (let stage = 1; stage <= crossing.CROSSING_LEVEL_COUNT; stage++) {
      results.push(analyzeStage(stage, modules, catalog));
    }

    const ranked = [...results].sort(
      (left, right) =>
        left.score - right.score ||
        left.maxDepth - right.maxDepth ||
        left.branchDecisions - right.branchDecisions ||
        left.stage - right.stage,
    );

    const report = { ranked, original: results };
    if (searchCount > 0) {
      const search = collectCandidates(searchCount, modules, math, catalog, { minTiles, maxTiles });
      const candidates = search.candidates;
      const curve = selectExponentialCurve(candidates);
      report.search = {
        searched: searchCount,
        intended: search.intended,
        candidates: candidates.length,
        minScore: candidates[0]?.score ?? null,
        maxScore: candidates.at(-1)?.score ?? null,
        solutionTiles: Object.fromEntries(
          [...makeCounter(candidates.map((candidate) => candidate.solutionTiles)).entries()].sort(
            ([left], [right]) => Number(left) - Number(right),
          ),
        ),
        hardest: candidates.slice(-5),
        curve,
      };
    }

    return report;
  });

const formatReport = (report, jsonOutput) => {
  if (jsonOutput) return `${JSON.stringify(report, null, 2)}\n`;

  const lines = [
    "Crossing difficulty ranking (easy -> hard)",
    "rank stage score depth branches states deadEnds forced options solutions",
  ];
  report.ranked.forEach((result, index) => {
    const forced = result.forcedMoves + result.forcedByFormula + result.forcedByBank;
    lines.push(
      `${index + 1} ${result.stage} ${result.score} ${result.maxDepth} ${result.branchDecisions} ${result.states} ${result.deadEnds} ${forced} ${result.initialOptions} ${result.solutionCount}`,
    );
  });
  const firstScore = report.ranked[0]?.score ?? 0;
  const lastScore = report.ranked.at(-1)?.score ?? 0;
  lines.push(`final/first ratio: ${(lastScore / firstScore).toFixed(2)}x`);
  lines.push(`recommended stage order: ${report.ranked.map((result) => result.stage).join(", ")}`);
  if (report.search) {
    lines.push("");
    lines.push(
      `intended search: ${report.search.intended.byTileCount ? JSON.stringify(report.search.intended.byTileCount) : "{}"} from ${report.search.intended.minSolutionTiles} to ${report.search.intended.maxSolutionTiles}`,
    );
    lines.push(
      `candidate search: ${report.search.candidates}/${report.search.searched} valid${report.search.curve ? `, final/first ${report.search.curve.ratio.toFixed(2)}x` : ", no complete curve"}`,
    );
    lines.push(`candidate tiles: ${JSON.stringify(report.search.solutionTiles)}`);
  }
  if (report.search?.curve) {
    lines.push("curve stage score target tiles givens variant pattern formulas");
    report.search.curve.selected.forEach((result, index) => {
      const target = report.search.curve.targets[index];
      lines.push(
        `${index + 1} ${result.score} ${Math.round(target)} ${result.solutionTiles} ${result.solutionTiles - result.missingTiles} ${result.spec.removalVariant ?? 0} cols=${result.spec.pattern.cols.join("-")} rows=${result.spec.pattern.rows.join("-")} h=${result.spec.formulas?.horizontals.join(";")} v=${result.spec.formulas?.verticals.join(";")}`,
      );
    });
    lines.push("replacement levelSpecs:");
    report.search.curve.selected.forEach((result) => {
      const removalVariant =
        result.spec.removalVariant === undefined
          ? ""
          : `, removalVariant: ${result.spec.removalVariant}`;
      lines.push(
        `  { pattern: { cols: [${result.spec.pattern.cols.join(", ")}], rows: [${result.spec.pattern.rows.join(", ")}] }, solutionTiles: ${result.solutionTiles}${removalVariant}, formulas: { horizontals: [${result.spec.formulas?.horizontals.map((text) => `"${text}"`).join(", ")}], verticals: [${result.spec.formulas?.verticals.map((text) => `"${text}"`).join(", ")}] } },`,
      );
    });
  }
  return `${lines.join("\n")}\n`;
};

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const searchArg = process.argv.find((arg) => arg.startsWith("--search="));
  const searchCount = searchArg ? Number(searchArg.slice("--search=".length)) : 0;
  const minTilesArg = process.argv.find((arg) => arg.startsWith("--min-tiles="));
  const maxTilesArg = process.argv.find((arg) => arg.startsWith("--max-tiles="));
  const minTiles = minTilesArg ? Number(minTilesArg.slice("--min-tiles=".length)) : undefined;
  const maxTiles = maxTilesArg ? Number(maxTilesArg.slice("--max-tiles=".length)) : undefined;
  const report = await rankCrossingDifficulty({ searchCount, minTiles, maxTiles });
  process.stdout.write(formatReport(report, process.argv.includes("--json")));
}
