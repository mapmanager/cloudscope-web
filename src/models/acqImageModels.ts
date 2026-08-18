/** Physical and display metadata for one AcqImage axis. */
export interface AxisDescriptor {
  name: string
  size: number
  spacing: number
  unit: string
}

export interface AcquisitionDescriptor {
  date: string
  time: string
}

/** Lightweight AcqImage row displayed before the full member is loaded. */
export interface AcqImageCollectionRow {
  id: string
  name: string
  href: string
  shape: number[]
  dims: string[]
  sizes: Record<string, number>
  dtype: string
  axes: AxisDescriptor[]
  acquisition: AcquisitionDescriptor
  num_channels: number
  num_rois: number
  analysis_types: string[]
  accepted: boolean
  has_reference_image: boolean
  load_state?: LoadState
}

export interface LoadState {
  pixels: boolean
  analysisCsv: boolean
}

/** Canonical browser model for an opened collection of acquisition images. */
export interface AcqImageCollection {
  id: string
  name: string
  acqstore_version: string
  created_utc: string
  acq_images: AcqImageCollectionRow[]
}

export interface ImageContrast {
  color_lut: string
  value_min: number
  value_max: number
  img_min: number
  img_max: number
}

export interface ImageChannel {
  index: number
  contrast: ImageContrast | null
}

export interface PixelDescriptor {
  href: string
  shape: number[]
  dims: string[]
  sizes: Record<string, number>
  dtype: string
  axes: AxisDescriptor[]
  num_channels: number
}

export interface PrimaryImageDescriptor extends PixelDescriptor {
  default_channel: number
  channels: ImageChannel[]
  acquisition: AcquisitionDescriptor
}

export interface RectRoi {
  id: number
  type: 'rect'
  name: string
  note: string
  x_start: number
  x_stop: number
  y_start: number
  y_stop: number
}

export interface LineRoi {
  id: number
  type: 'line'
  name: string
  note: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export type Roi = RectRoi | LineRoi

export interface ResourceLink {
  href: string
}

export interface AnalysisPlotResource extends ResourceLink {
  x_column: string
  y_column: string
  x_label: string
  y_label: string
  series_name: string
}

export interface AnalysisPeakResource extends ResourceLink {
  count: number
}

export interface ExportedAnalysis {
  id: string
  analysis_type: string
  display_name: string
  channel: number
  roi_id: number
  summary: Record<string, unknown>
  table: ResourceLink | null
  plot: AnalysisPlotResource | null
  peaks?: AnalysisPeakResource
  resources?: {
    table: ResourceLink | null
    peaks: ResourceLink | null
  }
  detection_params?: Record<string, unknown>
}

export interface ReferenceImageDescriptor extends PixelDescriptor {
  metadata: Record<string, unknown>
}

export interface AcqImageDocument {
  format: 'acqstore-web-acqimage'
  format_version: 1
  id: string
  name: string
  accepted: boolean
  image: PrimaryImageDescriptor
  rois: Roi[]
  analyses: ExportedAnalysis[]
  metadata: Record<string, Record<string, unknown>>
  reference_image: ReferenceImageDescriptor | null
  load_state?: LoadState
}

export interface LoadedDocument<T> {
  data: T
  url: URL
}
