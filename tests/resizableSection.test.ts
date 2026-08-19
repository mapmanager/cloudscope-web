import { describe, expect, it } from 'vitest'

import { clampSectionHeight } from '../src/data/resizableSection'

describe('resizable section sizing', () => {
  it('clamps requested heights to independent minimum and maximum bounds', () => {
    expect(clampSectionHeight(80, 120, 720)).toBe(120)
    expect(clampSectionHeight(840, 120, 720)).toBe(720)
    expect(clampSectionHeight(360, 120, 720)).toBe(360)
  })

  it('allows a section configured for continuous collapse to reach zero', () => {
    expect(clampSectionHeight(-10, 0, 720)).toBe(0)
    expect(clampSectionHeight(1, 0, 720)).toBe(1)
  })
})
