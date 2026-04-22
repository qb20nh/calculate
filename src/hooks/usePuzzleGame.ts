import { useCallback, useEffect, useReducer } from 'react'

import { validateGrid } from '@/domain/grid'
import {
  DragItem,
  GridCell,
  HoverTarget,
  Level,
  TileItem
} from '@/domain/types'
import { LevelService } from '@/services/LevelService'
import { SavedPlayState, StorageService } from '@/services/StorageService'

interface GameState {
  levelIndex: number
  maxProgress: number
  currentLevelData: Level | null
  grid: GridCell[]
  inventory: TileItem[]
  isLevelCleared: boolean
  isNewClear: boolean
}

type Action =
  | {
    type: 'LOAD_LEVEL';
    index: number;
    saved?: SavedPlayState | null;
    maxProgress: number
  } |
  {
    type: 'SET_GRID';
    grid: GridCell[]
  } |
  {
    type: 'SET_INVENTORY';
    inventory: TileItem[]
  } |
  {
    type: 'DROP_ON_GRID';
    item: DragItem;
    targetIndex: number
  } |
  {
    type: 'DROP_ON_INVENTORY';
    item: DragItem
  } |
  {
    type: 'SET_CLEARED'
    isCleared: boolean
    isNewClear: boolean
    maxProgress: number
  } |
  { type: 'RESET_LEVEL' } |
  {
    type: 'SET_NEW_CLEAR';
    val: boolean
  }

const getInitialStateFromData = (
  idx: number,
  saved: SavedPlayState | null | undefined,
  maxProgress: number
): GameState => {
  const level = LevelService.getLevel(idx)

  if (saved?.levelIndex === idx) {
    return {
      levelIndex: idx,
      maxProgress,
      grid: saved.grid,
      inventory: saved.inventory,
      isLevelCleared: saved.isLevelCleared || false,
      isNewClear: false,
      currentLevelData: level
    }
  }

  return {
    levelIndex: idx,
    maxProgress,
    grid: LevelService.createInitialGrid(level),
    inventory: level.inventory.map((char, i) => ({
      id: `${idx}-${i}-${Date.now()}`,
      char
    })),
    isLevelCleared: false,
    isNewClear: false,
    currentLevelData: level
  }
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'LOAD_LEVEL':
      return getInitialStateFromData(action.index, action.saved, action.maxProgress)

    case 'DROP_ON_GRID': {
      const { item, targetIndex } = action
      const cell = state.grid[targetIndex]
      if (cell.type === 'block') return state

      const newGrid = [...state.grid]
      let newInventory = [...state.inventory]

      if (item.source === 'inventory' || item.source === 'pool') {
        const invIdx = newInventory.findIndex((t) => t.char === item.char)
        if (invIdx === -1) return state
        const [movedTile] = newInventory.splice(invIdx, 1)

        if (cell.char !== null) {
          newInventory = [...newInventory, {
            id: `returned-${Date.now()}`,
            char: cell.char
          }]
        }
        newGrid[targetIndex] = {
          ...cell,
          char: movedTile.char
        }
      } else if (item.source === 'grid' && item.index !== undefined) {
        const sourceChar = state.grid[item.index].char
        newGrid[item.index] = {
          ...newGrid[item.index],
          char: cell.char
        }
        newGrid[targetIndex] = {
          ...cell,
          char: sourceChar
        }
      }
      return {
        ...state,
        grid: newGrid,
        inventory: newInventory
      }
    }

    case 'DROP_ON_INVENTORY': {
      const { item } = action
      if (item.source !== 'grid' || item.index === undefined) return state
      const char = state.grid[item.index].char
      if (!char) return state

      const newGrid = [...state.grid]
      newGrid[item.index] = {
        ...newGrid[item.index],
        char: null
      }
      const newInventory = [...state.inventory, {
        id: `returned-${Date.now()}`,
        char
      }]
      return {
        ...state,
        grid: newGrid,
        inventory: newInventory
      }
    }

    case 'SET_CLEARED':
      return {
        ...state,
        isLevelCleared: action.isCleared,
        isNewClear: action.isNewClear,
        maxProgress: action.maxProgress
      }

    case 'SET_NEW_CLEAR':
      return {
        ...state,
        isNewClear: action.val
      }

    case 'RESET_LEVEL': {
      return {
        ...state,
        grid: LevelService.createInitialGrid(state.currentLevelData!),
        inventory: state.currentLevelData!.inventory.map((char, i) => ({
          id: `${state.levelIndex}-${i}-${Date.now()}`,
          char
        })),
        isLevelCleared: false,
        isNewClear: false
      }
    }
    default:
      return state
  }
}

