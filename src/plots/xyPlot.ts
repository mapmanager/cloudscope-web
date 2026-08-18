import type { CsvTable } from '../data/csvLoader'

export interface XYPlotSpec {
  id: string
  title: string
  source: { analysisName: string; resource: 'table' | 'peaks' }
  data: { xColumn: string; yColumn: string }
  presentation: {
    xLabel: string
    yLabel: string
    seriesName: string
    mode: 'lines' | 'markers' | 'lines+markers'
  }
  overlays?: XYPlotOverlaySpec[]
}

export interface XYPlotOverlaySpec {
  id: string
  title: string
  source: { resource: 'table' | 'peaks' }
  data: { xColumn: string; yColumn: string }
  presentation: {
    seriesName: string
    mode: 'markers'
    color: string
    size: number
  }
}

export interface XYSeries {
  x: number[]
  y: number[]
}

export function buildXYSeries(
  table: CsvTable,
  spec: Pick<XYPlotSpec, 'title' | 'data'> | Pick<XYPlotOverlaySpec, 'title' | 'data'>,
  allowEmpty = false,
): XYSeries {
  if (!table.columns.includes(spec.data.xColumn)) {
    throw new Error(`Plot X column is missing: ${spec.data.xColumn}`)
  }
  if (!table.columns.includes(spec.data.yColumn)) {
    throw new Error(`Plot Y column is missing: ${spec.data.yColumn}`)
  }
  const x: number[] = []
  const y: number[] = []
  for (const row of table.rows) {
    const xValue = Number(row[spec.data.xColumn])
    const yValue = Number(row[spec.data.yColumn])
    if (Number.isFinite(xValue) && Number.isFinite(yValue)) {
      x.push(xValue)
      y.push(yValue)
    }
  }
  if (!x.length && !allowEmpty) throw new Error(`Plot ${spec.title} has no finite X/Y rows`)
  return { x, y }
}
