import { SORT_ORDER } from '../constants/gameData';
import { TileItem } from '../types/game';

export const getGroupedTiles = (tilesArray: TileItem[]): { char: string; count: number }[] => {
    const counts: Record<string, number> = {};
    tilesArray.forEach(t => counts[t.char] = (counts[t.char] || 0) + 1);
    return Object.keys(counts)
        .sort((a, b) => {
            let idxA = SORT_ORDER.indexOf(a);
            let idxB = SORT_ORDER.indexOf(b);
            if (idxA === -1) idxA = 99;
            if (idxB === -1) idxB = 99;
            return idxA - idxB;
        })
        .map(char => ({ char, count: counts[char] }));
};
