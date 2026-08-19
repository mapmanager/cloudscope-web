/** Clamp a split position so both panes retain their configured minimum size. */
export function clampSplitSize(
  requested: number,
  available: number,
  minimumPrimary: number,
  minimumSecondary: number,
): number {
  const maximum = Math.max(minimumPrimary, available - minimumSecondary)
  return Math.min(maximum, Math.max(minimumPrimary, requested))
}
