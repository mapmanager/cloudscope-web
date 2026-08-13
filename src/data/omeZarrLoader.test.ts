import { describe, expect, it } from 'vitest'

import { intensityRange, planeSelection } from './omeZarrLoader'

describe('OME-Zarr plane helpers', () => {
  it('keeps raster axes and indexes acquisition axes by semantic name', () => {
    expect(planeSelection(['t', 'c', 'z', 'y', 'x'], { channel: 2, z: 3, t: 4 })).toEqual([
      4,
      2,
      3,
      null,
      null,
    ])
  })

  it('uses exported contrast when valid and otherwise scans the plane', () => {
    expect(intensityRange(new Uint16Array([5, 10, 20]), { value_min: 2, value_max: 50 })).toEqual([
      2,
      50,
    ])
    expect(intensityRange(new Uint16Array([5, 10, 20]))).toEqual([5, 20])
  })
})
