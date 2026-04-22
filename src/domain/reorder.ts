/**
 * Reorders an array by moving an item from one index to another.
 * This implementation ensures that the item ends up at the specified target index,
 * handling the internal array shift correctly.
 *
 * @param array The original array (not mutated)
 * @param from The source index
 * @param to The target index
 * @returns A new array with the item moved
 */
export const reorder = <T>(array: T[], from: number, to: number): T[] => {
  if (from === to) return [...array]

  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    console.warn(
      `reorder: indices must be integers. Received from=${from}, to=${to}`
    )
    return [...array]
  }

  if (from < 0 || from >= array.length) {
    console.warn(
      `reorder: source index 'from' (${from}) is out of bounds [0, ${array.length - 1}]`
    )
    return [...array]
  }

  const result = Array.from(array)
  const [removed] = result.splice(from, 1)

  // After removing one element, the valid insertion range is [0, result.length]
  const clampedTo = Math.max(0, Math.min(to, result.length))

  if (to !== clampedTo) {
    console.warn(
      `reorder: target index 'to' (${to}) was clamped to ${clampedTo}`
    )
  }

  result.splice(clampedTo, 0, removed)
  return result
}
