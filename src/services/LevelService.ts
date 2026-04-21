import { LEVELS } from '@/constants/gameData'
import { getProceduralLevel } from '@/domain/procedural'
import { GridCell, Level } from '@/domain/types'

export const LevelService = {
  getLevel: (index: number): Level => {
    if (index < LEVELS.length) {
      return LEVELS[index]
    }
    return getProceduralLevel(index)
  },

  createInitialGrid: (level: Level): GridCell[] => {
    return level.layout.map((typeCode, i) => ({
      id: `cell-${i}`,
      type: typeCode === 1 ? 'block' : 'empty',
      char: null
    }))
  }
}
