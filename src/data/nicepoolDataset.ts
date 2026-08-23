import type { DatasetInput, NicePoolRow, NicePoolValue } from '@mapmanager/nicepool'

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
