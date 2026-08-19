import { fullAxisRange, secondsPerPixel } from './imageViewport'
import { sameAxisRange } from '../plots/plotlyAxisRange'
import type { AxisRange } from '../models/viewState'
import type { PlaneAxisCalibration } from './omeZarrLoader'

/**
 * Seconds per source-Y sample used as RasterViewer display-X after transpose.
 *
 * @param axis Source Y calibration from the loaded OME-Zarr plane.
 * @returns Positive seconds per pixel.
 * @throws If the unit is not a known time unit.
 */
export function displayTimeStepSeconds(axis: PlaneAxisCalibration): number {
  const step = secondsPerPixel(axis.spacing, axis.unit)
  if (step === null || !(step > 0)) {
    throw new Error(
      `Image X axis must have time units to link views; received "${axis.unit}"`,
    )
  }
  return step
}

/**
 * Plot-linked full X extent using pixel-center samples `(n - 1) * dt`.
 *
 * @param sourceHeight Source Y (display X) sample count.
 * @param secondsPerSample Seconds per source-Y sample.
 * @returns Inclusive time range in seconds.
 */
export function fullLinkedTimeRange(sourceHeight: number, secondsPerSample: number): AxisRange {
  return fullAxisRange(sourceHeight, secondsPerSample)
}

/**
 * Convert a RasterViewer physical X window into plot-linked seconds.
 *
 * A window that covers the pixel-center full extent emits `null` so Plotly
 * autoranges. Viewer home uses `n * dt`; that still counts as full.
 *
 * @param minimum Physical display-X minimum (seconds).
 * @param maximum Physical display-X maximum (seconds).
 * @param full Pixel-center full extent.
 * @returns Linked range, or `null` for the full image.
 */
export function linkedRangeFromPhysical(
  minimum: number,
  maximum: number,
  full: AxisRange,
): AxisRange | null {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
    return null
  }
  const range = { min: minimum, max: maximum }
  if (minimum <= full.min + 1e-9 && maximum >= full.max - 1e-9) return null
  if (sameAxisRange(range, full)) return null
  return range
}
