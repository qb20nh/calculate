// --- PRNG & Hashing ---
export const getHashSeed = (str: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x85ebca77);
    h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
  }

  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16;
  h2 ^= h1 >>> 16;

  const hash53 = 2097152 * (h2 >>> 0) + (h1 >>> 11);
  return (Math.trunc(hash53 / 4294967296) ^ (hash53 >>> 0)) >>> 0;
};

export function xoshiro128pp(seed: number) {
  let s0 = seed >>> 0;
  let s1 = Math.imul(s0, 0x6d2b79f5) >>> 0;
  let s2 = Math.imul(s1, 0x6d2b79f5) >>> 0;
  let s3 = Math.imul(s2, 0x6d2b79f5) >>> 0;

  return () => {
    const result = ((((s0 + s3) << 7) | ((s0 + s3) >>> 25)) + s0) >>> 0;
    const t = s1 << 9;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;

    s2 ^= t;
    s3 = (s3 << 11) | (s3 >>> 21);

    return result / 4294967296;
  };
}

// --- Math Symbols ---
export const OP_PLUS = "+";
export const OP_MINUS = "−"; // U+2212
export const OP_MULT = "×"; // U+00D7
export const OP_DIV = "÷"; // U+00F7

export const REL_EQ = "=";
export const REL_LT = "<";
export const REL_GT = ">";
const REL_NEQ = "<>";

// --- Math Logic Helpers ---
const randInt = (prng: () => number, min: number, max: number) =>
  min + Math.floor(prng() * (max - min + 1));

const buildStatement = (left: number, op: string, right: number, rel: string, result: number) => [
  ...String(left).split(""),
  op,
  ...String(right).split(""),
  ...(rel === REL_NEQ ? [REL_LT, REL_GT] : [rel]),
  ...String(result).split(""),
];

const applyRelation = (base: number, rel: string, prng: () => number): number =>
  rel === REL_EQ
    ? base
    : rel === REL_LT
      ? base + randInt(prng, 1, 9)
      : rel === REL_GT
        ? Math.max(0, base - randInt(prng, 1, Math.max(1, base - 1)))
        : prng() > 0.5
          ? base + randInt(prng, 1, 9)
          : Math.max(0, base - randInt(prng, 1, Math.max(1, base)));

export const generateValidStatement = (prng: () => number) => {
  const opIndex = Math.floor(prng() * 4);
  const relRoll = prng();

  let rel = REL_EQ;
  if (relRoll > 0.75) {
    if (relRoll > 0.91)
      rel = REL_NEQ; // Special case for not-equals formed by < and >
    else if (relRoll > 0.83) rel = REL_GT;
    else rel = REL_LT;
  }

  if (opIndex === 0) {
    const left = randInt(prng, 1, 9);
    const right = randInt(prng, 1, 9);
    return buildStatement(left, OP_PLUS, right, rel, applyRelation(left + right, rel, prng));
  }

  if (opIndex === 1) {
    const right = randInt(prng, 1, 9);
    const result = randInt(prng, 1, 9);
    const left = result + right;
    return buildStatement(left, OP_MINUS, right, rel, applyRelation(result, rel, prng));
  }

  if (opIndex === 2) {
    const left = randInt(prng, 2, 9);
    const right = randInt(prng, 2, 9);
    const result = left * right;
    return buildStatement(left, OP_MULT, right, rel, applyRelation(result, rel, prng));
  }

  const right = randInt(prng, 2, 9);
  const result = randInt(prng, 2, 9);
  const left = right * result;
  return buildStatement(left, OP_DIV, right, rel, applyRelation(result, rel, prng));
};

export const evaluateExpression = (str: string) => {
  if (str.length === 0) return null;

  // Map Unicode symbols to standard ASCII operators for evaluation
  const normalized = str.replaceAll(OP_MINUS, "-").replaceAll(OP_MULT, "*").replaceAll(OP_DIV, "/");

  if (/[+\-*/]{2,}/.test(normalized)) return null;
  if (/^[+\-*/]/.test(normalized)) return null;
  if (/[+\-*/]$/.test(normalized)) return null;
  if (!/^[0-9+\-*/]+$/.test(normalized)) return null;
  if (/(^|[+\-*/])0\d+/.test(normalized)) return null;

  const tokens = normalized.match(/\d+|[+\-*/]/g);
  if (!tokens) return null;

  const values: number[] = [];
  const ops: Array<"+" | "-"> = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) return null;
    if (t === "*" || t === "/") {
      const left = values.pop();
      if (left === undefined) return null;
      const rightToken = tokens[++i];
      if (!rightToken) return null;
      const right = Number(rightToken);
      if (!Number.isFinite(right)) return null;
      if (t === "*") {
        values.push(left * right);
      } else {
        if (right === 0) return null;
        if (left % right !== 0) return null;
        values.push(left / right);
      }
    } else if (t === "+" || t === "-") {
      ops.push(t);
    } else {
      const value = Number(t);
      if (!Number.isFinite(value)) return null;
      values.push(value);
    }
  }

  const first = values[0];
  if (first === undefined) return null;
  let res = first;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const right = values[i + 1];
    if (right === undefined) return null;
    if (op === "+") res += right;
    if (op === "-") res -= right;
  }

  if (!Number.isFinite(res)) return null;
  return res;
};

export interface TileData {
  val: string;
  type: "val" | "op" | "rel";
  isGiven?: boolean;
  id: string;
}

export const isValidEquation = (wordTiles: { val: string }[]) => {
  const tokens = wordTiles.map((t) => t.val);

  let relType: string | null = null;
  let relStart = -1;
  let relEnd = -1;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) return false;
    if (t === REL_EQ || t === REL_LT || t === REL_GT) {
      if (relType !== null) {
        if (relType === REL_LT && t === REL_GT && i === relEnd + 1) {
          relType = REL_NEQ;
          relEnd = i;
          continue;
        }
        return false;
      }
      relType = t;
      relStart = i;
      relEnd = i;
    }
  }

  if (relType === null) return false;
  if (relStart === 0 || relEnd === tokens.length - 1) return false;

  const leftSide = tokens.slice(0, relStart).join("");
  const rightSide = tokens.slice(relEnd + 1).join("");

  const leftVal = evaluateExpression(leftSide);
  const rightVal = evaluateExpression(rightSide);

  if (leftVal === null || rightVal === null) return false;
  if (relType === REL_EQ) return Math.abs(leftVal - rightVal) < 0.0001;
  if (relType === REL_LT) return leftVal < rightVal;
  if (relType === REL_GT) return leftVal > rightVal;

  return Math.abs(leftVal - rightVal) >= 0.0001;
};
