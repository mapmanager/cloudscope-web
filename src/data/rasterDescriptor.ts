import type {
  PixelDescriptor,
  PrimaryImageDescriptor,
  ReferenceImageDescriptor,
  Roi,
} from '../models/acqImageModels'
import type { ImagePlane } from './omeZarrLoader'
import { normalizeLutName } from './rasterLut'
import { displayTimeStepSeconds } from './rasterTimeRange'
import type { RasterDescriptor } from '../raster-viewer/raster-viewer.js'

const RASTER_DIMS = ['T', 'Z', 'Y', 'X'] as const
type RasterDim = (typeof RASTER_DIMS)[number]

/**
 * Read a case-insensitive axis size from an AcqImage sizes map.
 *
 * @param sizes AcqImage `sizes` record.
 * @param name Axis name such as `"z"` or `"T"`.
 * @returns Positive integer size, or `undefined` when absent.
 */
export function axisSize(sizes: Record<string, number>, name: string): number | undefined {
  const value = sizes[name] ?? sizes[name.toLowerCase()] ?? sizes[name.toUpperCase()]
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : undefined
}

function rasterDims(dims: string[]): RasterDim[] {
  const allowed = new Set<string>(RASTER_DIMS)
  return dims
    .map((dim) => dim.toUpperCase())
    .filter((dim): dim is RasterDim => allowed.has(dim))
}

/** T/Z/Y/X header dims: include T/Z whenever those sizes exist, never drop Y/X. */
function rasterHeaderDims(image: PixelDescriptor): RasterDim[] {
  const listed = new Set(rasterDims(image.dims))
  const dims: RasterDim[] = []
  if (listed.has('T') || axisSize(image.sizes, 't') !== undefined) dims.push('T')
  if (listed.has('Z') || axisSize(image.sizes, 'z') !== undefined) dims.push('Z')
  if (listed.has('Y')) dims.push('Y')
  if (listed.has('X')) dims.push('X')
  if (!dims.includes('Y') || !dims.includes('X')) {
    throw new Error('Image descriptor does not contain Y and X axes')
  }
  return dims
}

function scaleCoord(value: number, scale: number): number {
  return Math.round(Number(value) * scale)
}

/**
 * Convert one AcqStore ROI into a RasterViewer source-coordinate envelope.
 *
 * Does not apply display orientation: the viewer transposes and flip-Y itself.
 * Coordinates are scaled from full-resolution source pixels onto the loaded
 * pyramid level.
 *
 * @param roi AcqStore ROI in source X/Y.
 * @param scaleX `plane.width / plane.sourceWidth`.
 * @param scaleY `plane.height / plane.sourceHeight`.
 * @returns Widget envelope, or `null` when the ROI id is not a positive integer.
 */
export function roiToEnvelope(
  roi: Roi,
  scaleX: number,
  scaleY: number,
): Record<string, unknown> | null {
  if (!Number.isInteger(roi.id) || roi.id <= 0) return null
  if (roi.type === 'rect') {
    return {
      roi_id: roi.id,
      roi_type: 'rectroi',
      version: '1.0',
      name: roi.name,
      note: roi.note || '',
      data: {
        row_start: scaleCoord(roi.y_start, scaleY),
        row_stop: scaleCoord(roi.y_stop, scaleY),
        col_start: scaleCoord(roi.x_start, scaleX),
        col_stop: scaleCoord(roi.x_stop, scaleX),
      },
    }
  }
  return {
    roi_id: roi.id,
    roi_type: 'linesegmentroi',
    version: '1.0',
    name: roi.name,
    note: roi.note || '',
    data: {
      row0: scaleCoord(roi.y0, scaleY),
      col0: scaleCoord(roi.x0, scaleX),
      row1: scaleCoord(roi.y1, scaleY),
      col1: scaleCoord(roi.x1, scaleX),
    },
  }
}

function itemSize(dtype: string): number {
  const normalized = dtype.toLowerCase()
  if (normalized.includes('16')) return 2
  if (normalized.includes('8')) return 1
  return 4
}

function encodingFor(dtype: string): string {
  return dtype.toLowerCase().includes('16') ? 'raw-u16-le' : 'raw-f32-le'
}

type ChannelImage = PixelDescriptor & { channels: PrimaryImageDescriptor['channels'] }

function channelsOf(image: ChannelImage): PrimaryImageDescriptor['channels'] {
  if (image.channels.length > 0) return image.channels
  return Array.from({ length: Math.max(0, image.num_channels) }, (_, index) => ({
    index,
    contrast: null,
  }))
}

