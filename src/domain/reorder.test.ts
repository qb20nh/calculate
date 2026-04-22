import { describe, expect, it, vi } from 'vitest'

import { reorder } from './reorder'

describe('reorder', () => {
  const initial = ['A', 'B', 'C', 'D']

  it('moves item forward (0 -> 2)', () => {
    // A B C D -> B C A D (A is at index 2)
    const result = reorder(initial, 0, 2)
    expect(result).toEqual(['B', 'C', 'A', 'D'])
    expect(result[2]).toBe('A')
  })

  it('moves item backward (3 -> 1)', () => {
    // A B C D -> A D B C (D is at index 1)
    const result = reorder(initial, 3, 1)
    expect(result).toEqual(['A', 'D', 'B', 'C'])
    expect(result[1]).toBe('D')
  })

  it('handles moving to the end of the array', () => {
    const result = reorder(initial, 0, 3)
    expect(result).toEqual(['B', 'C', 'D', 'A'])
    expect(result[3]).toBe('A')
  })

  it('returns a shallow copy when from === to', () => {
    const result = reorder(initial, 1, 1)
    expect(result).toEqual(initial)
    expect(result).not.toBe(initial)
  })

  it('handles out-of-bounds from index with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = reorder(initial, 10, 1)
    expect(result).toEqual(initial)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("source index 'from' (10) is out of bounds")
    )
    warnSpy.mockRestore()
  })

  it('clamps out-of-bounds to index and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A B C D -> B C D A (clamped to 3)
    const result = reorder(initial, 0, 10)
    expect(result).toEqual(['B', 'C', 'D', 'A'])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("target index 'to' (10) was clamped to 3")
    )
    warnSpy.mockRestore()
  })

  it('handles non-integer indices and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = reorder(initial, 1.5, 2)
    expect(result).toEqual(initial)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('indices must be integers')
    )
    warnSpy.mockRestore()
  })
})
