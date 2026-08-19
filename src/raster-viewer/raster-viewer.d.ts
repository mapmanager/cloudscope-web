/** Public RasterViewer API used by the CloudScope Web Vue wrapper. */

export const RASTER_DESCRIPTOR_SCHEMA_VERSION: '2.0'

export interface RasterAxis {
  label: string
  step: number
  unit: string
}

export interface RasterChannelDisplay {
  lut: string
  value_min: number | null
  value_max: number | null
  visible: boolean
}

export interface RasterChannelResource {
  id: string
  index: number
  label: string
  dtype: string
  encoding: string
  byte_length: number
  display: RasterChannelDisplay
  data_url: string
}

export interface RasterDescriptor {
  schema_version: '2.0'
  id: string
  label: string
  header: {
    dims: Array<'Y' | 'X' | 'Z' | 'T'>
    sizes: Record<string, number>
    dtype: string
    num_channels: number
    physical_units: number[]
    physical_units_labels: string[]
  }
  width: number
  height: number
  layout: 'row-major'
  endianness: 'little'
  display_orientation: { transpose: true; flip_y: true }
  axes: { x: RasterAxis; y: RasterAxis }
  rois: unknown[]
  channels: RasterChannelResource[]
}

export interface RasterPlaneSelection {
  t_index: number | null
  z_index: number | null
  plus_minus_z: number
}

export interface RasterChannelRef {
  id: string
  index: number
  dtype: string
}

export type LoadSourcePlane = (
  channel: RasterChannelRef,
  selection: RasterPlaneSelection,
  signal?: AbortSignal,
) => Promise<ArrayLike<number>>

export interface RasterViewerOptions {
  theme?: 'light' | 'dark'
  invertSliceWheel?: boolean
  wheelZoomFactor?: number
  roiHostMode?: 'local' | 'delegated'
  roiToolbarVisible?: boolean
  roiChromeEnabled?: boolean
  hostClipboardBridge?: boolean
  loadSourcePlane?: LoadSourcePlane
}

export interface RasterPhysicalRange {
  minimum: number
  maximum: number
  label: string
  unit: string
}

export class RasterViewer {
  host: HTMLElement
  loadSourcePlane: LoadSourcePlane | null
  displayAxes: { x: RasterAxis; y: RasterAxis } | null
  displayWidth: number
  displayHeight: number

  constructor(host: HTMLElement, options?: RasterViewerOptions)
  load(descriptor: RasterDescriptor): Promise<void>
  setXRange(minimum: number, maximum: number): { minimum: number; maximum: number } | null
  resetXRange(): { minimum: number; maximum: number } | null
  resetView(): boolean
  setZIndex(zIndex: number): Promise<RasterPlaneSelection>
  setTIndex(tIndex: number): Promise<RasterPlaneSelection>
  selectChannel(channelId: string, notify?: boolean): string
  setRois(envelopes: unknown[]): number
  selectRoi(roiId: number | null, options?: { emit?: boolean; source?: string }): boolean
  fullPhysicalXRange(): RasterPhysicalRange
  clear(): boolean
  destroy(): void
}
