import type { XYPlotSpec } from '../xyPlot'

export const radonVelocityPlots: XYPlotSpec[] = [
  {
    id: 'velocity-over-time',
    title: 'Velocity over time',
    source: { analysisName: 'radon_velocity', resource: 'table' },
    data: { xColumn: 'time_s', yColumn: 'velocity' },
    presentation: {
      xLinkGroup: 'time',
      xLabel: 'Time (s)',
      yLabel: 'Velocity',
      seriesName: 'Velocity',
      mode: 'lines',
    },
  },
]
