import { getGridBounds } from "@/services/board";
import type { TileData } from "@/services/math";
import type { GameState } from "@/services/storage";

export const TILE_SIZE = 44;

type BoardLayout = {
  fringe: Set<string>;
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
  rows: number;
  cols: number;
};

export type BankGroup = {
  val: string;
  type: TileData["type"];
  tiles: TileData[];
};

export const sortTiles = (tiles: TileData[]) =>
  tiles.sort((a, b) => {
    const w = (tile: TileData) => (tile.type === "val" ? 1 : tile.type === "op" ? 2 : 3);
    if (w(a) !== w(b)) return w(a) - w(b);
    return String(a.val).localeCompare(String(b.val));
  });

export const getBoardLayout = (board: GameState["board"]): BoardLayout => {
  const fringe = new Set<string>();
  for (const key of Object.keys(board)) {
    const [rStr, cStr] = key.split(",");
    const r = Number(rStr);
    const c = Number(cStr);
    const neighbors = [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ];
    for (const [nr, nc] of neighbors) {
      const nextKey = `${nr},${nc}`;
      if (!board[nextKey]) fringe.add(nextKey);
    }
  }

  const allRelevantKeys = [...Object.keys(board), ...Array.from(fringe)];
  if (allRelevantKeys.length === 0) {
    return { fringe, minR: 0, maxR: 0, minC: 0, maxC: 0, cols: 1, rows: 1 };
  }

  const bounds = getGridBounds(allRelevantKeys);
  const minR = bounds.minR - 1;
  const maxR = bounds.maxR + 1;
  const minC = bounds.minC - 1;
  const maxC = bounds.maxC + 1;

  return {
    fringe,
    minR,
    maxR,
    minC,
    maxC,
    cols: maxC - minC + 1,
    rows: maxR - minR + 1,
  };
};

export const groupBankTiles = (bank: TileData[]): BankGroup[] => {
  const groups: BankGroup[] = [];
  const groupMap: Record<string, BankGroup> = {};
  for (const tile of bank) {
    const group = groupMap[tile.val];
    if (group) {
      group.tiles.push(tile);
    } else {
      const nextGroup = { val: tile.val, type: tile.type, tiles: [tile] };
      groupMap[tile.val] = nextGroup;
      groups.push(nextGroup);
    }
  }
  return groups;
};
