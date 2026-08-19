/** Clamp an independently resizable section to its configured height bounds. */
export function clampSectionHeight(requested: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, requested))
}
