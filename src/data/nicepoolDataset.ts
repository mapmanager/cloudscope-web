import type {
  DatasetInput,
  NicePoolRow,
  NicePoolSelection,
  NicePoolValue,
} from '@mapmanager/nicepool'

import type { CsvTable } from './csvLoader'

export const NICEPOOL_ROW_ID_COLUMN = 'pool_row_id'

type ColumnKind = 'boolean' | 'number' | 'string'

function isBoolean(value: string): boolean {
  return value.toLowerCase() === 'true' || value.toLowerCase() === 'false'
}

function isNumber(value: string): boolean {
  if (value.trim() === '') return false
  const number = Number(value)
  return Number.isFinite(number)
}

function inferColumnKind(column: string, table: CsvTable): ColumnKind {
  if (column === NICEPOOL_ROW_ID_COLUMN) return 'string'
  const values = table.rows.map((row) => row[column] ?? '').filter((value) => value.trim() !== '')
  if (values.length > 0 && values.every(isBoolean)) return 'boolean'
  if (values.length > 0 && values.every(isNumber)) return 'number'
  return 'string'
}

function convertValue(value: string | undefined, kind: ColumnKind): NicePoolValue {
  if (value === undefined || value.trim() === '') return null
  if (kind === 'boolean') return value.toLowerCase() === 'true'
  if (kind === 'number') return Number(value)
  return value
}

/** Convert a parsed AcqStore CSV into the scalar dataset accepted by NicePool. */
export function csvTableToNicePoolDataset(table: CsvTable): DatasetInput {
  if (!table.columns.includes(NICEPOOL_ROW_ID_COLUMN)) {
    throw new Error(`Analysis table is missing required ${NICEPOOL_ROW_ID_COLUMN} column`)
  }
  if (table.rows.length === 0) {
    throw new Error('Analysis table contains no rows')
  }
  const kinds = new Map(table.columns.map((column) => [column, inferColumnKind(column, table)]))
  const rows: NicePoolRow[] = table.rows.map((source, rowIndex) => {
    const row: Record<string, NicePoolValue> = {}
    for (const column of table.columns) {
      row[column] = convertValue(source[column], kinds.get(column) ?? 'string')
    }
    if (row[NICEPOOL_ROW_ID_COLUMN] === null) {
      throw new Error(`Analysis table row ${rowIndex} has no ${NICEPOOL_ROW_ID_COLUMN}`)
    }
    return row
  })
  return { rowIdColumn: NICEPOOL_ROW_ID_COLUMN, rows }
}

function integerField(row: NicePoolRow, name: string): number | null {
  const value = row[name]
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

/** Build NicePool selection for the image/channel/ROI currently shown by CloudScope. */
export function nicePoolSelectionForViewer(
  rows: readonly NicePoolRow[],
  acqImageId: string | null,
  channel: number,
  roiId: number | null,
): NicePoolSelection {
  if (!acqImageId) return { primaryRowId: null, selectedRowIds: [] }
  const matching = rows.filter((row) => row.acq_image_id === acqImageId)
  const exact = matching.find(
    (row) => integerField(row, 'channel') === channel && integerField(row, 'roi_id') === roiId,
  )
  const primary = exact ?? matching[0]
  return {
    primaryRowId: primary ? String(primary.pool_row_id) : null,
    selectedRowIds: matching.map((row) => String(row.pool_row_id)),
  }
}

export interface NicePoolSelectionTarget {
  acqImageId: string
  channel: number
  roiId: number
}

/** Resolve a NicePool primary row into CloudScope's image-plane selection identity. */
export function nicePoolTargetForSelection(
  rows: readonly NicePoolRow[],
  selection: NicePoolSelection,
): NicePoolSelectionTarget | null {
  if (!selection.primaryRowId) return null
  const row = rows.find((candidate) => candidate.pool_row_id === selection.primaryRowId)
  if (!row || typeof row.acq_image_id !== 'string') return null
  const channel = integerField(row, 'channel')
  const roiId = integerField(row, 'roi_id')
  if (channel === null || roiId === null) {
    throw new Error('Selected analysis row has no valid channel or ROI.')
  }
  return { acqImageId: row.acq_image_id, channel, roiId }
}
