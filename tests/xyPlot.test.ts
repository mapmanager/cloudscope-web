import { describe, expect, it } from 'vitest'

import {
  buildXYSeries,
  filterAnalysisTable,
  peakSeriesFromSummary,
  type XYPlotSpec,
} from '../src/plots/xyPlot'
import { plotsForAnalysis } from '../src/plots/analysisPlotRegistry'

const spec: XYPlotSpec = {
  id: 'velocity',
  title: 'Velocity',
  source: { analysisName: 'radon_velocity', resource: 'table' },
  data: { xColumn: 'time_s', yColumn: 'velocity' },
  presentation: {
    xLinkGroup: 'time',
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
      source: { summary: 'peak_events' },
      presentation: { mode: 'markers' },
    })
  })

  it('selects one analysis instance from a native combined table', () => {
    const table = {
      columns: ['channel', 'roi_id', 'time_sec', 'df_f_signal'],
      rows: [
        { channel: '0', roi_id: '1', time_sec: '0', df_f_signal: '2' },
        { channel: '1', roi_id: '2', time_sec: '0', df_f_signal: '4' },
      ],
    }
    expect(filterAnalysisTable(table, 1, 2).rows).toEqual([table.rows[1]])
  })

  it('reads authoritative sparse peaks directly from the analysis summary', () => {
    expect(
      peakSeriesFromSummary({
        peak_events: [
          { peak: { time_sec: 1.25, value: 4.5 } },
          { peak: { time_sec: null, value: null } },
        ],
      }),
    ).toEqual({ x: [1.25], y: [4.5] })
  })
})
