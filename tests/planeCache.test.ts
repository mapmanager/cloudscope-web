import { describe, expect, it, vi } from 'vitest'

import type { ImagePlane } from '../src/data/omeZarrLoader'
import { PlaneCache } from '../src/data/planeCache'

function plane(values: number[]): ImagePlane {
  return {
    data: new Uint16Array(values),
    width: values.length,
    height: 1,
    sourceWidth: values.length,
    sourceHeight: 1,
    level: '0',
    axes: { x: { spacing: 1, unit: 'Pixels' }, y: { spacing: 1, unit: 'Pixels' } },
  }
}

describe('PlaneCache', () => {
  it('deduplicates requests and invalidates one image', async () => {
    const cache = new PlaneCache({ maxBytes: 1024, maxEntries: 4 })
    const loader = vi.fn(async () => plane([1, 2]))

    const [first, second] = await Promise.all([
      cache.getOrLoad('a-c0', 'a', loader),
      cache.getOrLoad('a-c0', 'a', loader),
    ])
    await cache.getOrLoad('a-c0', 'a', loader)

    expect(first).toBe(second)
    expect(loader).toHaveBeenCalledTimes(1)
    cache.invalidateImage('a')
    expect(cache.size).toBe(0)
    await cache.getOrLoad('a-c0', 'a', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('evicts least-recently-used planes by entry and byte limits', async () => {
    const cache = new PlaneCache({ maxBytes: 6, maxEntries: 2 })
    const loaders = [1, 2, 3].map((value) => vi.fn(async () => plane([value])))

    await cache.getOrLoad('one', 'a', loaders[0]!)
    await cache.getOrLoad('two', 'a', loaders[1]!)
    await cache.getOrLoad('one', 'a', loaders[0]!)
    await cache.getOrLoad('three', 'a', loaders[2]!)
    await cache.getOrLoad('two', 'a', loaders[1]!)

    expect(loaders[0]).toHaveBeenCalledTimes(1)
    expect(loaders[1]).toHaveBeenCalledTimes(2)
    expect(cache.byteLength).toBeLessThanOrEqual(6)
  })
})
