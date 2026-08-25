import { loadCsv, type CsvTable } from './csvLoader'
import { loadAcqImage, loadDataset } from './datasetLoader'
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

export type LocalOpenKind = 'file' | 'folder' | 'csv'

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

export class ExportedDatasetSource implements ViewerDataSource {
  readonly canUnload = false
  readonly persistInUrl: boolean = true
  readonly refreshAfterUnload = false
  constructor(private readonly datasetUrl: string) {}

  loadCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    return loadDataset(this.datasetUrl, signal)
  }

  refreshCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    return this.loadCollection(signal)
  }

  loadAcqImage(collectionUrl: URL, href: string, signal?: AbortSignal) {
    return loadAcqImage(collectionUrl, href, signal)
  }

  loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    return loadImagePlane(descriptor, documentUrl, indices, signal)
  }

  loadPixelDescriptor(href: string, signal?: AbortSignal) {
    return loadPixelDescriptor(href, signal)
  }

  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    return loadCsv(url, signal)
  }

  async loadJson(url: URL, signal?: AbortSignal): Promise<unknown> {
    return loadJsonResource(url, signal)
  }

  async unloadImage(): Promise<void> {}

  async close(): Promise<void> {}
}

const constructors = {
  uint8: Uint8Array,
  int8: Int8Array,
  uint16: Uint16Array,
  int16: Int16Array,
  uint32: Uint32Array,
  int32: Int32Array,
  float32: Float32Array,
  float64: Float64Array,
} as const

export class AcqStoreServerSource implements ViewerDataSource {
  readonly canUnload = true
  readonly persistInUrl = false
  readonly refreshAfterUnload = true
  private datasetId: string | null = null
  private manifestUrl: URL | null = null

  constructor(
    private readonly serverUrl: string,
    private readonly kind: LocalOpenKind,
  ) {}

  async loadCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    const server = new URL(this.serverUrl)
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: this.kind }),
    }
    if (signal) init.signal = signal
    const response = await fetch(new URL('/api/v2/datasets/pick', server), init)
    const opened = (await response.json()) as {
      ok: boolean
      datasetId?: string
      manifestUrl?: string
      message?: string
    }
    if (!response.ok || !opened.ok || !opened.datasetId || !opened.manifestUrl) {
      throw new Error(opened.message ?? `Could not open local ${this.kind}`)
    }
    this.datasetId = opened.datasetId
    this.manifestUrl = new URL(opened.manifestUrl, server)
    return loadDataset(this.manifestUrl, signal)
  }

  refreshCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    if (!this.manifestUrl) return Promise.reject(new Error('No server dataset is open'))
    return loadDataset(this.manifestUrl, signal)
  }

  loadAcqImage(collectionUrl: URL, href: string, signal?: AbortSignal) {
    return loadAcqImage(collectionUrl, href, signal)
  }

  async loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    const url = new URL(descriptor.href, documentUrl)
    url.searchParams.set('channel', String(indices.channel))
    url.searchParams.set('z', String(indices.z))
    url.searchParams.set('t', String(indices.t))
    url.searchParams.set('level', '0')
    const response = await fetch(url, signal ? { cache: 'no-store', signal } : { cache: 'no-store' })
    if (!response.ok) throw new Error(`Could not load image plane: HTTP ${response.status}`)
    const dtype = response.headers.get('x-acqstore-dtype') as keyof typeof constructors | null
    const TypedArray = dtype ? constructors[dtype] : undefined
    if (!TypedArray) throw new Error(`Unsupported server plane dtype: ${dtype ?? 'missing'}`)
    const shape = response.headers
      .get('x-acqstore-shape')
      ?.split(',')
      .map((value) => Number(value))
    if (!shape || shape.length !== 2 || !shape.every(Number.isInteger)) {
      throw new Error('Server plane response has no valid shape')
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength % TypedArray.BYTES_PER_ELEMENT !== 0) {
      throw new Error(`Server plane is not aligned for ${dtype}`)
    }
    const data = new TypedArray(buffer)
    const [height, width] = shape
    if (data.length !== height! * width!) throw new Error('Server plane sample count mismatch')
    const yIndex = descriptor.dims.findIndex((dim) => dim.toLowerCase() === 'y')
    const xIndex = descriptor.dims.findIndex((dim) => dim.toLowerCase() === 'x')
    if (yIndex < 0 || xIndex < 0) throw new Error('Image descriptor does not contain Y and X axes')
    const sourceWidth = descriptor.shape[xIndex]
    const sourceHeight = descriptor.shape[yIndex]
    if (sourceWidth === undefined || sourceHeight === undefined) {
      throw new Error('Image descriptor shape does not match its dimensions')
    }
    return {
      data,
      width: width!,
      height: height!,
      sourceWidth,
      sourceHeight,
      level: '0',
      axes: {
        x: {
          spacing:
            descriptor.axes.find((axis) => axis.name.toLowerCase() === 'x')?.spacing ?? 1,
          unit: descriptor.axes.find((axis) => axis.name.toLowerCase() === 'x')?.unit ?? 'Pixels',
        },
        y: {
          spacing:
            descriptor.axes.find((axis) => axis.name.toLowerCase() === 'y')?.spacing ?? 1,
          unit: descriptor.axes.find((axis) => axis.name.toLowerCase() === 'y')?.unit ?? 'Pixels',
        },
      },
    }
  }

  loadPixelDescriptor(href: string, signal?: AbortSignal) {
    return loadPixelDescriptor(href, signal)
  }

  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    return loadCsv(url, signal)
  }

  async loadJson(url: URL, signal?: AbortSignal): Promise<unknown> {
    return loadJsonResource(url, signal)
  }

  async unloadImage(imageId: string): Promise<void> {
    if (!this.datasetId) throw new Error('No server dataset is open')
    const url = new URL(
      `/api/v2/datasets/${encodeURIComponent(this.datasetId)}/images/${encodeURIComponent(imageId)}/loaded-data`,
      this.serverUrl,
    )
    const response = await fetch(url, { method: 'DELETE' })
    if (!response.ok) throw new Error(`Could not unload image: HTTP ${response.status}`)
  }

  async close(): Promise<void> {
    if (!this.datasetId) return
    const datasetId = this.datasetId
    this.datasetId = null
    await fetch(new URL(`/api/v2/datasets/${encodeURIComponent(datasetId)}`, this.serverUrl), {
      method: 'DELETE',
    })
  }
}

