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
  format: 'acqstore-ome-zarr-collection',
  version: 1,
  id: 'collection-uuid',
  name: 'local velocity',
  created: '2026-08-23T00:00:00Z',
  producer: { name: 'acqstore' },
  members: [
    {
      id: 'image-uuid',
      name: 'sample.oir',
      ome_zarr: 'images/image-uuid',
      resources: { acqimage: 'metadata/image-uuid/acqimage.json' },
      summary: {
        accepted: true,
        analysis_types: [],
        dims: ['y', 'x'],
        dtype: 'uint16',
        has_reference_image: false,
        num_channels: 1,
        num_rois: 0,
        shape: [2, 2],
      },
    },
  ],
  resources: {
    tables: [{ id: 'velocity', media_type: 'text/csv', path: 'tables/velocity.csv' }],
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
        'collection.json': JSON.stringify(collectionManifest),
      },
      tables: { 'velocity.csv': 'pool_row_id,velocity\na,1\n' },
    })

    const loaded = await new BrowserDirectoryCollectionSource(root).loadCollection()

    expect(loaded.data.name).toBe('local velocity')
    expect(loaded.data.acq_images[0]?.id).toBe('image-uuid')
    expect(loaded.url.protocol).toBe('https:')
  })

  it('requires the Collection v1 entry point', async () => {
    const root = directoryHandle('legacy.ome.zarr', {
      acqstore: {
        'manifest.json': JSON.stringify({ format: 'acqstore-multi-image-ome-zarr' }),
      },
    })

    await expect(new BrowserDirectoryCollectionSource(root).loadCollection()).rejects.toThrow(
      'missing acqstore/collection.json',
    )
  })
})
