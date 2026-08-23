import type {
  AcqImageCollection,
  AcqImageCollectionRow,
  AcqImageDocument,
  LoadedDocument,
} from '../models/acqImageModels'

/** Legacy AcqStore Server wire format, adapted at the transport boundary. */
interface WebDatasetV1 extends Omit<AcqImageCollection, 'acq_images' | 'analysis_tables'> {
  format: 'acqstore-web-dataset'
  format_version: 1
  images: AcqImageCollectionRow[]
  analysis_tables?: Record<string, string>
}

async function loadJson<T>(url: string | URL, signal?: AbortSignal): Promise<LoadedDocument<T>> {
  const resolved = new URL(url, window.location.href)
  const response = await fetch(resolved, signal ? { signal } : undefined)
  if (!response.ok) {
    throw new Error(`Could not load ${resolved.href}: HTTP ${response.status}`)
  }
  return { data: (await response.json()) as T, url: resolved }
}

export async function loadDataset(
  url: string | URL,
  signal?: AbortSignal,
): Promise<LoadedDocument<AcqImageCollection>> {
  const loaded = await loadJson<WebDatasetV1>(url, signal)
  if (loaded.data.format !== 'acqstore-web-dataset' || loaded.data.format_version !== 1) {
    throw new Error('The URL is not an AcqStore Web Dataset v1 manifest')
  }
  return {
    data: {
      id: loaded.data.id,
      name: loaded.data.name,
      acqstore_version: loaded.data.acqstore_version,
      created_utc: loaded.data.created_utc,
      analysis_tables: loaded.data.analysis_tables ?? {},
      acq_images: loaded.data.images,
    },
    url: loaded.url,
  }
}

export async function loadAcqImage(
  datasetUrl: URL,
  href: string,
  signal?: AbortSignal,
): Promise<LoadedDocument<AcqImageDocument>> {
  const loaded = await loadJson<AcqImageDocument>(new URL(href, datasetUrl), signal)
  if (loaded.data.format !== 'acqstore-web-acqimage' || loaded.data.format_version !== 1) {
    throw new Error('The selected resource is not an AcqStore Web AcqImage v1 manifest')
  }
  return loaded
}
