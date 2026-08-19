/** Color lookup tables used by scalar and composite raster rendering. */

export const LUT_LABELS: Readonly<Record<string, string>>
export function lutTable(name: string): Uint8ClampedArray
export function sampleLut(name: string, value: number): [number, number, number]
