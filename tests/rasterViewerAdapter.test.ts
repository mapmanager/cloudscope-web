import { describe, expect, it } from 'vitest'

import { normalizeLutName } from '../src/data/rasterLut'
import {
  axisSize,
  buildRasterDescriptor,
  buildReferenceRasterDescriptor,
  roiToEnvelope,
} from '../src/data/rasterDescriptor'
import { fullLinkedTimeRange, linkedRangeFromPhysical } from '../src/data/rasterTimeRange'
import { asPlaneSamples, maxProjectPlanes, slidingZIndices } from '../src/data/slidingZ'
import type {
  PrimaryImageDescriptor,
  ReferenceImageDescriptor,
  Roi,
} from '../src/models/acqImageModels'
import type { ImagePlane } from '../src/data/omeZarrLoader'

function image(overrides: Partial<PrimaryImageDescriptor> = {}): PrimaryImageDescriptor {
  return {
    href: './acq_images/demo/',
    shape: [8, 4],
    dims: ['y', 'x'],
    sizes: { y: 8, x: 4 },
    dtype: 'uint16',
    axes: [
      { name: 'y', size: 8, spacing: 0.5, unit: 'seconds' },
      { name: 'x', size: 4, spacing: 1, unit: 'um' },
    ],
    num_channels: 2,
    default_channel: 0,
    channels: [
      {
        index: 0,
        contrast: {
          color_lut: 'Green',
          value_min: 10,
          value_max: 100,
          img_min: 0,
          img_max: 255,
        },
      },
      { index: 1, contrast: null },
    ],
    acquisition: { date: '', time: '' },
    ...overrides,
  }
}

function plane(overrides: Partial<ImagePlane> = {}): ImagePlane {
  return {
    data: new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8]),
    width: 4,
    height: 2,
    sourceWidth: 4,
    sourceHeight: 2,
    level: '0',
    axes: { x: { spacing: 1, unit: 'um' }, y: { spacing: 0.5, unit: 'seconds' } },
    ...overrides,
  }
}

describe('normalizeLutName', () => {
  it('lowercases sidecar names and falls back to gray', () => {
    expect(normalizeLutName('Green')).toBe('green')
    expect(normalizeLutName('VIRIDIS')).toBe('viridis')
    expect(normalizeLutName('not-a-lut')).toBe('gray')
  })
})

describe('ROI envelopes', () => {
  it('maps source X/Y into row/col without display orientation', () => {
    const rect: Roi = {
      id: 1,
      type: 'rect',
      name: 'r',
      note: '',
      x_start: 2,
      x_stop: 8,
      y_start: 10,
      y_stop: 30,
    }
    expect(roiToEnvelope(rect, 1, 1)).toMatchObject({
      roi_type: 'rectroi',
      data: { row_start: 10, row_stop: 30, col_start: 2, col_stop: 8 },
    })
    const line: Roi = {
      id: 2,
      type: 'line',
      name: '',
      note: '',
      x0: 2,
      y0: 10,
      x1: 8,
      y1: 30,
    }
    expect(roiToEnvelope(line, 1, 1)).toMatchObject({
      roi_type: 'linesegmentroi',
      data: { row0: 10, col0: 2, row1: 30, col1: 8 },
    })
  })

  it('scales ROI coordinates onto a downsampled plane', () => {
    expect(
      roiToEnvelope(
        {
          id: 1,
          type: 'rect',
          name: '',
          note: '',
          x_start: 10,
          x_stop: 20,
          y_start: 4,
          y_stop: 8,
        },
        0.5,
        0.5,
      ),
    ).toMatchObject({
      data: { col_start: 5, col_stop: 10, row_start: 2, row_stop: 4 },
    })
  })
})

