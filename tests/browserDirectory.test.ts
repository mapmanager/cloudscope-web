import { describe, expect, it } from 'vitest'

import { createDirectoryFetch } from '../src/data/browserDirectory'
import { BrowserDirectoryCollectionSource } from '../src/data/viewerDataSource'

type Tree = { [name: string]: Tree | string | Uint8Array }

function directoryHandle(name: string, tree: Tree): FileSystemDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    async getDirectoryHandle(childName: string) {
      const child = tree[childName]
      if (!child || typeof child === 'string' || child instanceof Uint8Array) {
        throw new DOMException('Directory not found', 'NotFoundError')
      }
      return directoryHandle(childName, child)
    },
    async getFileHandle(childName: string) {
      const child = tree[childName]
      if (child === undefined || (typeof child !== 'string' && !(child instanceof Uint8Array))) {
        throw new DOMException('File not found', 'NotFoundError')
      }
      return {
        kind: 'file' as const,
        name: childName,
        async getFile() {
          const contents: BlobPart =
            typeof child === 'string'
              ? child
              : (child.buffer.slice(
                  child.byteOffset,
                  child.byteOffset + child.byteLength,
                ) as ArrayBuffer)
          return new File([contents], childName)
        },
      }
    },
  }
  return handle as unknown as FileSystemDirectoryHandle
}

const collectionManifest = {
  format: 'acqstore-acq-image-collection',
  version: 1,
  zarr_format: 3,
  name: 'local velocity',
  created_utc: '2026-08-23T00:00:00Z',
  acqstore_version: '0.2.0',
  acq_images: [
    {
      id: 'acq_image_000',
      name: 'sample.oir',
      source: { filename: 'sample.oir', relative_path: 'sample.oir' },
      ome_zarr_path: 'acq_images/acq_image_000',
      sidecar_path: 'acq_images/acq_image_000/acqstore/acq_image.json',
      manifest_path: 'acq_images/acq_image_000/acqstore/manifest.json',
      summary: {
        accepted: true,
        acquisition: { date: '', time: '' },
        analysis_types: [],
        dims: ['y', 'x'],
        dtype: 'uint16',
        has_reference_image: false,
        num_channels: 1,
        num_rois: 0,
        shape: [2, 2],
        sizes: { y: 2, x: 2 },
      },
    },
  ],
  analysis_tables: {
    velocity: {
      csv: 'acqstore/analysis_tables/velocity.csv',
      nicepool_state: 'acqstore/analysis_tables/velocity.nicepool.json',
    },
  },
}

describe('browser directory transport', () => {
  it('reads files lazily and supports byte ranges for Zarr stores', async () => {
    const root = directoryHandle('sample.ome.zarr', {
      'zarr.json': '{"zarr_format":3}',
      chunks: { value: new Uint8Array([10, 20, 30, 40]) },
    })
    const base = new URL('https://local-ome-zarr.invalid/sample/')
    const resourceFetch = createDirectoryFetch(root, base)

    await expect((await resourceFetch(new URL('zarr.json', base))).text()).resolves.toBe(
      '{"zarr_format":3}',
    )
    const ranged = await resourceFetch(new URL('chunks/value', base), {
      headers: { Range: 'bytes=1-2' },
    })
    expect(ranged.status).toBe(206)
    expect([...new Uint8Array(await ranged.arrayBuffer())]).toEqual([20, 30])
    expect((await resourceFetch(new URL('missing', base))).status).toBe(404)
    expect((await resourceFetch(new URL('../outside', base))).status).toBe(403)
  })

  it('loads the current collection manifest through ViewerDataSource', async () => {
    const root = directoryHandle('sample.ome.zarr', {
      acqstore: {
        'acq_image_collection.json': JSON.stringify(collectionManifest),
        analysis_tables: {
          'velocity.csv': 'pool_row_id,velocity\na,1\n',
          'velocity.nicepool.json': '{"schemaVersion":1}',
        },
      },
    })

    const loaded = await new BrowserDirectoryCollectionSource(root).loadCollection()

    expect(loaded.data.name).toBe('local velocity')
    expect(loaded.data.acq_images[0]?.id).toBe('acq_image_000')
    expect(loaded.url.protocol).toBe('https:')
    await expect(
      new BrowserDirectoryCollectionSource(root).loadJson(
        new URL(
          'acqstore/analysis_tables/velocity.nicepool.json',
          'https://local-ome-zarr.invalid/sample.ome.zarr/',
        ),
      ),
    ).resolves.toEqual({ schemaVersion: 1 })
  })

  it('rejects legacy collections instead of maintaining compatibility code', async () => {
    const root = directoryHandle('legacy.ome.zarr', {
      acqstore: {
        'manifest.json': JSON.stringify({ format: 'acqstore-multi-image-ome-zarr' }),
      },
    })

    await expect(new BrowserDirectoryCollectionSource(root).loadCollection()).rejects.toThrow(
      'legacy AcqStore OME-Zarr collection; re-export',
    )
  })
})
