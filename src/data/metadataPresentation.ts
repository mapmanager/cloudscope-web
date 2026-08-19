/** One display-ready leaf from a nested metadata object. */
export interface MetadataEntry {
  label: string
  value: string
}

function displayValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '—'
  if (typeof value === 'string') return value || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) {
    return value.map(displayValue).join(', ')
  }
  return JSON.stringify(value)
}

/** Flatten nested metadata into stable dot-delimited rows for the inspector. */
export function metadataEntries(metadata: Record<string, unknown>): MetadataEntry[] {
  const entries: MetadataEntry[] = []
  function visit(value: unknown, path: string): void {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const children = Object.entries(value as Record<string, unknown>)
      if (children.length) {
        for (const [key, child] of children) visit(child, path ? `${path}.${key}` : key)
        return
      }
    }
    entries.push({ label: path, value: displayValue(value) })
  }
  for (const [key, value] of Object.entries(metadata)) visit(value, key)
  return entries
}
