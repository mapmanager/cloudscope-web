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
  type NativeAcqImageSidecar,
  type NativeImageManifest,
} from '../models/acqImageCollectionManifest'

async function loadJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, signal ? { signal } : undefined)
  if (!response.ok) throw new Error(`Could not load ${url.href}: HTTP ${response.status}`)
  try {
    return (await response.json()) as T
  } catch (reason) {
    throw new Error(`Could not parse JSON resource ${url.href}`, { cause: reason })
  }
}

function collectionRoot(url: string | URL): URL {
  const resolved = new URL(url, window.location.href)
  if (resolved.pathname.endsWith('/acqstore/acq_image_collection.json')) {
    return new URL('../../', resolved)
  }
  return new URL(resolved.href.replace(/\/?$/, '/'))
}

function assertRelativePath(value: string, label: string, url: URL): void {
  if (!value || value.startsWith('/') || value.split('/').includes('..')) {
    throw new Error(`${label} must be a collection-relative path in ${url.href}`)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidManifest(url: URL, path: string, message: string): never {
  throw new Error(`Invalid AcqStore OME-Zarr collection manifest at ${url.href}: ${path} ${message}`)
}

function requireField<T>(
  object: Record<string, unknown>,
  key: string,
  path: string,
  url: URL,
  guard: (value: unknown) => value is T,
  expectation: string,
): T {
  const value = object[key]
  if (!guard(value)) invalidManifest(url, `${path}.${key}`, `must be ${expectation}`)
  return value
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isInteger = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString)
const isIntegerArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isInteger)

function validateCollection(data: unknown, url: URL): asserts data is AcqImageCollectionManifest {
  if (!isObject(data)) invalidManifest(url, '$', 'must be an object')
  if (data.format !== 'acqstore-acq-image-collection') {
    invalidManifest(url, '$.format', "must equal 'acqstore-acq-image-collection'")
  }
  if (data.version !== ACQ_IMAGE_COLLECTION_VERSION) {
    throw new Error(
      `Unsupported AcqStore OME-Zarr collection version ${String(data.version)} at ${url.href}. ` +
        `CloudScope requires AcqImageCollection version ${ACQ_IMAGE_COLLECTION_VERSION}; ` +
        're-export with the current AcqStore exporter.',
    )
  }
  requireField(data, 'name', '$', url, isString, 'a string')
  if (data.zarr_format !== 3) invalidManifest(url, '$.zarr_format', 'must equal 3')
  requireField(data, 'created_utc', '$', url, isString, 'a string')
  requireField(data, 'acqstore_version', '$', url, isString, 'a string')
  const images = data.acq_images
  if (!Array.isArray(images)) invalidManifest(url, '$.acq_images', 'must be an array')
  const ids = new Set<string>()
  const paths = new Set<string>()
  images.forEach((raw, index) => {
    const path = `$.acq_images[${index}]`
    if (!isObject(raw)) invalidManifest(url, path, 'must be an object')
    const id = requireField(raw, 'id', path, url, isString, 'a string')
    if (!id || ids.has(id)) invalidManifest(url, `${path}.id`, 'must be unique and non-empty')
    ids.add(id)
    requireField(raw, 'name', path, url, isString, 'a string')
    const source = requireField(raw, 'source', path, url, isObject, 'an object')
    const nullableString = (value: unknown): value is string | null => value === null || isString(value)
    requireField(source, 'filename', `${path}.source`, url, nullableString, 'a string or null')
    requireField(source, 'relative_path', `${path}.source`, url, nullableString, 'a string or null')
    const imagePath = requireField(raw, 'ome_zarr_path', path, url, isString, 'a string')
    const sidecar = requireField(raw, 'sidecar_path', path, url, isString, 'a string')
    const nativeManifest = requireField(
      raw, 'manifest_path', path, url, isString, 'a string',
    )
    assertRelativePath(imagePath, `Image ${id} path`, url)
    if (paths.has(imagePath)) invalidManifest(url, `${path}.ome_zarr_path`, 'must be unique')
    paths.add(imagePath)
    assertRelativePath(sidecar, `Image ${id} sidecar`, url)
    assertRelativePath(nativeManifest, `Image ${id} native manifest`, url)
    if (raw.reference_image_path !== undefined) {
      if (!isString(raw.reference_image_path)) {
        invalidManifest(url, `${path}.reference_image_path`, 'must be a string')
      }
      assertRelativePath(raw.reference_image_path, `Image ${id} reference image`, url)
    }
    const summary = requireField(raw, 'summary', path, url, isObject, 'an object')
    requireField(summary, 'shape', `${path}.summary`, url, isIntegerArray, 'an integer array')
    requireField(summary, 'dims', `${path}.summary`, url, isStringArray, 'a string array')
    requireField(summary, 'sizes', `${path}.summary`, url, isObject, 'an object')
    requireField(summary, 'dtype', `${path}.summary`, url, isString, 'a string')
    requireField(summary, 'num_channels', `${path}.summary`, url, isInteger, 'an integer')
    requireField(summary, 'num_rois', `${path}.summary`, url, isInteger, 'an integer')
    requireField(
      summary, 'analysis_types', `${path}.summary`, url, isStringArray, 'a string array',
    )
    requireField(summary, 'acquisition', `${path}.summary`, url, isObject, 'an object')
    requireField(summary, 'accepted', `${path}.summary`, url, isBoolean, 'a boolean')
    requireField(
      summary, 'has_reference_image', `${path}.summary`, url, isBoolean, 'a boolean',
    )
  })
  const analysisTables = requireField(
    data,
    'analysis_tables',
    '$',
    url,
    isObject,
    'an object',
  )
  for (const [name, tablePath] of Object.entries(analysisTables)) {
    if (!isString(tablePath)) invalidManifest(url, `$.analysis_tables.${name}`, 'must be a string')
    assertRelativePath(tablePath, `Analysis table ${name}`, url)
  }
}

function indexRow(entry: AcqImageCollectionEntry): AcqImageCollectionRow {
  const summary = entry.summary
  return {
    id: entry.id,
    name: entry.name || entry.source.filename || entry.id,
    href: entry.manifest_path,
    shape: summary.shape,
    dims: summary.dims,
    sizes: summary.sizes,
    dtype: summary.dtype,
    axes: summary.dims.map((name, index) => ({
      name,
      size: summary.shape[index] ?? 0,
      spacing: 1,
      unit: 'Pixels',
    })),
    acquisition: summary.acquisition,
    num_channels: summary.num_channels,
    num_rois: summary.num_rois,
    analysis_types: summary.analysis_types,
    accepted: summary.accepted,
    has_reference_image: summary.has_reference_image,
    load_state: { pixels: false, analysisCsv: false },
  }
}

export async function loadAcqImageCollection(
  url: string | URL,
  signal?: AbortSignal,
): Promise<LoadedDocument<AcqImageCollection> & { manifest: AcqImageCollectionManifest }> {
  const root = collectionRoot(url)
  const manifestUrl = new URL('acqstore/acq_image_collection.json', root)
  const manifest = await loadJson<unknown>(manifestUrl, signal)
  validateCollection(manifest, manifestUrl)
  return {
    data: {
      id: root.href,
      name: manifest.name,
      acqstore_version: manifest.acqstore_version,
      created_utc: manifest.created_utc,
      analysis_tables: { ...manifest.analysis_tables },
      acq_images: manifest.acq_images.map(indexRow),
    },
    url: root,
    manifest,
  }
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRois(rois: Array<Record<string, unknown>>): Roi[] {
  return rois.flatMap((roi): Roi[] => {
    const data = roi.data as Record<string, unknown> | undefined
    if (roi.roi_type === 'rectroi' && data) {
      return [{
        id: numberValue(roi.roi_id), type: 'rect', name: String(roi.name ?? ''),
        note: String(roi.note ?? ''), x_start: numberValue(data.col_start),
        x_stop: numberValue(data.col_stop), y_start: numberValue(data.row_start),
        y_stop: numberValue(data.row_stop),
      }]
    }
    if (roi.roi_type === 'linesegmentroi' && data) {
      return [{
        id: numberValue(roi.roi_id), type: 'line', name: String(roi.name ?? ''),
        note: String(roi.note ?? ''), x0: numberValue(data.col0), y0: numberValue(data.row0),
        x1: numberValue(data.col1), y1: numberValue(data.row1),
      }]
    }
    return []
  })
}

function channels(count: number, contrast: Record<string, unknown>): ImageChannel[] {
  return Array.from({ length: count }, (_, index) => {
    const value = contrast[String(index)]
    return { index, contrast: typeof value === 'object' && value !== null ? value as never : null }
  })
}

function scanPath(metadata: Record<string, unknown>): ReferenceImageResource['scan_path'] {
  if (metadata.has_scan_path === false) return null
  if (metadata.has_scan_path !== true) {
    throw new Error('Reference image metadata has invalid has_scan_path')
  }
  const x = metadata.scan_path_x_pixels
  const y = metadata.scan_path_y_pixels
  const count = metadata.scan_path_num_points
  if (
    !Array.isArray(x) || !Array.isArray(y) ||
    !x.every((value) => typeof value === 'number' && Number.isFinite(value)) ||
    !y.every((value) => typeof value === 'number' && Number.isFinite(value)) ||
    x.length !== y.length || count !== x.length || x.length !== 2
  ) {
    throw new Error('Reference image metadata has an invalid scan path')
  }
  return { x_pixels: x, y_pixels: y }
}

export async function loadAcqImageCollectionEntry(
  root: URL,
  entry: AcqImageCollectionEntry,
  signal?: AbortSignal,
): Promise<LoadedDocument<AcqImageDocument>> {
  const manifestUrl = new URL(entry.manifest_path, root)
  const manifest = await loadJson<NativeImageManifest>(manifestUrl, signal)
  if (manifest.format !== 'acqstore-native-ome-zarr' || manifest.version !== 2) {
    throw new Error(`Image ${entry.id} does not have an AcqStore native manifest v2`)
  }
  const childRoot = new URL(`${entry.ome_zarr_path.replace(/\/$/, '')}/`, root)
  const sidecar = await loadJson<NativeAcqImageSidecar>(new URL(entry.sidecar_path, root), signal)
  const summaries = new Map(
    sidecar.analysis.map((item) => [
      `${item.analysis_name}|${item.channel}|${item.roi_id}`,
      item,
    ]),
  )
  const analyses: ExportedAnalysis[] = manifest.analyses.map((item) => {
    const native = summaries.get(`${item.analysis_name}|${item.channel}|${item.roi_id}`)
    const tableHref = item.resources.table
      ? new URL(item.resources.table, childRoot).href
      : null
    const peaksHref = item.resources.peaks
      ? new URL(item.resources.peaks, childRoot).href
      : null
    return {
      id: item.id,
      analysis_type: item.analysis_name,
      display_name: item.analysis_name.replaceAll('_', ' '),
      channel: item.channel,
      roi_id: item.roi_id,
      summary: native?.summary ?? {},
      detection_params: native?.detection_params ?? {},
      table: tableHref ? { href: tableHref } : null,
      plot: null,
      resources: {
        table: tableHref ? { href: tableHref } : null,
        peaks: peaksHref ? { href: peaksHref } : null,
      },
    }
  })
  const summary = entry.summary
  let referenceImage: ReferenceImageResource | null = null
  if (summary.has_reference_image) {
    if (!entry.reference_image_path || !manifest.reference_image) {
      throw new Error(`Image ${entry.id} declares a reference image without its resource path`)
    }
    const collectionHref = new URL(`${entry.reference_image_path.replace(/\/$/, '')}/`, root).href
    const nativeHref = new URL(`${manifest.reference_image.replace(/\/$/, '')}/`, childRoot).href
    if (collectionHref !== nativeHref) {
      throw new Error(`Image ${entry.id} has conflicting reference image paths`)
    }
    const metadata = sidecar.reference_image_metadata
    if (!metadata) throw new Error(`Image ${entry.id} is missing reference image metadata`)
    const numChannels = metadata.num_channels
    if (!Number.isInteger(numChannels) || Number(numChannels) < 1) {
      throw new Error(`Image ${entry.id} has an invalid reference channel count`)
    }
    referenceImage = {
      href: collectionHref,
      metadata,
      num_channels: Number(numChannels),
      scan_path: scanPath(metadata),
    }
  } else if (entry.reference_image_path || manifest.reference_image) {
    throw new Error(`Image ${entry.id} has a reference resource but reports none in its summary`)
  }
  return {
    data: {
      format: 'acqstore-web-acqimage',
      format_version: 1,
      id: entry.id,
      name: entry.name || entry.source.filename || entry.id,
      accepted: sidecar.accepted,
      image: {
        href: childRoot.href,
        shape: summary.shape,
        dims: summary.dims,
        sizes: summary.sizes,
        dtype: summary.dtype,
        axes: summary.dims.map((name, index) => ({
          name, size: summary.shape[index] ?? 0, spacing: 1, unit: 'Pixels',
        })),
        num_channels: summary.num_channels,
        default_channel: 0,
        channels: channels(summary.num_channels, sidecar.image_contrast),
        acquisition: summary.acquisition,
      },
      rois: normalizeRois(sidecar.rois),
      analyses,
      metadata: {
        image_header: sidecar.image_header_metadata,
        experiment: sidecar.experiment_metadata ?? {},
        reference_image: sidecar.reference_image_metadata ?? {},
      },
      reference_image: referenceImage,
      load_state: { pixels: false, analysisCsv: false },
    },
    url: manifestUrl,
  }
}
