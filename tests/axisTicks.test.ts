import { describe, expect, it } from 'vitest'

import { axisTicks, physicalAxisLabel } from '../src/data/axisTicks'

describe('axis ticks', () => {
  it('builds forward and reverse tick values', () => {
    expect(axisTicks({ min: 0, max: 10 }, 3).map(({ value }) => value)).toEqual([0, 5, 10])
    expect(axisTicks({ min: 0, max: 10 }, 3, true).map(({ value }) => value)).toEqual([10, 5, 0])
  })

  it('derives physical labels from OME units', () => {
    expect(physicalAxisLabel('seconds')).toBe('Time (seconds)')
    expect(physicalAxisLabel('um')).toBe('Space (um)')
  })
})
