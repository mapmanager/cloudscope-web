import { LUT_LABELS } from '../raster-viewer/lut.js'

/**
 * Map an AcqStore LUT name onto a RasterViewer table key.
 *
 * @param name Sidecar or channel LUT label, for example `"Green"`.
 * @returns A key present in {@link LUT_LABELS}, or `"gray"` when unknown.
 */
export function normalizeLutName(name: string | null | undefined): string {
  const key = String(name ?? 'gray').trim().toLowerCase()
  return Object.hasOwn(LUT_LABELS, key) ? key : 'gray'
}
