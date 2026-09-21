import { beforeEach, describe, expect, it, vi } from 'vitest'

const sourceMocks = vi.hoisted(() => ({
  loadCollection: vi.fn(),
  loadAcqImage: vi.fn(),
  loadPlane: vi.fn(),
}))

vi.mock('../src/data/viewerDataSource', () => ({
  AcqImageCollectionSource: class {
    canUnload = false
    persistInUrl = true
    refreshAfterUnload = false
    loadCollection = sourceMocks.loadCollection
    loadAcqImage = sourceMocks.loadAcqImage
    loadPlane = sourceMocks.loadPlane
    loadPixelDescriptor = vi.fn()
    loadTable = vi.fn()
    loadJson = vi.fn()
    unloadImage = vi.fn()
    close = vi.fn()
  },
  BrowserDirectoryCollectionSource: class {},
}))

import {
  initialCollectionUrl,
  readUrlSelection,
  useViewerState,
  viewerUrl,
} from '../src/composables/useViewerState'
import { defaultSampleCollection } from '../src/config/sampleCollections'
import type {
  AcqImageCollectionRow,
  AcqImageDocument,
  LoadedDocument,
} from '../src/models/acqImageModels'

function collectionRow(id: string, href: string, name: string): AcqImageCollectionRow {
  return {
    id,
    name,
    href,
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
  }
}

function acqImageDocument(
  id: string,
  href: string,
  name: string,
  roiId: string,
): LoadedDocument<AcqImageDocument> {
  return {
    url: new URL(`https://example.test/${href}`),
    data: {
      format: 'acqstore-web-acqimage',
      format_version: 1,
      id,
      name,
      accepted: true,
      image: {
        href: `${id}.ome.zarr`,
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
        {
          id: roiId,
          type: 'rect',
          name: '',
          note: '',
          x_start: 0,
          x_stop: 4,
          y_start: 0,
          y_stop: 5,
        },
      ],
      analyses: [],
      metadata: { image_header: {}, experiment: {}, reference_image: {} },
      reference_image: null,
    },
  }
}

function mockCollection(acqImages: AcqImageCollectionRow[]): void {
  sourceMocks.loadCollection.mockResolvedValue({
    url: new URL('https://example.test/collection.ome.zarr/'),
    data: {
      id: 'collection',
      name: 'test',
      acqstore_version: '1',
      created_utc: '',
      analysis_tables: {},
      acq_images: acqImages,
    },
  })
}

describe('viewer URL state', () => {
  it('uses the configured sample when no explicit source is present', () => {
    window.history.replaceState(null, '', '/')
    expect(initialCollectionUrl()).toBe(defaultSampleCollection.url)
  })

  it('round-trips opaque collection, image, and ROI identities', () => {
    const href = viewerUrl('https://viewer.test/app/', {
      collection: 'https://data.test/study.ome.zarr/',
      acqImage: 'image-uuid',
      channel: 1,
      roi: 'roi-uuid',
      z: 3,
      t: 4,
    })
    expect(readUrlSelection(href)).toEqual({
      acqImage: 'image-uuid',
      channel: 1,
      roi: 'roi-uuid',
      z: 3,
      t: 4,
    })
  })
})

describe('viewer selection state', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    vi.clearAllMocks()
  })

  it('loads the first member and resets its selection', async () => {
    mockCollection([collectionRow('image-1', 'metadata/one.json', 'one')])
    sourceMocks.loadAcqImage.mockResolvedValue(
      acqImageDocument('image-1', 'metadata/one.json', 'one', 'roi-7'),
    )
    const state = useViewerState()
    state.selectedChannel.value = 2
    state.selectedRoiId.value = 'old-roi'
    state.selectedZ.value = 4
    state.selectedT.value = 3

    await state.openAcqImageCollection('https://example.test/collection.ome.zarr/')

    expect(state.selectedAcqImageId.value).toBe('image-1')
    expect(state.selectedChannel.value).toBe(0)
    expect(state.selectedRoiId.value).toBe('roi-7')
    expect(state.selectedZ.value).toBe(0)
    expect(state.selectedT.value).toBe(0)
  })

  it('keeps the previous member until the next member commits', async () => {
    const first = acqImageDocument('image-1', 'metadata/one.json', 'one', 'roi-7')
    const second = acqImageDocument('image-2', 'metadata/two.json', 'two', 'roi-3')
    mockCollection([
      collectionRow('image-1', 'metadata/one.json', 'one'),
      collectionRow('image-2', 'metadata/two.json', 'two'),
    ])
    let resolveSecond: ((value: typeof second) => void) | null = null
    sourceMocks.loadAcqImage.mockImplementation((_url, href) =>
      String(href).includes('two')
        ? new Promise((resolve) => {
            resolveSecond = resolve
          })
        : Promise.resolve(first),
    )
    const state = useViewerState()
    await state.openAcqImageCollection('https://example.test/collection.ome.zarr/')

    const pending = state.selectAcqImage('image-2')
    expect(state.acqImageDocument.value?.data.id).toBe('image-1')
    resolveSecond!(second)
    await pending

    expect(state.acqImageDocument.value?.data.id).toBe('image-2')
    expect(state.selectedRoiId.value).toBe('roi-3')
  })

  it('reuses a cached channel/Z/T plane', async () => {
    mockCollection([collectionRow('image-1', 'metadata/one.json', 'one')])
    sourceMocks.loadAcqImage.mockResolvedValue(
      acqImageDocument('image-1', 'metadata/one.json', 'one', 'roi-7'),
    )
    sourceMocks.loadPlane.mockResolvedValue({
      data: new Uint16Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      sourceWidth: 2,
      sourceHeight: 2,
      level: '0',
      axes: { x: { spacing: 1, unit: 'Pixels' }, y: { spacing: 1, unit: 'Pixels' } },
    })
    const state = useViewerState({ maxBytes: 1024, maxEntries: 4 })
    await state.openAcqImageCollection('https://example.test/collection.ome.zarr/')
    const document = state.acqImageDocument.value!

    await state.loadPlane(document.data.image, document.url, { channel: 0, z: 0, t: 0 })
    await state.loadPlane(document.data.image, document.url, { channel: 0, z: 0, t: 0 })

    expect(sourceMocks.loadPlane).toHaveBeenCalledTimes(1)
  })
})
