import { describe, expect, it } from 'vitest'

import { orientRoiForDisplay, orientYxPlaneForDisplay } from './imageDisplayTransform'

describe('YX display orientation', () => {
  it('transposes a YX plane and flips the resulting display Y axis', () => {
    const result = orientYxPlaneForDisplay({
      data: new Uint16Array([
        1, 2, 3, // source Y 0
        4, 5, 6, // source Y 1
      ]),
      width: 3,
      height: 2,
      sourceWidth: 30,
      sourceHeight: 20,
      level: '0',
    })

    expect([result.width, result.height]).toEqual([2, 3])
    expect(Array.from(result.data)).toEqual([
      3, 6, // display Y 0
      2, 5, // display Y 1
      1, 4, // display Y 2
    ])
    expect([result.sourceWidth, result.sourceHeight]).toEqual([20, 30])
  })

  it('maps exclusive rectangular ROI bounds into display coordinates', () => {
    expect(
      orientRoiForDisplay(
        {
          id: 1,
          type: 'rect',
          name: '',
          note: '',
          x_start: 2,
          x_stop: 8,
          y_start: 10,
          y_stop: 30,
        },
        40,
      ),
    ).toMatchObject({ x_start: 10, x_stop: 30, y_start: 32, y_stop: 38 })
  })

  it('maps line ROI points into display pixel coordinates', () => {
    expect(
      orientRoiForDisplay(
        { id: 2, type: 'line', name: '', note: '', x0: 2, y0: 10, x1: 8, y1: 30 },
        40,
      ),
    ).toMatchObject({ x0: 10, y0: 37, x1: 30, y1: 31 })
  })
})
