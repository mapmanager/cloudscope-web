import Papa from 'papaparse'

import type { ResourceFetch } from './browserDirectory'

export interface CsvTable {
  columns: string[]
  rows: Record<string, string>[]
}

export async function loadCsv(
  url: URL,
  signal?: AbortSignal,
  resourceFetch: ResourceFetch = fetch,
): Promise<CsvTable> {
  const response = await resourceFetch(url, signal ? { signal } : undefined)
  if (!response.ok) {
    throw new Error(`Could not load ${url.href}: HTTP ${response.status}`)
  }
  const result = Papa.parse<Record<string, string>>(await response.text(), {
    header: true,
    skipEmptyLines: true,
  })
  if (result.errors.length > 0) {
    throw new Error(`Could not parse ${url.href}: ${result.errors[0]?.message ?? 'invalid CSV'}`)
  }
  return { columns: result.meta.fields ?? [], rows: result.data }
}
