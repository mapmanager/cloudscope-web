import { describe, expect, it } from 'vitest'

import { buildXYSeries, type XYPlotSpec } from '../src/plots/xyPlot'
import { plotsForAnalysis } from '../src/plots/analysisPlotRegistry'

const spec: XYPlotSpec = {
  id: 'velocity',
  title: 'Velocity',
  source: { analysisName: 'radon_velocity', resource: 'table' },
  data: { xColumn: 'time_s', yColumn: 'velocity' },
  presentation: {
    xLabel: 'Time (s)',
    yLabel: 'Velocity',
    seriesName: 'Velocity',
    mode: 'lines',
  },
}

describe('X/Y plot data', () => {
  it('selects configured columns and skips non-finite rows', () => {
    const result = buildXYSeries(
      {
        columns: ['time_s', 'velocity'],
        rows: [
          { time_s: '0', velocity: '2.5' },
          { time_s: 'bad', velocity: '3.5' },
          { time_s: '1', velocity: '4.5' },
        ],
      },
      spec,
    )
    expect(result).toEqual({ x: [0, 1], y: [2.5, 4.5] })
  })

  it('reports missing configured columns', () => {
    expect(() => buildXYSeries({ columns: ['time_s'], rows: [] }, spec)).toThrow(
      'Plot Y column is missing: velocity',
    )
  })

  it('defines sum intensity as a ΔF/F line with detected peak markers', () => {
    const [sumIntensity] = plotsForAnalysis('sum_intensity')

    expect(sumIntensity?.data).toEqual({ xColumn: 'time_sec', yColumn: 'df_f_signal' })
    expect(sumIntensity?.overlays?.[0]).toMatchObject({
      source: { resource: 'peaks' },
      data: { xColumn: 'peak_time_sec', yColumn: 'peak_value' },
      presentation: { mode: 'markers' },
    })
  })

  it('allows a declared peak overlay to contain no rows', () => {
    const overlay = plotsForAnalysis('sum_intensity')[0]?.overlays?.[0]
    expect(overlay).toBeDefined()
    expect(
      buildXYSeries({ columns: ['peak_time_sec', 'peak_value'], rows: [] }, overlay!, true),
    ).toEqual({ x: [], y: [] })
  })
})
