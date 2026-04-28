import { OP_DIV, OP_MINUS, OP_MULT, OP_PLUS, REL_EQ, REL_GT, REL_LT } from "@/services/math";

type Cell = {
  val: string;
  type: "val" | "op" | "rel";
};

export interface Grid {
  [key: string]: Cell;
}

export type Bounds = {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
};

export type EquationUsage = {
  horizontal: Set<string>;
  vertical: Set<string>;
};

export type Direction = {
  dx: number;
  dy: number;
};

type BoardLikeCell = { val: string };
export type BoardLike = Record<string, BoardLikeCell | undefined>;

export const getKey = (r: number, c: number) => `${r},${c}`;

export const parseKey = (key: string): [number, number] => {
  const [r = "0", c = "0"] = key.split(",");
  return [Number(r), Number(c)];
};

export const getGridBounds = (keys: string[]): Bounds => {
  let minR = Number.POSITIVE_INFINITY;
  let maxR = Number.NEGATIVE_INFINITY;
  let minC = Number.POSITIVE_INFINITY;
  let maxC = Number.NEGATIVE_INFINITY;
  for (const key of keys) {
    const [r, c] = parseKey(key);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }
  return { minR, maxR, minC, maxC };
};

export const getCellType = (char: string): Cell["type"] => {
  if (char === OP_PLUS || char === OP_MINUS || char === OP_MULT || char === OP_DIV) return "op";
  if (char === REL_EQ || char === REL_LT || char === REL_GT) return "rel";
  return "val";
};

export const shuffleInPlace = <T>(items: T[], prng: () => number) => {
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

export const pickRandomKeys = (keys: string[], count: number, prng: () => number) =>
  new Set(shuffleInPlace([...keys], prng).slice(0, count));

export const forEachEquation = (
  keys: string[],
  getTile: (key: string) => { val: string } | undefined,
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
    for (let outer = outerStart; outer <= outerEnd; outer++) {
      let word: { val: string; key: string }[] = [];
      for (let inner = innerStart; inner <= innerEnd + 1; inner++) {
        const key = isHoriz ? getKey(outer, inner) : getKey(inner, outer);
        const tile = getTile(key);
        if (tile) {
          word.push({ ...tile, key });
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

  if (scan(minR, maxR, minC, maxC, true) === false) return;
  scan(minC, maxC, minR, maxR, false);
};
