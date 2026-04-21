import { GridCell, TileItem } from '../domain/types';

const KEYS = {
    PROGRESS: 'mathScrabbleProgress',
    CURRENT_PLAY: 'mathScrabble_current_play',
    DAILY_SAVE: (date: string) => `mathScrabble_save_daily_${date}`,
};

const getParsed = (key: string) => {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch {
        return null;
    }
};

export const StorageService = {
    getMaxProgress: (): number => {
        return parseInt(localStorage.getItem(KEYS.PROGRESS) || '0', 10);
    },

    setMaxProgress: (level: number) => {
        localStorage.setItem(KEYS.PROGRESS, level.toString());
    },

    getCurrentPlay: () => getParsed(KEYS.CURRENT_PLAY),

    setCurrentPlay: (state: { levelIndex: number; grid: GridCell[]; inventory: TileItem[]; isLevelCleared: boolean; isNewClear: boolean }) => {
        localStorage.setItem(KEYS.CURRENT_PLAY, JSON.stringify(state));
    },

    removeCurrentPlay: () => {
        localStorage.removeItem(KEYS.CURRENT_PLAY);
    },

    getDailySave: (date: string) => getParsed(KEYS.DAILY_SAVE(date)),

    setDailySave: (date: string, state: unknown) => {
        localStorage.setItem(KEYS.DAILY_SAVE(date), JSON.stringify(state));
    }
};
