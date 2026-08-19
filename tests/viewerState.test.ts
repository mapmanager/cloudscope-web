import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/data/datasetLoader', () => ({
  loadDataset: vi.fn(),
  loadAcqImage: vi.fn(),
}))

vi.mock('../src/data/omeZarrLoader', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/data/omeZarrLoader')>()
  return { ...original, loadImagePlane: vi.fn() }
})

import { loadAcqImage, loadDataset } from '../src/data/datasetLoader'
import { loadImagePlane } from '../src/data/omeZarrLoader'
import {
  initialCollectionUrl,
  readUrlSelection,
  useViewerState,
  viewerUrl,
} from '../src/composables/useViewerState'
import { defaultSampleCollection } from '../src/config/sampleCollections'

describe('viewer URL state', () => {
  it('uses the bundled diameter collection when no explicit source is present', () => {
    window.history.replaceState(null, '', '/')
    expect(initialCollectionUrl()).toBe(defaultSampleCollection.url)
  })

  it('prefers an explicit collection URL', () => {
    window.history.replaceState(null, '', '/?collection=https://data.test/collection.ome.zarr/')
    expect(initialCollectionUrl()).toBe('https://data.test/collection.ome.zarr/')
    window.history.replaceState(null, '', '/')
  })

  it('round-trips the dataset and complete selection without routing', () => {
    const href = viewerUrl('https://viewer.test/app/', {
      collection: 'https://data.test/study/dataset.json',
      acqImage: 'image-2',
      channel: 1,
      roi: 8,
      z: 3,
      t: 4,
    })

    expect(new URL(href).searchParams.get('collection')).toBe(
      'https://data.test/study/dataset.json',
    )
    expect(readUrlSelection(href)).toEqual({
      acqImage: 'image-2',
      channel: 1,
      roi: 8,
      z: 3,
      t: 4,
    })
  })
})

describe('viewer selection state', () => {
  it('resets channel, ROI, Z, and T when a file is selected', async () => {
    vi.mocked(loadDataset).mockResolvedValue({
      url: new URL('https://example.test/dataset.json'),
      data: {
        id: 'dataset',
        name: 'test',
        acqstore_version: '1',
        created_utc: '',
        acq_images: [
          {
            id: 'image-1',
            name: 'one',
            href: 'images/one.json',
            shape: [5, 4],
            dims: ['y', 'x'],
            sizes: { y: 5, x: 4 },
            dtype: 'uint16',
            axes: [],
            acquisition: { date: '', time: '' },
            num_channels: 1,
            num_rois: 1,
            analysis_types: [],
            accepted: true,
            has_reference_image: false,
          },
        ],
      },
    })
    vi.mocked(loadAcqImage).mockResolvedValue({
      url: new URL('https://example.test/images/one.json'),
      data: {
        format: 'acqstore-web-acqimage',
        format_version: 1,
        id: 'image-1',
        name: 'one',
        accepted: true,
        image: {
          href: 'image.ome.zarr',
          shape: [5, 4],
          dims: ['y', 'x'],
          sizes: { y: 5, x: 4 },
          dtype: 'uint16',
          axes: [],
          num_channels: 1,
          default_channel: 0,
          channels: [{ index: 0, contrast: null }],
          acquisition: { date: '', time: '' },
        },
        rois: [
          { id: 7, type: 'rect', name: '', note: '', x_start: 0, x_stop: 4, y_start: 0, y_stop: 5 },
        ],
        analyses: [],
        metadata: { image_header: {}, experiment: {}, reference_image: {} },
        reference_image: null,
      },
    })
    const state = useViewerState()
    state.selectedChannel.value = 2
    state.selectedRoiId.value = 99
    state.selectedZ.value = 4
    state.selectedT.value = 3

    await state.openAcqImageCollection('https://example.test/dataset.json')

    expect(state.selectedAcqImageId.value).toBe('image-1')
    expect(state.selectedChannel.value).toBe(0)
    expect(state.selectedRoiId.value).toBe(7)
    expect(state.selectedZ.value).toBe(0)
    expect(state.selectedT.value).toBe(0)

    const descriptorLoads = vi.mocked(loadAcqImage).mock.calls.length
    await state.selectAcqImage('image-1')
    expect(loadAcqImage).toHaveBeenCalledTimes(descriptorLoads)

    await state.openAcqImageCollection('https://example.test/second-dataset.json')
    expect(loadAcqImage).toHaveBeenCalledTimes(descriptorLoads + 1)
  })

  it('reuses a cached channel/Z/T plane', async () => {
    vi.mocked(loadImagePlane).mockResolvedValue({
      data: new Uint16Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      sourceWidth: 2,
      sourceHeight: 2,
      level: '0',
      axes: { x: { spacing: 1, unit: 'Pixels' }, y: { spacing: 1, unit: 'Pixels' } },
    })
    const state = useViewerState({ maxBytes: 1024, maxEntries: 4 })
    await state.openAcqImageCollection('https://example.test/dataset.json')
    const document = state.acqImageDocument.value!

    await state.loadPlane(document.data.image, document.url, { channel: 0, z: 0, t: 0 })
    await state.loadPlane(document.data.image, document.url, { channel: 0, z: 0, t: 0 })

    expect(loadImagePlane).toHaveBeenCalledTimes(1)
  })
})
