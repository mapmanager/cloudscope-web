import type { AcqImageDocument, LoadedDocument, WebDataset } from '../models/webDataset'

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
): Promise<LoadedDocument<WebDataset>> {
  const loaded = await loadJson<WebDataset>(url, signal)
  if (loaded.data.format !== 'acqstore-web-dataset' || loaded.data.format_version !== 1) {
    throw new Error('The URL is not an AcqStore Web Dataset v1 manifest')
  }
  return loaded
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
