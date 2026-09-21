/** Optional discovery fields emitted for one collection member. */
export interface AcqImageSummary {
  shape?: number[]
  dims?: string[]
  dtype?: string
  num_channels?: number
  num_rois?: number
  analysis_types?: string[]
  accepted?: boolean
  has_reference_image?: boolean
}

/** Explicit resources owned by one Collection v1 member. */
export interface AcqImageMemberResources {
  acqimage: string
  analyses?: string
}

/** Optional reference image declared by one member. */
export interface ReferenceImageLink {
  ome_zarr: string
  metadata: string
}

/** One member declared by AcqStore OME-Zarr Collection v1. */
export interface AcqImageCollectionEntry {
  id: string
  name: string
  ome_zarr: string
  resources: AcqImageMemberResources
  reference_image?: ReferenceImageLink
  summary?: AcqImageSummary
}

export const ACQ_IMAGE_COLLECTION_VERSION = 1 as const

/** One collection-level analysis CSV. */
export interface AnalysisTableDescriptor {
  csv: string
}

export interface CollectionCsvResource {
  id: string
  media_type: 'text/csv'
  path: string
}

/** AcqStore OME-Zarr Collection v1 discovery document. */
export interface AcqImageCollectionManifest {
  format: 'acqstore-ome-zarr-collection'
  version: typeof ACQ_IMAGE_COLLECTION_VERSION
  id: string
  name: string
  created?: string
  producer?: { name: string; version?: string }
  members: AcqImageCollectionEntry[]
  resources?: { tables?: CollectionCsvResource[] }
  metadata?: Record<string, unknown>
}

export interface CollectionRoi {
  id: number
  type: 'point' | 'line' | 'rectangle'
  coordinate_space: 'primary-image-full-resolution-pixels'
  name?: string
  metadata?: Record<string, unknown>
  position?: [number, number]
  start?: [number, number]
  stop?: [number, number]
}

export interface AcqImageSidecar {
  format: 'acqstore-acqimage'
  version: 1
  image_id: string
  accepted: boolean
  rois: CollectionRoi[]
  experiment_metadata?: Record<string, unknown>
  image_metadata?: Record<string, unknown>
  axis_display?: Record<string, { type: string; unit: string; scale: number }>
}

export interface AnalysisResource {
  id: string
  media_type: 'text/csv'
  path: string
}

export interface CollectionAnalysis {
  id: string
  type: string
  roi_id?: number
  channel?: number
  parameters?: Record<string, unknown>
  summary?: Record<string, unknown>
  resources?: AnalysisResource[]
}

export interface AnalysesDocument {
  format: 'acqstore-analyses'
  version: 1
  image_id: string
  analyses: CollectionAnalysis[]
}

export interface ReferenceImageDocument {
  format: 'acqstore-reference-image'
  version: 1
  image_id: string
  metadata?: Record<string, unknown>
  scan_path?: {
    coordinate_space: 'reference-image-full-resolution-pixels'
    points: Array<[number, number]>
  }
}
