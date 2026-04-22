import { describe, expect, it } from 'vitest'

import { generateEquationString, getProceduralLevel } from './procedural'

describe('procedural level generation', () => {
  it('should generate levels of increasing complexity', () => {
    const level1 = getProceduralLevel(0)
    getProceduralLevel(19)
    const level100 = getProceduralLevel(99)

    expect(level1.id).toBe(1)
    expect(level100.id).toBe(100)
    expect(level100.inventory.length).toBeGreaterThan(level1.inventory.length)
  })

  it('should cover all operators in equation generation', () => {
    const opsFound = new Set<string>()
    // Run many times to hit all random branches
    for (let i = 0; i < 500; i++) {
      const eq = generateEquationString(i + 1)
      if (eq.includes('+')) opsFound.add('+')
      if (eq.includes('−')) opsFound.add('−')
      if (eq.includes('×')) opsFound.add('×')
      if (eq.includes('÷')) opsFound.add('÷')
      if (opsFound.size === 4) break
    }
    expect(opsFound.has('+')).toBe(true)
    expect(opsFound.has('−')).toBe(true)
    expect(opsFound.has('×')).toBe(true)
    expect(opsFound.has('÷')).toBe(true)
  })

  it('should cover advanced comparators', () => {
    const compsFound = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const eq = generateEquationString(50) // High level for advanced
      if (eq.includes('<') && !eq.includes('<>')) compsFound.add('<')
      if (eq.includes('>')) compsFound.add('>')
      if (eq.includes('<>')) compsFound.add('<>')
      if (compsFound.size === 3) break
    }
    expect(compsFound.size).toBe(3)
  })

  it('should generate high level with many words', () => {
    const level = getProceduralLevel(150)
    expect(level.inventory.length).toBeGreaterThan(20)
  })

  it('should handle edge case level indices', () => {
    expect(getProceduralLevel(0).id).toBe(1)
    expect(getProceduralLevel(-1).id).toBe(0)
    expect(getProceduralLevel(1000).id).toBe(1001)
  })

  it('should hit more branches with high iterations', () => {
    for (let i = 0; i < 10000; i++) {
      generateEquationString(i % 100)
    }
  })
})
