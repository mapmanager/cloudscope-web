import type { CsvTable } from '../data/csvLoader'
import type { AxisLinkGroup } from '../models/viewState'

export interface XYPlotSpec {
  id: string
  title: string
  source: { analysisName: string; resource: 'table' }
  data: { xColumn: string; yColumn: string }
  presentation: {
    xLinkGroup: AxisLinkGroup
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
  source: { summary: 'peak_events' }
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

/** Select one analysis instance from AcqStore's combined analysis-type table. */
export function filterAnalysisTable(
  table: CsvTable,
  channel: number,
  roiId: number | null,
): CsvTable {
  return {
    columns: table.columns,
    rows: table.rows.filter(
      (row) => Number(row.channel) === channel && (roiId === null || Number(row.roi_id) === roiId),
    ),
  }
}

/** Read the authoritative sparse peak result without deriving it from the trace. */
export function peakSeriesFromSummary(summary: Record<string, unknown>): XYSeries {
  const events = Array.isArray(summary.peak_events) ? summary.peak_events : []
  const x: number[] = []
  const y: number[] = []
  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const peak = (event as Record<string, unknown>).peak
    if (!peak || typeof peak !== 'object') continue
    const values = peak as Record<string, unknown>
    if (values.time_sec === null || values.time_sec === undefined) continue
    if (values.value === null || values.value === undefined) continue
    const time = Number(values.time_sec)
    const value = Number(values.value)
    if (Number.isFinite(time) && Number.isFinite(value)) {
      x.push(time)
      y.push(value)
    }
  }
  return { x, y }
}

export function buildXYSeries(
  table: CsvTable,
  spec: Pick<XYPlotSpec, 'title' | 'data'>,
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
