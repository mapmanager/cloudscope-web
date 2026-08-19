import type { AxisRange } from '../models/viewState'

export interface AxisTick {
  position: number
  value: number
  label: string
}

function precision(span: number): number {
  if (span >= 100) return 0
  if (span >= 10) return 1
  if (span >= 1) return 2
  return 3
}

/** Build evenly spaced, compact display ticks for a visible numeric range. */
export function axisTicks(range: AxisRange, count = 5, reverse = false): AxisTick[] {
  const span = range.max - range.min
  const decimals = precision(Math.abs(span))
  return Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0 : index / (count - 1)
    const fraction = reverse ? 1 - position : position
    const value = range.min + span * fraction
    return { position, value, label: value.toFixed(decimals).replace(/\.0+$/, '') }
  })
}

/** Derive a human-readable physical axis label from an OME unit. */
export function physicalAxisLabel(unit: string): string {
  const normalized = unit.trim().toLowerCase()
  if (['s', 'sec', 'second', 'seconds', 'ms', 'millisecond', 'milliseconds', 'us', 'µs'].includes(normalized)) {
    return `Time (${unit})`
  }
  if (['um', 'µm', 'micrometer', 'micrometers', 'micrometre', 'micrometres'].includes(normalized)) {
    return `Space (${unit})`
  }
  return `Position (${unit || 'Pixels'})`
}
