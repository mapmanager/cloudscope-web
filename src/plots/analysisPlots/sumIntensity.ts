import type { XYPlotSpec } from '../xyPlot'

export const sumIntensityPlots: XYPlotSpec[] = [
  {
    id: 'sum-intensity-over-time',
    title: 'Sum intensity over time',
    source: { analysisName: 'sum_intensity', resource: 'table' },
    data: { xColumn: 'time_sec', yColumn: 'df_f_signal' },
    presentation: {
      xLabel: 'Time (s)',
      yLabel: 'ΔF/F',
      seriesName: 'Sum intensity ΔF/F',
      mode: 'lines',
    },
    overlays: [
      {
        id: 'detected-peaks',
        title: 'Detected peaks',
        source: { resource: 'peaks' },
        data: { xColumn: 'peak_time_sec', yColumn: 'peak_value' },
        presentation: {
          seriesName: 'Detected peaks',
          mode: 'markers',
          color: '#ffb44c',
          size: 8,
        },
      },
    ],
  },
]
