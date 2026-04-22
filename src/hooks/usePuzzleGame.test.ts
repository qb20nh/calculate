import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragItem, HoverTarget } from '@/domain/types'
import { LevelService } from '@/services/LevelService'
import { StorageService } from '@/services/StorageService'

import { usePuzzleGame } from './usePuzzleGame'

// Mock dependencies
vi.mock('@/services/StorageService', () => ({
  StorageService: {
    getCurrentPlay: vi.fn(),
    getMaxProgress: vi.fn(() => 0),
    setMaxProgress: vi.fn(),
    setCurrentPlay: vi.fn(),
    removeCurrentPlay: vi.fn()
  }
}))

vi.mock('@/services/LevelService', () => ({
  LevelService: {
    getLevel: vi.fn((idx: number) => ({
      id: idx + 1,
      displayTitle: `Level ${idx + 1}`,
      displaySubtitle: 'Subtitle',
      rows: 1,
      cols: 5,
      layout: [0, 0, 0, 0, 0],
      inventory: ['1', '+', '2', '=', '3'],
      description: 'Desc'
    })),
    createInitialGrid: vi.fn(() => Array.from({ length: 5 }, (_, i) => ({
      id: `0-${i}`,
      type: 'empty',
      char: null
    })))
  }
}))

describe('usePuzzleGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(StorageService.getCurrentPlay).mockReturnValue(null)
    vi.mocked(StorageService.getMaxProgress).mockReturnValue(0)
  })
  const setup = () => {
    const showToast = vi.fn()
    const utils = renderHook(() => usePuzzleGame(showToast))
    return {
      ...utils,
      showToast
    }
  }

  const drop = (result: { current: ReturnType<typeof usePuzzleGame> }, source: DragItem, target: HoverTarget) => {
    act(() => {
      result.current.handleDrop(source, target)
    })
  }

  const quickClick = (result: { current: ReturnType<typeof usePuzzleGame> }, item: DragItem) => {
    act(() => {
      result.current.handleQuickClick(item)
    })
  }

  const fillGrid = (result: { current: ReturnType<typeof usePuzzleGame> }, chars: string[]) => {
    chars.forEach((char, index) => {
      drop(result, {
        source: 'inventory',
        char
      }, {
        type: 'grid',
        index
      })
    })
  }

  it('should handle dragging a tile from inventory to grid', () => {
    const { result } = setup()
    drop(result, {
      source: 'inventory',
      char: '1'
    }, {
      type: 'grid',
      index: 0
    })
    expect(result.current.grid[0].char).toBe('1')
    expect(result.current.inventory).toHaveLength(4)
  })

  it('should handle swapping tiles on the grid', () => {
    const { result } = setup()
    fillGrid(result, ['1', '+'])
    expect(result.current.grid[0].char).toBe('1')
    expect(result.current.grid[1].char).toBe('+')

    drop(result, {
      source: 'grid',
      char: '1',
      index: 0
    }, {
      type: 'grid',
      index: 1
    })
    expect(result.current.grid[0].char).toBe('+')
    expect(result.current.grid[1].char).toBe('1')

    // Drop on same index
    drop(result, {
      source: 'grid',
      char: '+',
      index: 0
    }, {
      type: 'grid',
      index: 0
    })
    expect(result.current.grid[0].char).toBe('+')
  })

  it('should handle returning a tile to inventory', () => {
    const { result } = setup()
    drop(result, {
      source: 'inventory',
      char: '2'
    }, {
      type: 'grid',
      index: 1
    })
    act(() => {
      result.current.handleReturnToInventory({
        source: 'grid',
        char: '2',
        index: 1
      })
    })
    expect(result.current.grid[1].char).toBe(null)
    expect(result.current.inventory).toHaveLength(5)
  })

  it('should handle setLevelIndex', () => {
    const { result } = setup()
    act(() => { result.current.setLevelIndex(1) })
    expect(result.current.levelIndex).toBe(1)
    // Hit the "return state" branch
    act(() => { result.current.setLevelIndex(1) })
    expect(result.current.levelIndex).toBe(1)
  })

  it('should handle setIsNewClear', () => {
    const { result } = setup()
    act(() => { result.current.setIsNewClear(true) })
    expect(result.current.isNewClear).toBe(true)
    act(() => { result.current.setIsNewClear(false) })
    expect(result.current.isNewClear).toBe(false)
  })

  it('should handle quick click to move tile from inventory to grid', () => {
    const { result } = setup()
    quickClick(result, {
      source: 'inventory',
      char: '1'
    })
    expect(result.current.grid[0].char).toBe('1')
  })

  it('should handle resetting the level', () => {
    const { result } = setup()
    quickClick(result, {
      source: 'inventory',
      char: '2'
    })
    act(() => { result.current.resetLevel() })
    expect(result.current.grid[0].char).toBe(null)
  })

  it('should handle quick click on empty grid cell', () => {
    const { result } = setup()
    // Grid cell 0 is empty by default
    quickClick(result, {
      source: 'grid',
      char: null as unknown as string,
      index: 0
    })
    expect(result.current.grid[0].char).toBe(null)
  })

  it('should handle clearing the level', () => {
    const { result, showToast } = setup()
    fillGrid(result, ['1', '+', '2', '=', '3'])
    expect(showToast).toHaveBeenCalledWith('Brilliant! Stage Clear.', 'success')
  })

  it('should show error toast on invalid full grid', () => {
    const { result, showToast } = setup()
    // 3+2=1 is invalid
    fillGrid(result, ['3', '+', '2', '=', '1'])
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Mathematically false'), 'error')
  })

  it('should load from saved state if available', () => {
    vi.mocked(StorageService.getCurrentPlay).mockReturnValueOnce({
      levelIndex: 0,
      grid: Array.from({ length: 5 }, (_, i) => ({
        id: `0-${i}`,
        type: 'empty' as const,
        char: i === 0 ? '9' : null
      })),
      inventory: [],
      isLevelCleared: false
    })
    const { result } = setup()
    expect(result.current.grid[0].char).toBe('9')
  })

  it('should return char to inventory when dropping on non-empty cell', async () => {
    const { result } = setup()
    drop(result, {
      source: 'inventory',
      char: '1'
    }, {
      type: 'grid',
      index: 0
    })
    await waitFor(() => expect(result.current.grid[0].char).toBe('1'))

    drop(result, {
      source: 'inventory',
      char: '+'
    }, {
      type: 'grid',
      index: 1
    })
    await waitFor(() => expect(result.current.grid[1].char).toBe('+'))
    expect(result.current.inventory.some(t => t.char === '2')).toBe(true)
  })

  it('should remove current play from storage when grid is cleared', async () => {
    vi.mocked(StorageService.getCurrentPlay).mockReturnValue({
      levelIndex: 0,
      grid: Array.from({ length: 5 }, (_, i) => ({
        id: `0-${i}`,
        type: 'empty' as const,
        char: i === 4 ? '3' : null
      })),
      inventory: [],
      isLevelCleared: false
    })
    const { result } = setup()

    // Clear the grid
    act(() => { result.current.resetLevel() })

    // The effect should trigger removeCurrentPlay
    await waitFor(() => expect(StorageService.removeCurrentPlay).toHaveBeenCalled())
  })

  it('should not allow dropping on a block cell', () => {
    vi.mocked(LevelService.createInitialGrid).mockReturnValueOnce([
      {
        id: '0-0',
        type: 'empty',
        char: null
      },
      {
        id: '0-1',
        type: 'block',
        char: null
      },
      {
        id: '0-2',
        type: 'empty',
        char: null
      },
      {
        id: '0-3',
        type: 'empty',
        char: null
      },
      {
        id: '0-4',
        type: 'empty',
        char: null
      }
    ])
    const { result } = setup()
    drop(result, {
      source: 'inventory',
      char: '8'
    }, {
      type: 'grid',
      index: 1
    })
    expect(result.current.grid[1].char).toBe(null)
  })

  it('should handle dropping on inventory target', () => {
    const { result } = setup()
    drop(result, {
      source: 'inventory',
      char: '3'
    }, {
      type: 'grid',
      index: 4
    })
    drop(result, {
      source: 'grid',
      char: '3',
      index: 4
    }, { type: 'inventory' })
    expect(result.current.grid[4].char).toBe(null)
  })

  it('should handle quick click from grid to inventory', () => {
    const { result } = setup()
    act(() => {
      result.current.handleDrop({
        source: 'inventory',
        char: '1'
      }, {
        type: 'grid',
        index: 0
      })
    })
    act(() => {
      result.current.handleQuickClick({
        source: 'grid',
        char: '1',
        index: 0
      })
    })
    expect(result.current.grid[0].char).toBe(null)
  })
})