/**
 * Main game hook for managing puzzle state, including grid interactions,
 * inventory management, level progression, and persistence.
 *
 * @param showToast Function to display feedback toasts to the user
 * @returns Game state and action handlers
 */
export const usePuzzleGame = (
  showToast: (msg: string, type?: string) => void
) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const saved = StorageService.getCurrentPlay()
    const maxProgress = StorageService.getMaxProgress()
    return getInitialStateFromData(
      saved ? saved.levelIndex : maxProgress,
      saved,
      maxProgress
    )
  })

  const {
    levelIndex,
    maxProgress,
    currentLevelData,
    grid,
    inventory,
    isLevelCleared,
    isNewClear
  } = state

  // Actions
  const setLevelIndex = useCallback((index: number) => {
    const saved = StorageService.getCurrentPlay()
    const maxProgress = StorageService.getMaxProgress()
    dispatch({
      type: 'LOAD_LEVEL',
      index,
      saved,
      maxProgress
    })
  }, [dispatch])

  const setIsNewClear = useCallback(
    (val: boolean) => {
      dispatch({
        type: 'SET_NEW_CLEAR',
        val
      })
    },
    [dispatch]
  )

  const checkFullAndVerify = useCallback(
    (currentGrid: GridCell[]) => {
      if (!currentLevelData) return
      const isFull = currentGrid.every(
        (c) => c.type === 'block' || c.char !== null
      )
      if (isFull) {
        const result = validateGrid(currentGrid, currentLevelData.cols)
        if (result.valid) {
          showToast('Brilliant! Stage Clear.', 'success')
          const nextMax = Math.max(levelIndex + 1, maxProgress)
          StorageService.setMaxProgress(nextMax)
          dispatch({
            type: 'SET_CLEARED',
            isCleared: true,
            isNewClear: true,
            maxProgress: nextMax
          })
        } else {
          showToast(result.reason || 'Invalid statements.', 'error')
        }
      }
    },
    [currentLevelData, levelIndex, maxProgress, showToast, dispatch]
  )

  const handleReturnToInventory = useCallback(
    (item: DragItem) => {
      dispatch({
        type: 'DROP_ON_INVENTORY',
        item
      })
    },
    [dispatch]
  )

  const handleDrop = useCallback(
    (item: DragItem, target: HoverTarget | null) => {
      if (!target) return

      if (target.type === 'inventory') {
        handleReturnToInventory(item)
        return
      }

      if (target.type !== 'grid' || target.index === undefined) return

      dispatch({
        type: 'DROP_ON_GRID',
        item,
        targetIndex: target.index
      })
    },
    [dispatch, handleReturnToInventory]
  )

  // Watch for grid changes to trigger verification
  useEffect(() => {
    checkFullAndVerify(grid)
  }, [grid, checkFullAndVerify])

  const handleQuickClick = useCallback(
    (item: DragItem) => {
      if (item.source === 'inventory') {
        const firstEmpty = grid.findIndex(
          (c) => c.type !== 'block' && c.char === null
        )
        if (firstEmpty !== -1) {
          handleDrop(item, {
            type: 'grid',
            index: firstEmpty
          })
        }
      } else if (item.source === 'grid') {
        handleReturnToInventory(item)
      }
    },
    [grid, handleDrop, handleReturnToInventory]
  )

  const resetLevel = useCallback(() => {
    StorageService.removeCurrentPlay()
    dispatch({ type: 'RESET_LEVEL' })
  }, [dispatch])

  // Lifecycle
  // Persist to storage
  useEffect(() => {
    if (!currentLevelData) return
    if (currentLevelData.id !== levelIndex + 1) return

    const isGridEmpty = grid.every((cell) => !cell.char)
    if (!isGridEmpty && !isLevelCleared) {
      StorageService.setCurrentPlay({
        levelIndex,
        grid,
        inventory,
        isLevelCleared
      })
    } else {
      const saved = StorageService.getCurrentPlay()
      if (saved?.levelIndex === levelIndex) {
        StorageService.removeCurrentPlay()
      }
    }
  }, [
    grid,
    inventory,
    isLevelCleared,
    levelIndex,
    currentLevelData
  ])

  return {
    levelIndex,
    setLevelIndex,
    maxProgress,
    currentLevelData,
    grid,
    inventory,
    isLevelCleared,
    isNewClear,
    setIsNewClear,
    resetLevel,
    handleDrop,
    handleReturnToInventory,
    handleQuickClick
  }
}
