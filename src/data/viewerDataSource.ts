import { loadCsv, type CsvTable } from './csvLoader'
import { loadAcqImage, loadDataset } from './datasetLoader'
import { loadImagePlane, type ImagePlane, type PlaneIndices } from './omeZarrLoader'
import { loadOmeZarrCollection, loadOmeZarrCollectionImage } from './omeZarrCollectionLoader'
import type { CollectionImageEntry } from '../models/omeZarrCollection'
import type {
  AcqImageDocument,
  LoadedDocument,
  PixelDescriptor,
  WebDataset,
} from '../models/webDataset'

export type LocalOpenKind = 'file' | 'folder' | 'csv'

export interface ViewerDataSource {
  readonly canUnload: boolean
  readonly persistInUrl: boolean
  readonly refreshAfterUnload: boolean
  loadDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>>
  refreshDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>>
  loadImage(
    datasetUrl: URL,
    href: string,
    signal?: AbortSignal,
  ): Promise<LoadedDocument<AcqImageDocument>>
  loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane>
  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable>
  unloadImage(imageId: string): Promise<void>
  close(): Promise<void>
}

export class ExportedDatasetSource implements ViewerDataSource {
  readonly canUnload = false
  readonly persistInUrl: boolean = true
  readonly refreshAfterUnload = false
  constructor(private readonly datasetUrl: string) {}

  loadDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
    return loadDataset(this.datasetUrl, signal)
  }

  refreshDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
    return this.loadDataset(signal)
  }

  loadImage(datasetUrl: URL, href: string, signal?: AbortSignal) {
    return loadAcqImage(datasetUrl, href, signal)
  }

  loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    return loadImagePlane(descriptor, documentUrl, indices, signal)
  }

  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    return loadCsv(url, signal)
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

  async loadDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
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

  refreshDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
    if (!this.manifestUrl) return Promise.reject(new Error('No server dataset is open'))
    return loadDataset(this.manifestUrl, signal)
  }

  loadImage(datasetUrl: URL, href: string, signal?: AbortSignal) {
    return loadAcqImage(datasetUrl, href, signal)
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
    }
  }

  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    return loadCsv(url, signal)
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

  override async loadDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
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

  override refreshDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
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

export class OmeZarrCollectionSource implements ViewerDataSource {
  readonly canUnload = true
  readonly persistInUrl = true
  readonly refreshAfterUnload = false
  private entries = new Map<string, CollectionImageEntry>()

  constructor(private readonly collectionUrl: string) {}

  async loadDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
    const loaded = await loadOmeZarrCollection(this.collectionUrl, signal)
    this.entries = new Map(loaded.manifest.images.map((entry) => [entry.native_manifest, entry]))
    return loaded
  }

  refreshDataset(signal?: AbortSignal): Promise<LoadedDocument<WebDataset>> {
    return this.loadDataset(signal)
  }

  loadImage(datasetUrl: URL, href: string, signal?: AbortSignal) {
    const entry = this.entries.get(href)
    if (!entry) return Promise.reject(new Error(`Unknown collection image manifest: ${href}`))
    return loadOmeZarrCollectionImage(datasetUrl, entry, signal)
  }

  loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    return loadImagePlane(descriptor, documentUrl, indices, signal)
  }

  loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    return loadCsv(url, signal)
  }

  async unloadImage(): Promise<void> {}

  async close(): Promise<void> {
    this.entries.clear()
  }
}
