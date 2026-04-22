import { isValidEquation } from './engine'
import { GridCell, ValidationResult } from './types'

const scanLines = (
  outerLimit: number,
  innerLimit: number,
  getCell: (outer: number, inner: number) => GridCell
): string[] => {
  const words: string[] = []
  for (let o = 0; o < outerLimit; o++) {
    let currentStr = ''
    for (let i = 0; i < innerLimit; i++) {
      const cell = getCell(o, i)
      if (cell.type !== 'block' && cell.char) {
        currentStr += cell.char
      } else {
        if (currentStr.length > 1) words.push(currentStr)
        currentStr = ''
      }
    }
    if (currentStr.length > 1) words.push(currentStr)
  }
  return words
}

export const extractWordsFromGrid = (
  grid: GridCell[],
  cols: number
): string[] => {
  const rows = grid.length / cols
  return [
    ...scanLines(rows, cols, (r, c) => grid[r * cols + c]), // Horizontal
    ...scanLines(cols, rows, (c, r) => grid[r * cols + c]) // Vertical
  ]
}

export const validateGrid = (
  grid: GridCell[],
  cols: number
): ValidationResult => {
  const words = extractWordsFromGrid(grid, cols)

  if (words.length === 0) {
    return {
      valid: false,
      reason: 'No statements formed.'
    }
  }

  for (const word of words) {
    const res = isValidEquation(word)
    if (!res.valid) return res
  }

  return { valid: true }
}
