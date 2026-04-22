import { describe, expect, it } from 'vitest'

import { extractWordsFromGrid, validateGrid } from './grid'
import { GridCell } from './types'

describe('grid logic', () => {
  const emptyCell: GridCell = {
    id: 'empty',
    type: 'empty',
    char: null
  }
  const blockCell: GridCell = {
    id: 'block',
    type: 'block',
    char: null
  }

  const createGrid = (str: string): GridCell[] => {
    return str.split('').map((char, i) => {
      if (char === ' ') {
        return {
          ...emptyCell,
          id: `cell-${i}`
        }
      }
      if (char === '#') {
        return {
          ...blockCell,
          id: `cell-${i}`
        }
      }
      return {
        id: `cell-${i}`,
        type: 'empty',
        char
      }
    })
  }

  it('should extract horizontal words', () => {
    const grid = createGrid('1+2=3#####')
    const words = extractWordsFromGrid(grid, 5)
    expect(words).toContain('1+2=3')
  })

  it('should extract vertical words', () => {
    const grid = createGrid('1#+#2#=#3#')
    const words = extractWordsFromGrid(grid, 2)
    expect(words).toContain('1+2=3')
  })

  it('should extract multiple words in one line separated by blocks', () => {
    const grid = createGrid('1+1=2#2+2=4')
    const words = extractWordsFromGrid(grid, 11)
    expect(words).toContain('1+1=2')
    expect(words).toContain('2+2=4')
  })

  it('should validate a correct grid', () => {
    const grid = createGrid('1+2=3')
    const result = validateGrid(grid, 5)
    expect(result.valid).toBe(true)
  })

  it('should fail an empty grid', () => {
    const grid: GridCell[] = [emptyCell, emptyCell]
    const result = validateGrid(grid, 2)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('No statements formed.')
  })

  it('should fail a grid with an invalid equation', () => {
    const grid = createGrid('1+1=3')
    const result = validateGrid(grid, 5)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Mathematically false')
  })
})
