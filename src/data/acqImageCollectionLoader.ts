import type {
  AcqImageDocument,
  AcqImageCollection,
  AcqImageCollectionRow,
  ExportedAnalysis,
  ImageChannel,
  LoadedDocument,
  Roi,
  ReferenceImageResource,
} from '../models/acqImageModels'
import {
  ACQ_IMAGE_COLLECTION_VERSION,
  type AcqImageCollectionEntry,
  type AcqImageCollectionManifest,
  type AcqImageSidecar,
  type AnalysesDocument,
  type CollectionAnalysis,
  type CollectionRoi,
  type ReferenceImageDocument,
} from '../models/acqImageCollectionManifest'
import type { ResourceFetch } from './browserDirectory'
import { loadPixelDescriptor } from './omeZarrLoader'

async function loadJson<T>(
  url: URL,
  signal?: AbortSignal,
  resourceFetch: ResourceFetch = fetch,
): Promise<T> {
  const response = await resourceFetch(url, signal ? { signal } : undefined)
  if (!response.ok) throw new Error(`Could not load ${url.href}: HTTP ${response.status}`)
  try {
    return (await response.json()) as T
  } catch (reason) {
    throw new Error(`Could not parse JSON resource ${url.href}`, { cause: reason })
  }
}

function collectionRoot(url: string | URL): URL {
  const resolved = new URL(url, window.location.href)
  if (resolved.pathname.endsWith('/acqstore/collection.json')) return new URL('../../', resolved)
  return new URL(resolved.href.replace(/\/?$/, '/'))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidManifest(url: URL, path: string, message: string): never {
  throw new Error(`Invalid AcqStore OME-Zarr Collection v1 at ${url.href}: ${path} ${message}`)
}

function assertRelativePath(value: unknown, label: string, url: URL): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    value.split('/').some((part) => part === '.' || part === '..')
  ) {
    invalidManifest(url, label, 'must be a collection-relative path')
  }
}

function validateCollection(data: unknown, url: URL): asserts data is AcqImageCollectionManifest {
  if (!isObject(data)) invalidManifest(url, '$', 'must be an object')
  if (data.format !== 'acqstore-ome-zarr-collection') {
    invalidManifest(url, '$.format', "must equal 'acqstore-ome-zarr-collection'")
  }
  if (data.version !== ACQ_IMAGE_COLLECTION_VERSION) {
    throw new Error(`Unsupported AcqStore OME-Zarr Collection version ${String(data.version)}`)
  }
  if (typeof data.id !== 'string' || !data.id) invalidManifest(url, '$.id', 'must be a string')
  if (typeof data.name !== 'string') invalidManifest(url, '$.name', 'must be a string')
  if (!Array.isArray(data.members)) invalidManifest(url, '$.members', 'must be an array')
  const ids = new Set<string>()
  for (const [index, raw] of data.members.entries()) {
    const path = `$.members[${index}]`
    if (!isObject(raw)) invalidManifest(url, path, 'must be an object')
    if (typeof raw.id !== 'string' || !raw.id || ids.has(raw.id)) {
      invalidManifest(url, `${path}.id`, 'must be unique and non-empty')
    }
    ids.add(raw.id)
    if (typeof raw.name !== 'string') invalidManifest(url, `${path}.name`, 'must be a string')
    assertRelativePath(raw.ome_zarr, `${path}.ome_zarr`, url)
    if (!isObject(raw.resources)) invalidManifest(url, `${path}.resources`, 'must be an object')
    assertRelativePath(raw.resources.acqimage, `${path}.resources.acqimage`, url)
    if (raw.resources.analyses !== undefined) {
      assertRelativePath(raw.resources.analyses, `${path}.resources.analyses`, url)
    }
    if (raw.reference_image !== undefined) {
      if (!isObject(raw.reference_image)) {
        invalidManifest(url, `${path}.reference_image`, 'must be an object')
      }
      assertRelativePath(raw.reference_image.ome_zarr, `${path}.reference_image.ome_zarr`, url)
      assertRelativePath(raw.reference_image.metadata, `${path}.reference_image.metadata`, url)
    }
  }
  const tables = isObject(data.resources) ? data.resources.tables : undefined
  if (tables !== undefined) {
    if (!Array.isArray(tables)) invalidManifest(url, '$.resources.tables', 'must be an array')
    const tableIds = new Set<string>()
    for (const [index, raw] of tables.entries()) {
      const path = `$.resources.tables[${index}]`
      if (!isObject(raw)) invalidManifest(url, path, 'must be an object')
      if (typeof raw.id !== 'string' || !raw.id || tableIds.has(raw.id)) {
        invalidManifest(url, `${path}.id`, 'must be unique and non-empty')
      }
      tableIds.add(raw.id)
      if (raw.media_type !== 'text/csv') {
        invalidManifest(url, `${path}.media_type`, "must equal 'text/csv'")
      }
      assertRelativePath(raw.path, `${path}.path`, url)
    }
  }
}