/**
 * Build a RasterViewer descriptor from an AcqImage and one zarrita probe plane.
 *
 * Includes every channel. Source YX size comes from the loaded pyramid level.
 * Display-X (source Y) step is converted to seconds for plot linking.
 *
 * @param image Selected AcqImage pixel descriptor.
 * @param plane Source-YX probe plane from {@link loadImagePlane}.
 * @param rois AcqStore ROIs in source coordinates.
 * @returns Schema 2.0 descriptor with empty `data_url` placeholders.
 */
function buildDescriptor(
  image: ChannelImage,
  plane: ImagePlane,
  rois: Roi[],
  sourceAxes: { x: { label: string; step: number; unit: string }; y: { label: string; step: number; unit: string } },
  includePlanes: boolean,
): RasterDescriptor {
  if (plane.width < 1 || plane.height < 1) {
    throw new Error('Loaded image plane has no raster samples')
  }
  const scaleX = plane.width / plane.sourceWidth
  const scaleY = plane.height / plane.sourceHeight
  if (!(scaleX > 0) || !(scaleY > 0)) {
    throw new Error('Loaded image plane is missing source dimensions')
  }
  const dims = rasterHeaderDims(image)
  const channelList = channelsOf(image)
  const samples = plane.width * plane.height
  const tSize = includePlanes ? axisSize(image.sizes, 't') : undefined
  const zSize = includePlanes ? axisSize(image.sizes, 'z') : undefined
  const sizes: Record<string, number> = { Y: plane.height, X: plane.width }
  if (tSize !== undefined) sizes.T = tSize
  if (zSize !== undefined) sizes.Z = zSize
  const physicalUnits = dims.map((dim) => {
    if (dim === 'Y') return sourceAxes.y.step
    if (dim === 'X') return sourceAxes.x.step
    return 1
  })
  const physicalLabels = dims.map((dim) => {
    if (dim === 'Y') return sourceAxes.y.unit
    if (dim === 'X') return sourceAxes.x.unit
    return dim
  })
  return {
    schema_version: '2.0',
    id: image.href,
    label: image.href,
    header: {
      dims,
      sizes,
      dtype: image.dtype,
      num_channels: channelList.length,
      physical_units: physicalUnits,
      physical_units_labels: physicalLabels,
    },
    width: plane.width,
    height: plane.height,
    layout: 'row-major',
    endianness: 'little',
    display_orientation: { transpose: true, flip_y: true },
    axes: {
      x: sourceAxes.x,
      y: sourceAxes.y,
    },
    rois: rois.flatMap((roi) => {
      const envelope = roiToEnvelope(roi, scaleX, scaleY)
      return envelope ? [envelope] : []
    }),
    channels: channelList.map((channel) => {
      const contrast = channel.contrast
      const hasRange =
        contrast !== null &&
        Number.isFinite(contrast.value_min) &&
        Number.isFinite(contrast.value_max) &&
        contrast.value_max > contrast.value_min
      return {
        id: String(channel.index),
        index: channel.index,
        label: String(channel.index),
        dtype: image.dtype,
        encoding: encodingFor(image.dtype),
        byte_length: samples * itemSize(image.dtype),
        display: {
          lut: normalizeLutName(contrast?.color_lut),
          value_min: hasRange && contrast ? contrast.value_min : null,
          value_max: hasRange && contrast ? contrast.value_max : null,
          visible: true,
        },
        data_url: '',
      }
    }),
  }
}

export function buildRasterDescriptor(
  image: PrimaryImageDescriptor,
  plane: ImagePlane,
  rois: Roi[],
): RasterDescriptor {
  const timeStep = displayTimeStepSeconds(plane.axes.y)
  return buildDescriptor(
    image,
    plane,
    rois,
    {
      x: { label: plane.axes.x.unit, step: plane.axes.x.spacing, unit: plane.axes.x.unit },
      y: { label: 's', step: timeStep, unit: 's' },
    },
    true,
  )
}

/** Build a raster descriptor for a non-volumetric spatial reference image. */
export function buildReferenceRasterDescriptor(
  image: ReferenceImageDescriptor,
  plane: ImagePlane,
): RasterDescriptor {
  return buildDescriptor(
    image,
    plane,
    [],
    {
      x: { label: plane.axes.x.unit, step: plane.axes.x.spacing, unit: plane.axes.x.unit },
      y: { label: plane.axes.y.unit, step: plane.axes.y.spacing, unit: plane.axes.y.unit },
    },
    false,
  )
}
