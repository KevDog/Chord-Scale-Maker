/** small helpers shared across the engine */

/** fn's result, or null if it throws: for display code that shows what it can rather than failing */
export function orNull<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/** split into runs of n (n is clamped to a whole number of at least 1) */
export function chunk<T>(xs: readonly T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n) || 1)
  return Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, i * size + size))
}