function indexRow(entry: AcqImageCollectionEntry): AcqImageCollectionRow {
  const summary = entry.summary ?? {}
  const shape = Array.isArray(summary.shape) ? summary.shape : []
  const dims = Array.isArray(summary.dims) ? summary.dims : []
  return {
    id: entry.id,
    name: entry.name,
    href: entry.resources.acqimage,
    shape,
    dims,
    sizes: Object.fromEntries(dims.map((name, index) => [name, shape[index] ?? 0])),
    dtype: typeof summary.dtype === 'string' ? summary.dtype : '',
    axes: dims.map((name, index) => ({
      name,
      size: shape[index] ?? 0,
      spacing: 1,
      unit: 'Pixels',
    })),
    acquisition: { date: '', time: '' },
    num_channels: Number.isInteger(summary.num_channels) ? Number(summary.num_channels) : 0,
    num_rois: Number.isInteger(summary.num_rois) ? Number(summary.num_rois) : 0,
    analysis_types: Array.isArray(summary.analysis_types) ? summary.analysis_types : [],
    accepted: summary.accepted === true,
    has_reference_image: entry.reference_image !== undefined,
    load_state: { pixels: false, analysisCsv: false },
  }
}

export async function loadAcqImageCollection(
  url: string | URL,
  signal?: AbortSignal,
  resourceFetch: ResourceFetch = fetch,
): Promise<LoadedDocument<AcqImageCollection> & { manifest: AcqImageCollectionManifest }> {
  const root = collectionRoot(url)
  const manifestUrl = new URL('acqstore/collection.json', root)
  const manifest = await loadJson<unknown>(manifestUrl, signal, resourceFetch)
  validateCollection(manifest, manifestUrl)
  return {
    data: {
      id: manifest.id,
      name: manifest.name,
      acqstore_version: manifest.producer?.version ?? '',
      created_utc: manifest.created ?? '',
      analysis_tables: Object.fromEntries(
        (manifest.resources?.tables ?? []).map((table) => [table.id, { csv: table.path }]),
      ),
      acq_images: manifest.members.map(indexRow),
    },
    url: root,
    manifest,
  }
}

function normalizeRoi(roi: CollectionRoi): Roi {
  const name = roi.name ?? ''
  const note = typeof roi.metadata?.note === 'string' ? roi.metadata.note : ''
  if (roi.type === 'rectangle' && roi.start && roi.stop) {
    return {
      id: roi.id,
      type: 'rect',
      name,
      note,
      x_start: roi.start[0],
      y_start: roi.start[1],
      x_stop: roi.stop[0],
      y_stop: roi.stop[1],
    }
  }
  if (roi.type === 'line' && roi.start && roi.stop) {
    return {
      id: roi.id,
      type: 'line',
      name,
      note,
      x0: roi.start[0],
      y0: roi.start[1],
      x1: roi.stop[0],
      y1: roi.stop[1],
    }
  }
  throw new Error(`CloudScope does not support Collection v1 ROI type ${roi.type}`)
}

