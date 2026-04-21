import { GridCell, TileItem } from '../domain/types';

const KEYS = {
    PROGRESS: 'mathScrabbleProgress',
    CURRENT_PLAY: 'mathScrabble_current_play',
    DAILY_SAVE: (date: string) => `mathScrabble_save_daily_${date}`,
};

export const StorageService = {
    getMaxProgress: (): number => {
        return parseInt(localStorage.getItem(KEYS.PROGRESS) || '0', 10);
    },

    setMaxProgress: (level: number) => {
        localStorage.setItem(KEYS.PROGRESS, level.toString());
    },

    getCurrentPlay: () => {
        const saved = localStorage.getItem(KEYS.CURRENT_PLAY);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    },

    setCurrentPlay: (state: { levelIndex: number; grid: GridCell[]; inventory: TileItem[]; isLevelCleared: boolean; isNewClear: boolean }) => {
        localStorage.setItem(KEYS.CURRENT_PLAY, JSON.stringify(state));
    },

    removeCurrentPlay: () => {
        localStorage.removeItem(KEYS.CURRENT_PLAY);
    },

    getDailySave: (date: string) => {
        const saved = localStorage.getItem(KEYS.DAILY_SAVE(date));
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    },

    setDailySave: (date: string, state: any) => {
        localStorage.setItem(KEYS.DAILY_SAVE(date), JSON.stringify(state));
    }
};
