/** input caps, checked before any parsing work (see docs/design.md §9) */
export const LIMITS = {
  maxChars: 20_000,
  maxRows: 500,
  maxCell: 40,
  maxMeta: 120,
  maxExpandedRows: 1_000,
} as const
