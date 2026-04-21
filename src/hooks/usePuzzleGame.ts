import { useCallback, useEffect, useReducer } from 'react'

import { validateGrid } from '@/domain/grid'
import { DragItem, GridCell, HoverTarget, Level, TileItem } from '@/domain/types'
import { LevelService } from '@/services/LevelService'
import { StorageService } from '@/services/StorageService'

interface GameState {
  levelIndex: number;
  maxProgress: number;
  currentLevelData: Level | null;
  grid: GridCell[];
  inventory: TileItem[];
  isLevelCleared: boolean;
  isNewClear: boolean;
}

type Action =
  | {
    type: 'LOAD_LEVEL';
    index: number
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
    type: 'MOVE_TILE';
    grid: GridCell[];
    inventory: TileItem[];
    isCleared: boolean;
    isNewClear: boolean
  } |
  {
    type: 'SET_CLEARED';
    isCleared: boolean;
    isNewClear: boolean;
    maxProgress: number
  } |
  { type: 'RESET_LEVEL' }

const getInitialState = (idx: number): GameState => {
  const level = LevelService.getLevel(idx)
  const saved = StorageService.getCurrentPlay()
  const maxProgress = StorageService.getMaxProgress()

  if (saved && saved.levelIndex === idx) {
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
      id: i,
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
      return getInitialState(action.index)
    case 'SET_GRID':
      return {
        ...state,
        grid: action.grid
      }
    case 'SET_INVENTORY':
      return {
        ...state,
        inventory: action.inventory
      }
    case 'MOVE_TILE':
      return {
        ...state,
        grid: action.grid,
        inventory: action.inventory
      }
    case 'SET_CLEARED':
      return {
        ...state,
        isLevelCleared: action.isCleared,
        isNewClear: action.isNewClear,
        maxProgress: action.maxProgress
      }
    case 'RESET_LEVEL':
      return getInitialState(state.levelIndex)
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
export const usePuzzleGame = (showToast: (msg: string, type?: string) => void) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const saved = StorageService.getCurrentPlay()
    return getInitialState(saved ? saved.levelIndex : StorageService.getMaxProgress())
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
    dispatch({
      type: 'LOAD_LEVEL',
      index
    })
  }, [])

  const setIsNewClear = useCallback((val: boolean) => {
    // This is a bit of a hack to keep the API similar, but ideally we'd have a more specific action
    dispatch({
      type: 'MOVE_TILE',
      grid,
      inventory,
      isCleared: isLevelCleared,
      isNewClear: val
    })
  }, [grid, inventory, isLevelCleared])

  const checkFullAndVerify = useCallback((currentGrid: GridCell[]) => {
    if (!currentLevelData) return
    const isFull = currentGrid.every(c => c.type === 'block' || c.char !== null)
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
  }, [currentLevelData, levelIndex, maxProgress, showToast])

  const handleReturnToInventory = useCallback((item: DragItem) => {
    if (item.source !== 'grid' || item.index === undefined) return
    const newGrid = [...grid]
    const char = newGrid[item.index].char
    if (!char) return
    newGrid[item.index] = {
      ...newGrid[item.index],
      char: null
    }
    dispatch({
      type: 'SET_GRID',
      grid: newGrid
    })
    dispatch({
      type: 'SET_INVENTORY',
      inventory: [...inventory, {
        id: Date.now(),
        char
      }]
    })
  }, [grid, inventory])

  const handleDrop = useCallback((item: DragItem, target: HoverTarget | null) => {
    if (!target) return

    if (target.type === 'inventory') {
      handleReturnToInventory(item)
      return
    }

    if (target.type !== 'grid' || target.index === undefined) return

    const cell = grid[target.index]
    if (cell.type === 'block') return

    if (item.source === 'inventory') {
      const newInventory = [...inventory]
      const invIdx = newInventory.findIndex(t => t.char === item.char)
      const [movedTile] = newInventory.splice(invIdx, 1)

      const newGrid = [...grid]
      if (cell.char !== null) {
        newInventory.push({
          id: Date.now(),
          char: cell.char
        })
      }
      newGrid[target.index] = {
        ...cell,
        char: movedTile.char
      }
      dispatch({
        type: 'SET_GRID',
        grid: newGrid
      })
      dispatch({
        type: 'SET_INVENTORY',
        inventory: newInventory
      })
      checkFullAndVerify(newGrid)
    } else if (item.source === 'grid' && item.index !== undefined) {
      const newGrid = [...grid]
      const sourceChar = newGrid[item.index].char
      newGrid[item.index] = {
        ...newGrid[item.index],
        char: cell.char
      }
      newGrid[target.index] = {
        ...cell,
        char: sourceChar
      }
      dispatch({
        type: 'SET_GRID',
        grid: newGrid
      })
      checkFullAndVerify(newGrid)
    }
  }, [grid, inventory, checkFullAndVerify, handleReturnToInventory])

  const handleQuickClick = useCallback((item: DragItem) => {
    if (item.source === 'inventory') {
      const firstEmpty = grid.findIndex(c => c.type !== 'block' && c.char === null)
      if (firstEmpty !== -1) {
        handleDrop(item, {
          type: 'grid',
          index: firstEmpty
        })
      }
    } else if (item.source === 'grid') {
      handleReturnToInventory(item)
    }
  }, [grid, handleDrop, handleReturnToInventory])

  const resetLevel = useCallback(() => {
    StorageService.removeCurrentPlay()
    dispatch({ type: 'RESET_LEVEL' })
  }, [])

  // Lifecycle
  useEffect(() => {
    if (!currentLevelData) return
    if (currentLevelData.id !== levelIndex + 1) return

    const isGridEmpty = grid.every(cell => !cell.char)
    if (!isGridEmpty && !isLevelCleared) {
      StorageService.setCurrentPlay({
        levelIndex,
        grid,
        inventory,
        isLevelCleared
      })
    } else {
      const saved = StorageService.getCurrentPlay()
      if (saved && saved.levelIndex === levelIndex) {
        StorageService.removeCurrentPlay()
      }
    }
  }, [grid, inventory, isLevelCleared, isNewClear, levelIndex, currentLevelData])

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