function normalizeAnalysis(item: CollectionAnalysis, root: URL): ExportedAnalysis {
  const table = item.resources.find(
    (resource) => resource.id === 'table' && resource.media_type === 'text/csv',
  )
  const tableHref = table ? new URL(table.path, root).href : null
  return {
    id: item.id,
    analysis_type: item.type,
    display_name: item.type.replaceAll('_', ' '),
    channel: item.channel ?? 0,
    roi_id: item.roi_id ?? null,
    summary: item.summary ?? {},
    detection_params: item.parameters ?? {},
    table: tableHref ? { href: tableHref } : null,
    plot: null,
    resources: { table: tableHref ? { href: tableHref } : null, peaks: null },
  }
}

function channels(count: number): ImageChannel[] {
  return Array.from({ length: count }, (_, index) => ({ index, contrast: null }))
}

function assertLinkedDocument(
  document: { format: string; version: number; image_id: string },
  format: string,
  imageId: string,
  url: URL,
): void {
  if (document.format !== format || document.version !== 1) {
    throw new Error(`Invalid ${format} document at ${url.href}`)
  }
  if (document.image_id !== imageId) {
    throw new Error(`${format} image_id does not match member ${imageId}`)
  }
}

export async function loadAcqImageCollectionEntry(
  root: URL,
  entry: AcqImageCollectionEntry,
  signal?: AbortSignal,
  resourceFetch: ResourceFetch = fetch,
): Promise<LoadedDocument<AcqImageDocument>> {
  const sidecarUrl = new URL(entry.resources.acqimage, root)
  const sidecar = await loadJson<AcqImageSidecar>(sidecarUrl, signal, resourceFetch)
  assertLinkedDocument(sidecar, 'acqstore-acqimage', entry.id, sidecarUrl)
  const imageHref = new URL(`${entry.ome_zarr.replace(/\/$/, '')}/`, root).href
  const pixel = await loadPixelDescriptor(imageHref, signal, resourceFetch)
  const axes = pixel.axes.map((axis) => {
    const override = sidecar.axis_display?.[axis.name]
    return override ? { ...axis, spacing: override.scale, unit: override.unit } : axis
  })
  let analyses: ExportedAnalysis[] = []
  if (entry.resources.analyses) {
    const analysesUrl = new URL(entry.resources.analyses, root)
    const document = await loadJson<AnalysesDocument>(analysesUrl, signal, resourceFetch)
    assertLinkedDocument(document, 'acqstore-analyses', entry.id, analysesUrl)
    analyses = document.analyses.map((item) => normalizeAnalysis(item, root))
  }

  let referenceImage: ReferenceImageResource | null = null
  let referenceMetadata: Record<string, unknown> = {}
  if (entry.reference_image) {
    const metadataUrl = new URL(entry.reference_image.metadata, root)
    const document = await loadJson<ReferenceImageDocument>(metadataUrl, signal, resourceFetch)
    assertLinkedDocument(document, 'acqstore-reference-image', entry.id, metadataUrl)
    const href = new URL(`${entry.reference_image.ome_zarr.replace(/\/$/, '')}/`, root).href
    const descriptor = await loadPixelDescriptor(href, signal, resourceFetch)
    referenceMetadata = document.metadata ?? {}
    referenceImage = {
      href,
      metadata: referenceMetadata,
      num_channels: descriptor.num_channels,
      scan_path: document.scan_path
        ? {
            x_pixels: document.scan_path.points.map(([x]) => x),
            y_pixels: document.scan_path.points.map(([, y]) => y),
          }
        : null,
    }
  }

  const imageMetadata = sidecar.image_metadata ?? {}
  return {
    data: {
      format: 'acqstore-web-acqimage',
      format_version: 1,
      id: entry.id,
      name: entry.name,
      accepted: sidecar.accepted,
      image: {
        href: imageHref,
        ...pixel,
        axes,
        default_channel: 0,
        channels: channels(pixel.num_channels),
        acquisition: {
          date: typeof imageMetadata.date === 'string' ? imageMetadata.date : '',
          time: typeof imageMetadata.time === 'string' ? imageMetadata.time : '',
        },
      },
      rois: sidecar.rois.map(normalizeRoi),
      analyses,
      metadata: {
        image_header: imageMetadata,
        experiment: sidecar.experiment_metadata ?? {},
        reference_image: referenceMetadata,
      },
      reference_image: referenceImage,
      load_state: { pixels: false, analysisCsv: false },
    },
    url: sidecarUrl,
  }
}
