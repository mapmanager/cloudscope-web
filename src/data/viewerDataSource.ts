import { loadCsv, type CsvTable } from './csvLoader'
import {
  loadImagePlane,
  loadPixelDescriptor,
  type ImagePlane,
  type PlaneIndices,
} from './omeZarrLoader'
import {
  loadAcqImageCollection,
  loadAcqImageCollectionEntry,
} from './acqImageCollectionLoader'
import type { AcqImageCollectionEntry } from '../models/acqImageCollectionManifest'
import type {
  AcqImageDocument,
  LoadedDocument,
  PixelDescriptor,
  AcqImageCollection,
} from '../models/acqImageModels'
import {
  createDirectoryFetch,
  type ResourceFetch,
} from './browserDirectory'

async function loadJsonResource(
  url: URL,
  signal?: AbortSignal,
  resourceFetch: ResourceFetch = fetch,
): Promise<unknown> {
  const response = await resourceFetch(url, signal ? { signal } : undefined)
  if (!response.ok) throw new Error(`Could not load JSON: HTTP ${response.status}`)
  return response.json()
}

export interface ViewerDataSource {
  readonly canUnload: boolean
  readonly persistInUrl: boolean
  readonly refreshAfterUnload: boolean
  loadCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>>
  refreshCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>>
  loadAcqImage(
    collectionUrl: URL,
    href: string,
    signal?: AbortSignal,
  ): Promise<LoadedDocument<AcqImageDocument>>
  loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane>
  loadPixelDescriptor(
    href: string,
    signal?: AbortSignal,
  ): Promise<Omit<PixelDescriptor, 'href'>>
  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable>
  loadJson(url: URL, signal?: AbortSignal): Promise<unknown>
  unloadImage(imageId: string): Promise<void>
  close(): Promise<void>
}

export class AcqImageCollectionSource implements ViewerDataSource {
  readonly canUnload = false
  readonly persistInUrl: boolean
  readonly refreshAfterUnload = false
  private entries = new Map<string, AcqImageCollectionEntry>()

  constructor(
    private readonly collectionUrl: string,
    private readonly resourceFetch: ResourceFetch = fetch,
    persistInUrl = true,
  ) {
    this.persistInUrl = persistInUrl
  }

  async loadCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    const loaded = await loadAcqImageCollection(this.collectionUrl, signal, this.resourceFetch)
    this.entries = new Map(
      loaded.manifest.members.map((entry) => [entry.resources.acqimage, entry]),
    )
    return loaded
  }

  refreshCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    return this.loadCollection(signal)
  }

  loadAcqImage(collectionUrl: URL, href: string, signal?: AbortSignal) {
    const entry = this.entries.get(href)
    if (!entry) return Promise.reject(new Error(`Unknown collection image manifest: ${href}`))
    return loadAcqImageCollectionEntry(collectionUrl, entry, signal, this.resourceFetch)
  }

  loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    return loadImagePlane(descriptor, documentUrl, indices, signal, this.resourceFetch)
  }

  loadPixelDescriptor(href: string, signal?: AbortSignal) {
    return loadPixelDescriptor(href, signal, this.resourceFetch)
  }

  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    return loadCsv(url, signal, this.resourceFetch)
  }

  async loadJson(url: URL, signal?: AbortSignal): Promise<unknown> {
    return loadJsonResource(url, signal, this.resourceFetch)
  }

  async unloadImage(): Promise<void> {}

  async close(): Promise<void> {
    this.entries.clear()
  }
}

/** Current-format AcqStore collection selected from the user's local filesystem. */
export class BrowserDirectoryCollectionSource extends AcqImageCollectionSource {
  private readonly rootUrl: URL
  private readonly localFetch: ResourceFetch

  constructor(private readonly directory: FileSystemDirectoryHandle) {
    const rootUrl = new URL(
      `${encodeURIComponent(directory.name)}/`,
      'https://local-ome-zarr.invalid/',
    )
    const localFetch = createDirectoryFetch(directory, rootUrl)
    super(rootUrl.href, localFetch, false)
    this.rootUrl = rootUrl
    this.localFetch = localFetch
  }

  override async loadCollection(signal?: AbortSignal) {
    if (!this.directory.name.toLowerCase().endsWith('.ome.zarr')) {
      throw new Error('Select the root directory whose name ends with .ome.zarr.')
    }
    const currentManifest = await this.localFetch(
      new URL('acqstore/collection.json', this.rootUrl),
      signal ? { signal } : undefined,
    )
    if (!currentManifest.ok) {
      throw new Error('The selected directory is missing acqstore/collection.json.')
    }
    return super.loadCollection(signal)
  }
}
