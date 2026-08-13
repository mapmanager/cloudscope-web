import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/data/datasetLoader', () => ({
  loadDataset: vi.fn(),
  loadAcqImage: vi.fn(),
}))

import { loadAcqImage, loadDataset } from '../src/data/datasetLoader'
import { readUrlSelection, useViewerState, viewerUrl } from '../src/composables/useViewerState'

describe('viewer URL state', () => {
  it('round-trips the dataset and complete selection without routing', () => {
    const href = viewerUrl('https://viewer.test/app/', {
      dataset: 'https://data.test/study/dataset.json',
      image: 'image-2',
      channel: 1,
      roi: 8,
      z: 3,
      t: 4,
    })

    expect(new URL(href).searchParams.get('dataset')).toBe('https://data.test/study/dataset.json')
    expect(readUrlSelection(href)).toEqual({ image: 'image-2', channel: 1, roi: 8, z: 3, t: 4 })
  })
})

describe('viewer selection state', () => {
  it('resets channel, ROI, Z, and T when a file is selected', async () => {
    vi.mocked(loadDataset).mockResolvedValue({
      url: new URL('https://example.test/dataset.json'),
      data: {
        format: 'acqstore-web-dataset',
        format_version: 1,
        id: 'dataset',
        name: 'test',
        acqstore_version: '1',
        created_utc: '',
        images: [
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
        metadata: {},
        reference_image: null,
      },
    })
    const state = useViewerState()
    state.selectedChannel.value = 2
    state.selectedRoiId.value = 99
    state.selectedZ.value = 4
    state.selectedT.value = 3

    await state.openDataset('https://example.test/dataset.json')

    expect(state.selectedImageId.value).toBe('image-1')
    expect(state.selectedChannel.value).toBe(0)
    expect(state.selectedRoiId.value).toBe(7)
    expect(state.selectedZ.value).toBe(0)
    expect(state.selectedT.value).toBe(0)
  })
})
