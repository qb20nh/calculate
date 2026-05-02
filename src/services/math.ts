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
const REL_NEQ = `${REL_LT}${REL_GT}`;

const ASCII_PLUS = "+";
const ASCII_MINUS = "-";
const ASCII_MULT = "*";
const ASCII_DIV = "/";

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
        ? base > 0
          ? base - randInt(prng, 1, base)
          : base + randInt(prng, 1, 9) // Fallback if base is 0: change to LT-like logic or re-roll
        : (() => {
            let res = base;
            while (res === base) {
              res =
                prng() > 0.5
                  ? base + randInt(prng, 1, 9)
                  : Math.max(0, base - randInt(prng, 1, Math.max(1, base + 9)));
            }
            return res;
          })();

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

  let left: number;
  let op: string;
  let right: number;
  let result: number;

  if (opIndex === 0) {
    op = OP_PLUS;
    left = randInt(prng, 0, 20);
    right = randInt(prng, 0, 20);
    result = left + right;
  } else if (opIndex === 1) {
    op = OP_MINUS;
    right = randInt(prng, 0, 20);
    result = randInt(prng, 0, 20);
    left = result + right;
  } else if (opIndex === 2) {
    op = OP_MULT;
    left = randInt(prng, 0, 20);
    // Limit right to keep product < 100
    const maxRight = left === 0 ? 20 : Math.min(20, Math.floor(90 / left));
    right = randInt(prng, 0, maxRight);
    result = left * right;
  } else {
    op = OP_DIV;
    right = randInt(prng, 1, 20);
    // Limit result to keep left (divisor * result) < 100
    const maxResult = Math.min(20, Math.floor(99 / right));
    // Constraint: two operands cannot be both double digit for division.
    // If right >= 10, allow special cases N/N=1 and 2N/N=2.
    if (right >= 10) {
      // So if right >= 10, result must be 1 (N/N=1) or 2 (2N/N=2).
      // left is then right or 2*right, both potentially two-digit values.
      result = randInt(prng, 0, 2);
    } else {
      result = randInt(prng, 0, maxResult);
    }
    left = right * result;
  }

  const baseValue = result;
  if (rel === REL_GT && baseValue === 0) {
    rel = REL_LT;
  }
  const finalResult = applyRelation(baseValue, rel, prng);

  return buildStatement(left, op, right, rel, finalResult);
};

export const evaluateExpression = (str: string) => {
  if (str.length === 0) return null;

  // Map Unicode symbols to standard ASCII operators for evaluation
  const normalized = str
    .replaceAll(OP_MINUS, ASCII_MINUS)
    .replaceAll(OP_MULT, ASCII_MULT)
    .replaceAll(OP_DIV, ASCII_DIV);

  if (!/^[0-9+\-*/]+$/.test(normalized)) return null;

  const tokens: Array<number | string> = [];
  let sign = 1;
  let expectNumber = true;
  for (let i = 0; i < normalized.length; ) {
    const ch = normalized.charAt(i);
    if (ch === "") return null;

    if (ch >= "0" && ch <= "9") {
      let end = i + 1;
      while (end < normalized.length) {
        const next = normalized.charAt(end);
        if (next < "0" || next > "9") break;
        end++;
      }

      const raw = normalized.slice(i, end);
      if ((raw.length > 1 && raw.startsWith("0")) || (/^0\d+/.test(raw) && expectNumber)) {
        return null;
      }

      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      tokens.push(sign * value);
      sign = 1;
      expectNumber = false;
      i = end;
      continue;
    }

    if (ch === ASCII_PLUS) {
      if (expectNumber) return null;
      tokens.push(ASCII_PLUS);
      expectNumber = true;
      i++;
      continue;
    }

    if (ch === ASCII_MINUS) {
      if (expectNumber) {
        sign *= -1;
        i++;
        continue;
      }
      tokens.push(ASCII_MINUS);
      expectNumber = true;
      i++;
      continue;
    }

    if (ch === ASCII_MULT || ch === ASCII_DIV) {
      if (expectNumber) return null;
      tokens.push(ch);
      expectNumber = true;
      i++;
    }
  }

  if (expectNumber) return null;

  const values: number[] = [];
  const ops: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === undefined) return null;
    if (t === ASCII_MULT || t === ASCII_DIV) {
      const left = values.pop();
      if (left === undefined) return null;
      const rightToken = tokens[++i];
      if (rightToken === undefined) return null;
      const right = Number(rightToken);
      if (!Number.isFinite(right)) return null;
      if (t === ASCII_MULT) {
        values.push(left * right);
      } else {
        if (right === 0) return null;
        if (left % right !== 0) return null;
        values.push(left / right);
      }
    } else if (t === ASCII_PLUS || t === ASCII_MINUS) {
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
    if (op === ASCII_PLUS) res += right;
    if (op === ASCII_MINUS) res -= right;
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

  const hasOp = tokens.some(
    (t) => t === OP_PLUS || t === OP_MINUS || t === OP_MULT || t === OP_DIV,
  );
  if (!hasOp) return false;

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
