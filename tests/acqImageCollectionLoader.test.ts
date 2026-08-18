import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  loadAcqImageCollection,
  loadAcqImageCollectionEntry,
} from '../src/data/acqImageCollectionLoader'
import type { AcqImageCollectionEntry } from '../src/models/acqImageCollectionManifest'

afterEach(() => vi.unstubAllGlobals())

const entry: AcqImageCollectionEntry = {
  id: 'acq_image_000',
  name: 'sample.oir',
  source: { filename: 'sample.oir', relative_path: 'nested/sample.oir' },
  ome_zarr_path: 'acq_images/acq_image_000',
  sidecar_path: 'acq_images/acq_image_000/acqstore/acq_image.json',
  manifest_path: 'acq_images/acq_image_000/acqstore/manifest.json',
  reference_image_path: 'acq_images/acq_image_000/reference',
  summary: {
    shape: [30000, 14],
    dims: ['y', 'x'],
    sizes: { y: 30000, x: 14 },
    dtype: 'uint16',
    num_channels: 1,
    num_rois: 1,
    analysis_types: ['radon_velocity'],
    acquisition: { date: '20251029', time: '15:30:55' },
    accepted: true,
    has_reference_image: true,
  },
}

describe('AcqImageCollection loader', () => {
  it('builds the file-table index from the root manifest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          format: 'acqstore-acq-image-collection',
          version: 1,
          zarr_format: 3,
          name: 'sample collection',
          created_utc: '2026-08-18T00:00:00Z',
          acqstore_version: '1.0',
          acq_images: [entry],
          analysis_tables: {},
        }),
      ),
    )
    const loaded = await loadAcqImageCollection('https://example.test/sample.ome.zarr/')
    expect(loaded.data.acq_images[0]).toMatchObject({
      id: 'acq_image_000',
      name: 'sample.oir',
      dtype: 'uint16',
      num_rois: 1,
      load_state: { pixels: false, analysisCsv: false },
    })
  })

  it('rejects stale collection versions before reading new fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ format: 'acqstore-acq-image-collection', version: 2, acq_images: [] }),
        ),
    )
    await expect(loadAcqImageCollection('https://example.test/stale.ome.zarr/')).rejects.toThrow(
      'requires AcqImageCollection version 1; re-export',
    )
  })

  it('reports the resource and exact missing manifest field', async () => {
    const invalidEntry = { ...entry, source: undefined }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          format: 'acqstore-acq-image-collection',
          version: 1,
          zarr_format: 3,
          name: 'invalid',
          created_utc: '2026-08-18T00:00:00Z',
          acqstore_version: '1.0',
          acq_images: [invalidEntry],
          analysis_tables: {},
        }),
      ),
    )
    await expect(loadAcqImageCollection('https://example.test/invalid.ome.zarr/')).rejects.toThrow(
      'https://example.test/invalid.ome.zarr/acqstore/acq_image_collection.json: $.acq_images[0].source must be an object',
    )
  })

  it('joins native analysis identity to declared resources', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          format: 'acqstore-native-ome-zarr',
          version: 2,
          image_group: '.',
          sidecar: 'acqstore/acq_image.json',
          analyses: [
            {
              id: 'radon_velocity__c0__r1',
              analysis_name: 'radon_velocity',
              channel: 0,
              roi_id: 1,
              resources: {
                table: 'acqstore/analysis/radon_velocity__c0__r1.table.csv',
                peaks: null,
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          accepted: true,
          image_contrast: {},
          image_header_metadata: {},
          reference_image_metadata: {},
          rois: [],
          analysis: [
            {
              analysis_name: 'radon_velocity',
              channel: 0,
              roi_id: 1,
              summary: { velocity_mean: 2.5 },
              detection_params: { window_width: 64 },
            },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const loaded = await loadAcqImageCollectionEntry(
      new URL('https://example.test/sample.ome.zarr/'),
      entry,
      undefined,
    )
    expect(loaded.data.analyses[0]).toMatchObject({
      id: 'radon_velocity__c0__r1',
      analysis_type: 'radon_velocity',
      resources: {
        table: {
          href: 'https://example.test/sample.ome.zarr/acq_images/acq_image_000/acqstore/analysis/radon_velocity__c0__r1.table.csv',
        },
        peaks: null,
      },
    })
  })
})
