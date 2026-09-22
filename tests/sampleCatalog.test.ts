import { describe, expect, it } from 'vitest'

import { loadSampleCatalog } from '../src/data/sampleCatalog'

const fetchJson =
  (value: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(value), { status })

describe('CloudScope sample catalog', () => {
  it('resolves ordered relative collection URLs against the catalog', async () => {
    const samples = await loadSampleCatalog(
      'https://data.mapmanager.net/cloudscope-web/samples.json',
      fetchJson([
        { name: 'First', url: './samples/first.ome.zarr/' },
        { name: 'Second', url: './samples/second.ome.zarr/' },
      ]),
    )
    expect(samples.map(({ name }) => name)).toEqual(['First', 'Second'])
    expect(samples[0]?.url).toBe(
      'https://data.mapmanager.net/cloudscope-web/samples/first.ome.zarr/',
    )
  })

  it('rejects malformed entries and duplicate resolved URLs', async () => {
    await expect(
      loadSampleCatalog(
        'https://example.test/samples.json',
        fetchJson([{ name: '', url: './one/' }]),
      ),
    ).rejects.toThrow('entry 0')
    await expect(
      loadSampleCatalog(
        'https://example.test/samples.json',
        fetchJson([
          { name: 'One', url: './one/' },
          { name: 'Again', url: './one/' },
        ]),
      ),
    ).rejects.toThrow('duplicate URLs')
  })

  it('reports HTTP failures without inventing catalog entries', async () => {
    await expect(
      loadSampleCatalog('https://example.test/samples.json', fetchJson({}, 404)),
    ).rejects.toThrow('HTTP 404')
  })
})
