/**
 * Sliding-Z helpers: centered maximum projection over already-loaded planes.
 */

/**
 * Inclusive Z indices for a centered sliding window, clamped to `[0, zSize)`.
 *
 * @param zIndex Center plane.
 * @param radius Non-negative plus-or-minus slice count.
 * @param zSize Total Z size; must be a positive integer.
 * @returns Increasing unique indices, never empty when `zSize >= 1`.
 */
export function slidingZIndices(zIndex: number, radius: number, zSize: number): number[] {
  if (!Number.isInteger(zSize) || zSize < 1) {
    throw new Error('Sliding-Z requires a positive integer Z size')
  }
  const center = Math.max(0, Math.min(zSize - 1, Math.trunc(Number(zIndex))))
  const span = Math.max(0, Math.trunc(Number(radius)))
  const start = Math.max(0, center - span)
  const end = Math.min(zSize - 1, center + span)
  const indices: number[] = []
  for (let z = start; z <= end; z += 1) indices.push(z)
  return indices
}

function planeArray(data: ArrayLike<number>): { ctor: new (length: number) => ArrayLike<number> & { [index: number]: number }; length: number } {
  if (ArrayBuffer.isView(data) && !(data instanceof DataView)) {
    return {
      ctor: data.constructor as new (length: number) => ArrayLike<number> & { [index: number]: number },
      length: data.length,
    }
  }
  return { ctor: Float64Array, length: data.length }
}

/**
 * Sample-wise maximum of one or more same-length source planes.
 *
 * @param planes Source-YX planes with equal length.
 * @returns A new array of the first plane's typed-array kind.
 * @throws If `planes` is empty or lengths differ.
 */
export function maxProjectPlanes(planes: ArrayLike<number>[]): ArrayLike<number> {
  const first = planes[0]
  if (!first) throw new Error('Sliding-Z requires at least one plane')
  const { ctor, length } = planeArray(first)
  const result = new ctor(length) as ArrayLike<number> & { [index: number]: number }
  for (let index = 0; index < length; index += 1) result[index] = Number(first[index])
  for (let planeIndex = 1; planeIndex < planes.length; planeIndex += 1) {
    const plane = planes[planeIndex]
    if (!plane || plane.length !== length) {
      throw new Error('Sliding-Z planes must have equal length')
    }
    for (let index = 0; index < length; index += 1) {
      const value = Number(plane[index])
      const current = Number(result[index])
      if (value > current) result[index] = value
    }
  }
  return result
}

/**
 * Copy plane samples into a dense array the raster cache can transpose.
 *
 * @param data Zarrita plane samples.
 * @returns The original typed array, or a `Float64Array` copy of generic data.
 */
export function asPlaneSamples(data: ArrayLike<number>): ArrayLike<number> {
  if (ArrayBuffer.isView(data) && !(data instanceof DataView)) return data
  return Float64Array.from({ length: data.length }, (_, index) => Number(data[index]))
}
