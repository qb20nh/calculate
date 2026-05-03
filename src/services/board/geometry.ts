import {
  type BoardLike,
  type Bounds,
  getGridBounds,
  getKey,
  parseKey,
} from "@/services/board/grid";

type BoardGeometry = {
  fringe: Set<string>;
  layoutBounds: Bounds;
  occupiedBounds: Bounds | null;
  rows: number;
  cols: number;
};

const EMPTY_BOUNDS: Bounds = { minR: 0, maxR: 0, minC: 0, maxC: 0 };

const expandBounds = (bounds: Bounds, padding: number): Bounds => ({
  minR: bounds.minR - padding,
  maxR: bounds.maxR + padding,
  minC: bounds.minC - padding,
  maxC: bounds.maxC + padding,
});

export const getBoardGeometry = (board: BoardLike): BoardGeometry => {
  const placedKeys = Object.keys(board).filter((key) => board[key]);
  const fringe = new Set<string>();

  for (const key of placedKeys) {
    const [r, c] = parseKey(key);
    const neighbors = [getKey(r + 1, c), getKey(r - 1, c), getKey(r, c + 1), getKey(r, c - 1)];
    for (const nextKey of neighbors) {
      if (!board[nextKey]) fringe.add(nextKey);
    }
  }

  const allRelevantKeys = [...placedKeys, ...fringe];
  if (allRelevantKeys.length === 0) {
    return {
      fringe,
      layoutBounds: EMPTY_BOUNDS,
      occupiedBounds: null,
      rows: 1,
      cols: 1,
    };
  }

  const layoutBounds = expandBounds(getGridBounds(allRelevantKeys), 1);
  const occupiedBounds = getGridBounds(placedKeys);

  return {
    fringe,
    layoutBounds,
    occupiedBounds,
    rows: layoutBounds.maxR - layoutBounds.minR + 1,
    cols: layoutBounds.maxC - layoutBounds.minC + 1,
  };
};
