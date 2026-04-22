import { describe, expect, it } from 'vitest'

import { LevelService } from './LevelService'

describe('LevelService', () => {
  it('should load a static level', () => {
    const level = LevelService.getLevel(0)
    expect(level.id).toBe(1)
    expect(level.displayTitle).toBe('Tutorial 1')
  })

  it('should generate a procedural level for high indices', () => {
    const level = LevelService.getLevel(100)
    expect(level.id).toBe(101)
    expect(level.layout).toBeDefined()
  })

  it('should create an initial grid from a level with blocks', () => {
    const level = LevelService.getLevel(2) // Level 3 has blocks
    const grid = LevelService.createInitialGrid(level)
    expect(grid.some((c) => c.type === 'block')).toBe(true)
    expect(grid.some((c) => c.type === 'empty')).toBe(true)
  })
})
