import type { AxisRange } from '../models/viewState'

export type DragAxis = 'x' | 'y'

/** Return the physical extent represented by regularly spaced pixel centers. */
export function fullAxisRange(size: number, spacing: number): AxisRange {
  return { min: 0, max: Math.max(0, size - 1) * spacing }
}

/** Clamp a range to an available extent while preserving its span where possible. */
export function clampAxisRange(range: AxisRange, full: AxisRange, minSpan: number): AxisRange {
  const fullSpan = full.max - full.min
  const span = Math.min(fullSpan, Math.max(minSpan, range.max - range.min))
  let min = range.min
  if (min < full.min) min = full.min
  if (min + span > full.max) min = full.max - span
  return { min, max: min + span }
}

/** Zoom a range around an anchor expressed as a fraction from its left edge. */
export function zoomAxisRange(
  range: AxisRange,
  anchorFraction: number,
  factor: number,
  full: AxisRange,
  minSpan: number,
): AxisRange {
  const anchor = Math.max(0, Math.min(1, anchorFraction))
  const span = (range.max - range.min) * factor
  const anchorValue = range.min + (range.max - range.min) * anchor
  return clampAxisRange(
    { min: anchorValue - span * anchor, max: anchorValue + span * (1 - anchor) },
    full,
    minSpan,
  )
}

/** Pan by a fraction of the visible span; positive fractions move toward larger values. */
export function panAxisRange(
  range: AxisRange,
  deltaFraction: number,
  full: AxisRange,
  minSpan: number,
): AxisRange {
  const delta = (range.max - range.min) * deltaFraction
  return clampAxisRange(
    { min: range.min + delta, max: range.max + delta },
    full,
    minSpan,
  )
}

/** Convert common time units to seconds per pixel; unknown units are not guessed. */
export function secondsPerPixel(spacing: number, unit: string): number | null {
  const normalized = unit.trim().toLowerCase()
  const factors: Record<string, number> = {
    s: 1,
    sec: 1,
    second: 1,
    seconds: 1,
    ms: 1e-3,
    millisecond: 1e-3,
    milliseconds: 1e-3,
    us: 1e-6,
    'µs': 1e-6,
    microsecond: 1e-6,
    microseconds: 1e-6,
  }
  const factor = factors[normalized]
  return factor === undefined ? null : spacing * factor
}

/** Choose and lock the dominant drag direction after a minimum movement. */
export function dominantDragAxis(
  deltaX: number,
  deltaY: number,
  threshold = 6,
): DragAxis | null {
  const x = Math.abs(deltaX)
  const y = Math.abs(deltaY)
  if (Math.max(x, y) < threshold) return null
  return x >= y ? 'x' : 'y'
}

/** Convert a screen-space drag selection into a range within the visible axis. */
export function selectedAxisRange(
  visible: AxisRange,
  start: number,
  end: number,
  screenLength: number,
  minSpan: number,
): AxisRange | null {
  if (screenLength <= 0 || Math.abs(end - start) < 6) return null
  const lower = Math.max(0, Math.min(screenLength, Math.min(start, end))) / screenLength
  const upper = Math.max(0, Math.min(screenLength, Math.max(start, end))) / screenLength
  const span = visible.max - visible.min
  const selected = {
    min: visible.min + span * lower,
    max: visible.min + span * upper,
  }
  return selected.max - selected.min >= minSpan ? selected : null
}