export class ServerExportedDatasetSource extends ExportedDatasetSource {
  // Transitional Web Dataset v1 transport. Remove after AcqStore Server serves
  // the canonical multi-image OME-Zarr collection contract.
  override readonly persistInUrl = false
  private exportId: string | null = null
  private manifestUrl: URL | null = null

  constructor(private readonly serverUrl: string) {
    super('')
  }

  override async loadCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    const server = new URL(this.serverUrl)
    const response = await fetch(new URL('/api/v2/web-exports/pick', server), {
      method: 'POST',
      ...(signal ? { signal } : {}),
    })
    const opened = (await response.json()) as {
      ok: boolean
      exportId?: string
      manifestUrl?: string
      message?: string
      detail?: string
    }
    if (!response.ok || !opened.ok || !opened.exportId || !opened.manifestUrl) {
      throw new Error(opened.message ?? opened.detail ?? 'Could not open exported dataset folder')
    }
    this.exportId = opened.exportId
    this.manifestUrl = new URL(opened.manifestUrl, server)
    return loadDataset(this.manifestUrl, signal)
  }

  override refreshCollection(signal?: AbortSignal): Promise<LoadedDocument<AcqImageCollection>> {
    if (!this.manifestUrl) return Promise.reject(new Error('No exported dataset folder is open'))
    return loadDataset(this.manifestUrl, signal)
  }

  override async close(): Promise<void> {
    if (!this.exportId) return
    const exportId = this.exportId
    this.exportId = null
    await fetch(new URL(`/api/v2/web-exports/${encodeURIComponent(exportId)}`, this.serverUrl), {
      method: 'DELETE',
    })
  }
}

export class AcqImageCollectionSource implements ViewerDataSource {
  readonly canUnload = true
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
      loaded.manifest.acq_images.map((entry) => [entry.manifest_path, entry]),
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
      new URL('acqstore/acq_image_collection.json', this.rootUrl),
      signal ? { signal } : undefined,
    )
    if (!currentManifest.ok) {
      const legacyManifest = await this.localFetch(
        new URL('acqstore/manifest.json', this.rootUrl),
        signal ? { signal } : undefined,
      )
      if (legacyManifest.ok) {
        throw new Error(
          'This is a legacy AcqStore OME-Zarr collection; re-export it with the current AcqStore exporter.',
        )
      }
      throw new Error(
        'The selected directory is missing acqstore/acq_image_collection.json.',
      )
    }
    return super.loadCollection(signal)
  }
}
