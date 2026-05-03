import { getBoardGeometry } from "@/services/board";
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
  const geometry = getBoardGeometry(board);
  const { minR, maxR, minC, maxC } = geometry.layoutBounds;

  return {
    fringe: geometry.fringe,
    minR,
    maxR,
    minC,
    maxC,
    cols: geometry.cols,
    rows: geometry.rows,
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
