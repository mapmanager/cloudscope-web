import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadAcqImage, loadDataset } from '../src/data/datasetLoader'

afterEach(() => vi.unstubAllGlobals())

describe('dataset loader', () => {
  it('resolves image manifests relative to dataset.json', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ format: 'acqstore-web-dataset', format_version: 1, images: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ format: 'acqstore-web-acqimage', format_version: 1 }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const dataset = await loadDataset('https://example.test/study/dataset.json')
    await loadAcqImage(dataset.url, 'images/image-1/acqimage.json')

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL('https://example.test/study/images/image-1/acqimage.json'),
      undefined,
    )
  })

  it('rejects an incompatible dataset format', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ format: 'other', format_version: 1 }),
      }),
    )
    await expect(loadDataset('https://example.test/dataset.json')).rejects.toThrow('Web Dataset v1')
  })
})
