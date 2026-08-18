import type { AxisRange } from '../models/viewState'

export type PlotlyRelayoutEvent = Record<string, unknown>

/** Normalize Plotly relayout data into application-owned X-axis state. */
export function xRangeFromRelayout(event: PlotlyRelayoutEvent): AxisRange | null | undefined {
  if (event['xaxis.autorange'] === true) return null
  const complete = event['xaxis.range']
  const values = Array.isArray(complete)
    ? complete
    : [event['xaxis.range[0]'], event['xaxis.range[1]']]
  const min = Number(values[0])
  const max = Number(values[1])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return undefined
  return min < max ? { min, max } : { min: max, max: min }
}

/** Compare nullable ranges with tolerance for Plotly floating-point round trips. */
export function sameAxisRange(
  left: AxisRange | null,
  right: AxisRange | null,
  tolerance = 1e-9,
): boolean {
  if (left === null || right === null) return left === right
  return Math.abs(left.min - right.min) <= tolerance && Math.abs(left.max - right.max) <= tolerance
}

/** Convert application state into the smallest Plotly relayout update. */
export function plotlyXRangeUpdate(range: AxisRange | null): PlotlyRelayoutEvent {
  return range === null
    ? { 'xaxis.autorange': true }
    : { 'xaxis.range': [range.min, range.max], 'xaxis.autorange': false }
}
