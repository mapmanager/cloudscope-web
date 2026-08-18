import type { XYPlotSpec } from '../xyPlot'

export const diameterPlots: XYPlotSpec[] = [
  {
    id: 'diameter-over-time',
    title: 'Diameter over time',
    source: { analysisName: 'diameter', resource: 'table' },
    data: { xColumn: 'time_s', yColumn: 'diameter_um_filt' },
    presentation: {
      xLinkGroup: 'time',
      xLabel: 'Time (s)',
      yLabel: 'Diameter (um)',
      seriesName: 'Diameter',
      mode: 'lines',
    },
  },
]