describe('buildRasterDescriptor', () => {
  it('includes every channel and source-YX size from the probe plane', () => {
    const descriptor = buildRasterDescriptor(image(), plane(), [])
    expect(descriptor.channels.map((channel) => channel.id)).toEqual(['0', '1'])
    expect(descriptor.header.num_channels).toBe(2)
    expect(descriptor.width).toBe(4)
    expect(descriptor.height).toBe(2)
    expect(descriptor.channels[0]?.display).toMatchObject({
      lut: 'green',
      value_min: 10,
      value_max: 100,
    })
    expect(descriptor.axes.y.step).toBe(0.5)
    expect(descriptor.display_orientation).toEqual({ transpose: true, flip_y: true })
  })

  it('adds T/Z header dims from sizes even when image.dims is YX-only', () => {
    const descriptor = buildRasterDescriptor(
      image({ sizes: { y: 8, x: 4, z: 12, t: 3 } }),
      plane(),
      [],
    )
    expect(descriptor.header.dims).toEqual(['T', 'Z', 'Y', 'X'])
    expect(descriptor.header.sizes).toMatchObject({ T: 3, Z: 12, Y: 2, X: 4 })
  })

  it('reads axis sizes case-insensitively', () => {
    expect(axisSize({ Z: 5 }, 'z')).toBe(5)
    expect(axisSize({ t: 2 }, 'T')).toBe(2)
    expect(axisSize({ y: 0 }, 'y')).toBeUndefined()
  })

  it('builds an independent spatial descriptor for a reference image', () => {
    const reference: ReferenceImageDescriptor = {
      href: './reference/',
      shape: [2, 512, 512],
      dims: ['c', 'y', 'x'],
      sizes: { c: 2, y: 512, x: 512 },
      dtype: 'uint16',
      axes: [
        { name: 'c', size: 2, spacing: 1, unit: 'Pixels' },
        { name: 'y', size: 512, spacing: 0.5, unit: 'micrometer' },
        { name: 'x', size: 512, spacing: 0.5, unit: 'micrometer' },
      ],
      num_channels: 2,
      channels: [
        { index: 0, contrast: null },
        { index: 1, contrast: null },
      ],
      metadata: {},
      scan_path: { x_pixels: [10, 20], y_pixels: [30, 40] },
    }
    const descriptor = buildReferenceRasterDescriptor(
      reference,
      plane({
        width: 512,
        height: 512,
        sourceWidth: 512,
        sourceHeight: 512,
        axes: {
          x: { spacing: 0.5, unit: 'micrometer' },
          y: { spacing: 0.5, unit: 'micrometer' },
        },
      }),
    )
    expect(descriptor.channels.map(({ id }) => id)).toEqual(['0', '1'])
    expect(descriptor.rois).toEqual([])
    expect(descriptor.header.dims).toEqual(['Y', 'X'])
    expect(descriptor.axes).toEqual({
      x: { label: 'micrometer', step: 0.5, unit: 'micrometer' },
      y: { label: 'micrometer', step: 0.5, unit: 'micrometer' },
    })
  })
})

describe('linked time range', () => {
  it('uses pixel-center full extent and treats viewer-home n*dt as full', () => {
    const full = fullLinkedTimeRange(5, 0.25)
    expect(full).toEqual({ min: 0, max: 1 })
    expect(linkedRangeFromPhysical(0, 1.25, full)).toBeNull()
    expect(linkedRangeFromPhysical(0.25, 0.75, full)).toEqual({ min: 0.25, max: 0.75 })
  })
})

describe('sliding-Z', () => {
  it('clamps a centered window and max-projects equal-length planes', () => {
    expect(slidingZIndices(0, 2, 5)).toEqual([0, 1, 2])
    expect(slidingZIndices(4, 2, 5)).toEqual([2, 3, 4])
    const projected = maxProjectPlanes([new Uint16Array([1, 8, 3]), new Uint16Array([4, 2, 9])])
    expect(Array.from(projected as Uint16Array)).toEqual([4, 8, 9])
  })

  it('keeps typed-array samples without wrapping generic arrays incorrectly', () => {
    const samples = asPlaneSamples(new Uint16Array([3, 4]))
    expect(samples).toBeInstanceOf(Uint16Array)
    expect(Array.from(asPlaneSamples([1, 2]) as Float64Array)).toEqual([1, 2])
  })
})
