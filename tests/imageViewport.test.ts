import { describe, expect, it } from 'vitest'

import {
  clampAxisRange,
  dominantDragAxis,
  fullAxisRange,
  panAxisRange,
  secondsPerPixel,
  selectedAxisRange,
  zoomAxisRange,
} from '../src/data/imageViewport'

describe('image viewport math', () => {
  it('uses pixel centers for the full physical range', () => {
    expect(fullAxisRange(5, 0.25)).toEqual({ min: 0, max: 1 })
  })

  it('zooms around the cursor and clamps to the image', () => {
    expect(zoomAxisRange({ min: 0, max: 10 }, 0.5, 0.5, { min: 0, max: 10 }, 1)).toEqual({
      min: 2.5,
      max: 7.5,
    })
    expect(clampAxisRange({ min: -4, max: 2 }, { min: 0, max: 10 }, 1)).toEqual({
      min: 0,
      max: 6,
    })
  })

  it('pans without leaving the image', () => {
    expect(panAxisRange({ min: 2, max: 6 }, 2, { min: 0, max: 10 }, 1)).toEqual({
      min: 6,
      max: 10,
    })
  })

  it('converts known time units but does not guess unknown units', () => {
    expect(secondsPerPixel(2, 'ms')).toBe(0.002)
    expect(secondsPerPixel(2, 'seconds')).toBe(2)
    expect(secondsPerPixel(2, 'Pixels')).toBeNull()
  })

  it('locks a drag to its dominant direction after a threshold', () => {
    expect(dominantDragAxis(4, 2)).toBeNull()
    expect(dominantDragAxis(12, 5)).toBe('x')
    expect(dominantDragAxis(3, -9)).toBe('y')
  })

  it('maps a reversed screen selection into an ordered axis range', () => {
    expect(selectedAxisRange({ min: 10, max: 30 }, 75, 25, 100, 1)).toEqual({
      min: 15,
      max: 25,
    })
    expect(selectedAxisRange({ min: 10, max: 30 }, 4, 7, 100, 1)).toBeNull()
  })
})
