export interface CollectionImageSummary {
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

export interface CollectionImageEntry {
  id: string
  name: string
  source: { filename: string | null; relative_path: string | null }
  path: string
  sidecar: string
  native_manifest: string
  reference_image?: string
  summary: CollectionImageSummary
}

export interface OmeZarrCollectionManifest {
  format: 'acqstore-multi-image-ome-zarr'
  version: 2
  zarr_format: 3
  name: string
  created_utc: string
  acqstore_version: string
  images: CollectionImageEntry[]
  tables: Record<string, string>
}

export interface AnalysisResourceEntry {
  id: string
  analysis_name: string
  channel: number
  roi_id: number
  resources: { table: string | null; peaks: string | null }
}

export interface NativeImageManifest {
  format: 'acqstore-native-ome-zarr'
  version: 2
  image_group: string
  sidecar: string
  reference_image?: string
  analyses: AnalysisResourceEntry[]
}

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
  reference_image_metadata: Record<string, unknown>
  rois: Array<Record<string, unknown>>
}
