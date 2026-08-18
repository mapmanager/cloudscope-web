import { afterEach, describe, expect, it, vi } from 'vitest'

import { AcqStoreServerSource, ServerExportedDatasetSource } from '../src/data/viewerDataSource'
import type { PixelDescriptor } from '../src/models/webDataset'

afterEach(() => vi.unstubAllGlobals())

describe('AcqStoreServerSource', () => {
  it('opens through the native picker, decodes a native plane, and closes the session', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/v2/datasets/pick')) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBe(JSON.stringify({ kind: 'folder' }))
        return Response.json({
          ok: true,
          datasetId: 'dataset-1',
          manifestUrl: '/api/v2/datasets/dataset-1/manifest',
        })
      }
      if (url.endsWith('/manifest')) {
        return Response.json({
          format: 'acqstore-web-dataset',
          format_version: 1,
          id: 'dataset-1',
          name: 'picked',
          images: [],
        })
      }
      if (url.includes('/planes?')) {
        return new Response(new Uint16Array([1, 2, 3, 4]).buffer, {
          headers: {
            'X-AcqStore-Dtype': 'uint16',
            'X-AcqStore-Shape': '2,2',
          },
        })
      }
      if (url.endsWith('/images/image-1/loaded-data') && init?.method === 'DELETE') {
        return Response.json({ ok: true, loadState: { pixels: false, analysisCsv: false } })
      }
      if (url.endsWith('/api/v2/datasets/dataset-1') && init?.method === 'DELETE') {
        return Response.json({ ok: true, deleted: true })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const source = new AcqStoreServerSource('http://127.0.0.1:8767', 'folder')
    const dataset = await source.loadDataset()
    const descriptor: PixelDescriptor = {
      href: '/api/v2/datasets/dataset-1/images/image-1/planes',
      shape: [2, 2],
      dims: ['y', 'x'],
      sizes: { y: 2, x: 2 },
      dtype: 'uint16',
      axes: [],
      num_channels: 1,
    }
    const plane = await source.loadPlane(
      descriptor,
      new URL('http://127.0.0.1:8767/api/v2/datasets/dataset-1/images/image-1'),
      { channel: 0, z: 0, t: 0 },
    )
    await source.unloadImage('image-1')
    await source.close()

    expect(dataset.data.id).toBe('dataset-1')
    expect(plane.data).toBeInstanceOf(Uint16Array)
    expect(Array.from(plane.data)).toEqual([1, 2, 3, 4])
    expect(plane.width).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})

describe('ServerExportedDatasetSource', () => {
  it('opens a picked export through its temporary URL and closes it', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/v2/web-exports/pick')) {
        return Response.json({
          ok: true,
          exportId: 'export-1',
          manifestUrl: '/api/v2/web-exports/export-1/dataset.json',
        })
      }
      if (url.endsWith('/dataset.json')) {
        return Response.json({
          format: 'acqstore-web-dataset',
          format_version: 1,
          id: 'export-1',
          name: 'picked export',
          images: [],
        })
      }
      if (url.endsWith('/api/v2/web-exports/export-1') && init?.method === 'DELETE') {
        return Response.json({ ok: true, deleted: true })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const source = new ServerExportedDatasetSource('http://127.0.0.1:8767')

    const dataset = await source.loadDataset()
    await source.close()

    expect(dataset.data.name).toBe('picked export')
    expect(source.persistInUrl).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
