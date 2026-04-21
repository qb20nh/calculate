import { GridCell, TileItem } from '../domain/types'

interface SavedPlayState {
  levelIndex: number;
  grid: GridCell[];
  inventory: TileItem[];
  isLevelCleared: boolean;
  isNewClear: boolean;
}

interface SavedDailyState {
  dailyPool: TileItem[];
  dailyCurrent: TileItem[];
  dailySubmitted: string[];
  dailyKnownRelations: string[];
}

const KEYS = {
  PROGRESS: 'mathScrabbleProgress',
  CURRENT_PLAY: 'mathScrabble_current_play',
  DAILY_SAVE: (date: string) => `mathScrabble_save_daily_${date}`,
}

const getParsed = <T>(key: string): T | null => {
  const saved = localStorage.getItem(key)
  if (!saved) return null
  try {
    return JSON.parse(saved) as T
  } catch {
    return null
  }
}

export const StorageService = {
  getMaxProgress: (): number => {
    return parseInt(localStorage.getItem(KEYS.PROGRESS) || '0', 10)
  },

  setMaxProgress: (level: number) => {
    localStorage.setItem(KEYS.PROGRESS, level.toString())
  },

  getCurrentPlay: (): SavedPlayState | null => getParsed<SavedPlayState>(KEYS.CURRENT_PLAY),

  setCurrentPlay: (state: SavedPlayState) => {
    localStorage.setItem(KEYS.CURRENT_PLAY, JSON.stringify(state))
  },

  removeCurrentPlay: () => {
    localStorage.removeItem(KEYS.CURRENT_PLAY)
  },

  getDailySave: (date: string): SavedDailyState | null => getParsed<SavedDailyState>(KEYS.DAILY_SAVE(date)),

  setDailySave: (date: string, state: SavedDailyState) => {
    localStorage.setItem(KEYS.DAILY_SAVE(date), JSON.stringify(state))
  }
}
