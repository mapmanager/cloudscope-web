import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  loadAcqImageCollection,
  loadAcqImageCollectionEntry,
} from '../src/data/acqImageCollectionLoader'
import type { AcqImageCollectionEntry } from '../src/models/acqImageCollectionManifest'

afterEach(() => vi.unstubAllGlobals())

const entry: AcqImageCollectionEntry = {
  id: 'image-uuid',
  name: 'sample.oir',
  ome_zarr: 'images/image-uuid',
  resources: {
    acqimage: 'metadata/image-uuid/acqimage.json',
    analyses: 'metadata/image-uuid/analyses.json',
  },
  reference_image: {
    ome_zarr: 'images/image-uuid-reference',
    metadata: 'metadata/image-uuid/reference-image.json',
  },
  summary: {
    shape: [1, 20, 10],
    dims: ['c', 'y', 'x'],
    dtype: 'uint16',
    num_channels: 1,
    num_rois: 1,
    analysis_types: ['radon_velocity'],
    accepted: true,
    has_reference_image: true,
  },
}

const collection = {
  format: 'acqstore-ome-zarr-collection',
  version: 1,
  id: 'collection-uuid',
  name: 'sample collection',
  created: '2026-09-21T00:00:00Z',
  producer: { name: 'acqstore' },
  members: [entry],
  resources: {
    tables: [{ id: 'velocity', media_type: 'text/csv', path: 'tables/velocity.csv' }],
  },
}

describe('AcqImageCollection v1 loader', () => {
  it('builds the collection index from acqstore/collection.json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(collection))
    vi.stubGlobal('fetch', fetchMock)

    const loaded = await loadAcqImageCollection('https://example.test/sample.ome.zarr/')

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.test/sample.ome.zarr/acqstore/collection.json'),
      undefined,
    )
    expect(loaded.data.acq_images[0]).toMatchObject({
      id: 'image-uuid',
      name: 'sample.oir',
      dtype: 'uint16',
      num_rois: 1,
    })
    expect(loaded.data.analysis_tables).toEqual({
      velocity: { csv: 'tables/velocity.csv' },
    })
  })

  it('loads explicitly linked member resources and native integer ROI identities', async () => {
    const responses: Record<string, unknown> = {
      'metadata/image-uuid/acqimage.json': {
        format: 'acqstore-acqimage',
        version: 1,
        image_id: 'image-uuid',
        accepted: true,
        rois: [
          {
            id: 1,
            type: 'line',
            coordinate_space: 'primary-image-full-resolution-pixels',
            name: 'scan',
            start: [4, 3],
            stop: [14, 13],
          },
        ],
        image_metadata: { date: '20260921', time: '12:00:00' },
      },
      'metadata/image-uuid/analyses.json': {
        format: 'acqstore-analyses',
        version: 1,
        image_id: 'image-uuid',
        analyses: [
          {
            id: 'analysis-uuid',
            type: 'radon_velocity',
            roi_id: 1,
            channel: 0,
            resources: [{ id: 'table', media_type: 'text/csv', path: 'analysis/result.csv' }],
          },
          {
            id: 'heart-rate-uuid',
            type: 'heart_rate',
            roi_id: 1,
            channel: 0,
            summary: { status: 'ok', bpm: 420 },
          },
        ],
      },
      'metadata/image-uuid/reference-image.json': {
        format: 'acqstore-reference-image',
        version: 1,
        image_id: 'image-uuid',
        scan_path: {
          coordinate_space: 'reference-image-full-resolution-pixels',
          points: [
            [10, 30],
            [20, 40],
          ],
        },
      },
    }
    const rootMetadata = {
      attributes: {
        ome: {
          multiscales: [
            {
              axes: [{ name: 'c' }, { name: 'y' }, { name: 'x' }],
              datasets: [
                { path: '0', coordinateTransformations: [{ type: 'scale', scale: [1, 2, 3] }] },
              ],
            },
          ],
        },
      },
    }
    const fetchMock = vi.fn(async (request: URL | RequestInfo) => {
      const url = new URL(String(request))
      const relative = url.pathname.split('/sample.ome.zarr/')[1] ?? ''
      if (relative in responses) return Response.json(responses[relative])
      if (relative.endsWith('/zarr.json') && !relative.endsWith('/0/zarr.json')) {
        return Response.json(rootMetadata)
      }
      if (relative.endsWith('/0/zarr.json')) {
        return Response.json({ shape: [1, 20, 10], data_type: 'uint16' })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const loaded = await loadAcqImageCollectionEntry(
      new URL('https://example.test/sample.ome.zarr/'),
      entry,
    )

    expect(loaded.data.rois[0]).toMatchObject({ id: 1, type: 'line' })
    expect(loaded.data.analyses[0]).toMatchObject({
      id: 'analysis-uuid',
      roi_id: 1,
      table: { href: 'https://example.test/sample.ome.zarr/analysis/result.csv' },
    })
    expect(loaded.data.analyses[1]).toMatchObject({
      id: 'heart-rate-uuid',
      summary: { status: 'ok', bpm: 420 },
      table: null,
      resources: { table: null, peaks: null },
    })
    expect(loaded.data.reference_image?.scan_path).toEqual({
      x_pixels: [10, 20],
      y_pixels: [30, 40],
    })
  })

  it('rejects paths outside the collection root', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...collection,
          members: [{ ...entry, ome_zarr: '../outside' }],
        }),
      ),
    )

    await expect(loadAcqImageCollection('https://example.test/sample.ome.zarr/')).rejects.toThrow(
      '$.members[0].ome_zarr must be a collection-relative path',
    )
  })
})
