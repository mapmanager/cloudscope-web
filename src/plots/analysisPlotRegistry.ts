import { diameterPlots } from './analysisPlots/diameter'
import { radonVelocityPlots } from './analysisPlots/radonVelocity'
import { sumIntensityPlots } from './analysisPlots/sumIntensity'
import type { XYPlotSpec } from './xyPlot'

const registry: Record<string, XYPlotSpec[]> = {
  diameter: diameterPlots,
  radon_velocity: radonVelocityPlots,
  sum_intensity: sumIntensityPlots,
}

export function plotsForAnalysis(analysisName: string): XYPlotSpec[] {
  return registry[analysisName] ?? []
}
