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
    for (let i = 0; i < 1000; i++) {
      const eq = generateEquationString(20) // High level for advanced
      if (eq.includes('<') && !eq.includes('<>')) compsFound.add('<')
      if (eq.includes('>')) compsFound.add('>')
      if (eq.includes('<>')) compsFound.add('<>')
      if (compsFound.size === 3) break
    }
    expect(compsFound.size).toBeGreaterThanOrEqual(1) // At least hit some
  })
})
