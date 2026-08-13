import * as zarr from 'zarrita'

import type { PixelDescriptor } from '../models/webDataset'

interface OmeDataset {
  path: string
}

interface OmeRootMetadata {
  attributes?: {
    ome?: {
      multiscales?: Array<{
        datasets?: OmeDataset[]
      }>
    }
  }
}

export interface ImagePlane {
  data: ArrayLike<number>
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  level: string
}

export interface PlaneIndices {
  channel: number
  z: number
  t: number
}

const MAX_RENDERED_PIXELS = 1_500_000

function metadataUrl(zarrUrl: URL): URL {
  return new URL(`${zarrUrl.href.replace(/\/$/, '')}/zarr.json`)
}

async function fetchRootMetadata(zarrUrl: URL, signal?: AbortSignal): Promise<OmeRootMetadata> {
  const response = await fetch(metadataUrl(zarrUrl), signal ? { signal } : {})
  if (!response.ok) {
    throw new Error(`Could not load OME-Zarr metadata (${response.status})`)
  }
  return (await response.json()) as OmeRootMetadata
}

export function planeSelection(dims: string[], indices: PlaneIndices): Array<null | number> {
  return dims.map((dim) => {
    switch (dim.toLowerCase()) {
      case 'y':
      case 'x':
        return null
      case 'c':
        return indices.channel
      case 'z':
        return indices.z
      case 't':
        return indices.t
      default:
        throw new Error(`Unsupported image dimension: ${dim}`)
    }
  })
}

function renderedPixelCount(shape: number[], dims: string[]): number {
  const y = shape[dims.findIndex((dim) => dim.toLowerCase() === 'y')] ?? 0
  const x = shape[dims.findIndex((dim) => dim.toLowerCase() === 'x')] ?? 0
  return y * x
}

async function chooseLevel(
  group: zarr.Group<zarr.FetchStore>,
  paths: string[],
  dims: string[],
  signal?: AbortSignal,
): Promise<{ array: zarr.Array<zarr.DataType, zarr.FetchStore>; path: string }> {
  let fallback: { array: zarr.Array<zarr.DataType, zarr.FetchStore>; path: string } | null = null
  for (const path of paths) {
    const array = await zarr.open(
      group.resolve(path),
      signal ? { kind: 'array', signal } : { kind: 'array' },
    )
    fallback = { array, path }
    if (renderedPixelCount(array.shape, dims) <= MAX_RENDERED_PIXELS) return fallback
  }
  if (fallback) return fallback
  throw new Error('OME-Zarr metadata does not list an image pyramid')
}

export async function loadImagePlane(
  descriptor: PixelDescriptor,
  documentUrl: URL,
  indices: PlaneIndices,
  signal?: AbortSignal,
): Promise<ImagePlane> {
  const zarrUrl = new URL(descriptor.href.replace(/\/?$/, '/'), documentUrl)
  const metadata = await fetchRootMetadata(zarrUrl, signal)
  const paths = metadata.attributes?.ome?.multiscales?.[0]?.datasets?.map(({ path }) => path)
  if (!paths?.length) throw new Error('OME-Zarr metadata does not contain a multiscale dataset')

  const store = new zarr.FetchStore(zarrUrl)
  const group = await zarr.open(store, signal ? { kind: 'group', signal } : { kind: 'group' })
  const { array, path } = await chooseLevel(group, paths, descriptor.dims, signal)
  const result = await zarr.get(
    array,
    planeSelection(descriptor.dims, indices),
    signal ? { signal } : {},
  )
  if (typeof result !== 'object' || result === null || !('shape' in result)) {
    throw new Error('Selected OME-Zarr data is not an image plane')
  }

  const plane = result as zarr.Chunk<zarr.DataType>
  if (plane.shape.length !== 2 || Array.isArray(plane.data)) {
    throw new Error(`Expected a two-dimensional numeric image, received ${plane.shape.join('×')}`)
  }
  const height = plane.shape[0]
  const width = plane.shape[1]
  const yIndex = descriptor.dims.findIndex((dim) => dim.toLowerCase() === 'y')
  const xIndex = descriptor.dims.findIndex((dim) => dim.toLowerCase() === 'x')
  if (height === undefined || width === undefined || yIndex < 0 || xIndex < 0) {
    throw new Error('Image descriptor does not contain valid Y and X axes')
  }
  const sourceWidth = descriptor.shape[xIndex]
  const sourceHeight = descriptor.shape[yIndex]
  if (sourceWidth === undefined || sourceHeight === undefined) {
    throw new Error('Image descriptor shape does not match its dimensions')
  }
  return {
    data: plane.data as ArrayLike<number>,
    width,
    height,
    sourceWidth,
    sourceHeight,
    level: path,
  }
}

export function intensityRange(
  data: ArrayLike<number>,
  requested?: { value_min: number; value_max: number } | null,
): [number, number] {
  if (requested && requested.value_max > requested.value_min) {
    return [requested.value_min, requested.value_max]
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = 0; index < data.length; index += 1) {
    const value = Number(data[index])
    if (value < min) min = value
    if (value > max) max = value
  }
  return min < max ? [min, max] : [min, min + 1]
}
