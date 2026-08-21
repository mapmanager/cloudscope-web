/** Denormalized fields used to build one collection-table row. */
export interface AcqImageSummary {
  shape: number[]
  dims: string[]
  sizes: Record<string, number>
  dtype: string
  num_channels: number
  num_rois: number
  analysis_types: string[]
  acquisition: { date: string; time: string }
  accepted: boolean
  has_reference_image: boolean
}

/** One AcqImage member declared by an AcqImageCollection manifest. */
export interface AcqImageCollectionEntry {
  id: string
  name: string
  source: { filename: string | null; relative_path: string | null }
  ome_zarr_path: string
  sidecar_path: string
  manifest_path: string
  reference_image_path?: string
  summary: AcqImageSummary
}

export const ACQ_IMAGE_COLLECTION_VERSION = 1 as const

/** AcqStore-owned wrapper manifest around independent native OME-Zarr images. */
export interface AcqImageCollectionManifest {
  format: 'acqstore-acq-image-collection'
  version: typeof ACQ_IMAGE_COLLECTION_VERSION
  zarr_format: 3
  name: string
  created_utc: string
  acqstore_version: string
  acq_images: AcqImageCollectionEntry[]
  analysis_tables: Record<string, string>
}

export interface AnalysisResourceEntry {
  id: string
  analysis_name: string
  channel: number
  roi_id: number
  resources: { table: string | null; peaks: string | null }
}

/** Existing native single-AcqImage manifest; collection export must not alter it. */
export interface NativeImageManifest {
  format: 'acqstore-native-ome-zarr'
  version: 2
  image_group: string
  sidecar: string
  reference_image?: string
  analyses: AnalysisResourceEntry[]
}

/** Existing AcqImage sidecar stored inside each independent child image. */
export interface NativeAcqImageSidecar {
  accepted: boolean
  analysis: Array<{
    analysis_name: string
    channel: number
    roi_id: number
    summary: Record<string, unknown>
    detection_params: Record<string, unknown>
  }>
  image_contrast: Record<string, unknown>
  image_header_metadata: Record<string, unknown>
  experiment_metadata?: Record<string, unknown>
  reference_image_metadata?: Record<string, unknown>
  rois: Array<Record<string, unknown>>
}
