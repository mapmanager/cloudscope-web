export const CLOUDSCOPE_SAMPLE_CATALOG_URL =
  'https://data.mapmanager.net/cloudscope-web/samples.json'

/** One hosted AcqStore OME-Zarr collection advertised to CloudScope Web. */
export interface CloudScopeSample {
  name: string
  url: string
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Load and validate the ordered CloudScope Web sample catalog. */
export async function loadSampleCatalog(
  catalogUrl: string | URL = CLOUDSCOPE_SAMPLE_CATALOG_URL,
  resourceFetch: typeof fetch = globalThis.fetch,
): Promise<CloudScopeSample[]> {
  const resolvedCatalogUrl = new URL(catalogUrl, globalThis.location?.href ?? 'http://localhost/')
  const response = await resourceFetch(resolvedCatalogUrl)
  if (!response.ok) {
    throw new Error(`Could not load ${resolvedCatalogUrl.href}: HTTP ${response.status}`)
  }
  const document: unknown = await response.json()
  if (!Array.isArray(document)) {
    throw new Error('Invalid CloudScope sample catalog: expected an array')
  }
  const samples = document.map((entry, index) => {
    if (
      !object(entry) ||
      typeof entry.name !== 'string' ||
      !entry.name.trim() ||
      typeof entry.url !== 'string' ||
      !entry.url.trim()
    ) {
      throw new Error(`Invalid CloudScope sample catalog entry ${index}`)
    }
    return {
      name: entry.name.trim(),
      url: new URL(entry.url, resolvedCatalogUrl).href,
    }
  })
  if (new Set(samples.map(({ url }) => url)).size !== samples.length) {
    throw new Error('Invalid CloudScope sample catalog: duplicate URLs')
  }
  return samples
}
