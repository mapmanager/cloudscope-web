import { describe, expect, it } from 'vitest'

import { plotlyXRangeUpdate, sameAxisRange, xRangeFromRelayout } from '../src/plots/plotlyAxisRange'

describe('Plotly linked X-axis helpers', () => {
  it('normalizes indexed and complete range events', () => {
    expect(xRangeFromRelayout({ 'xaxis.range[0]': 8, 'xaxis.range[1]': 2 })).toEqual({
      min: 2,
      max: 8,
    })
    expect(xRangeFromRelayout({ 'xaxis.range': [1.5, 4.5] })).toEqual({ min: 1.5, max: 4.5 })
  })

  it('maps autorange to null and ignores unrelated relayout events', () => {
    expect(xRangeFromRelayout({ 'xaxis.autorange': true })).toBeNull()
    expect(xRangeFromRelayout({ 'yaxis.range[0]': 1 })).toBeUndefined()
  })

  it('compares ranges and generates minimal Plotly updates', () => {
    expect(sameAxisRange({ min: 1, max: 2 }, { min: 1, max: 2 + 1e-10 })).toBe(true)
    expect(plotlyXRangeUpdate({ min: 1, max: 2 })).toEqual({
      'xaxis.range': [1, 2],
      'xaxis.autorange': false,
    })
    expect(plotlyXRangeUpdate(null)).toEqual({ 'xaxis.autorange': true })
  })
})
