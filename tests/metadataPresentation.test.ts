import { describe, expect, it } from 'vitest'

import { metadataEntries } from '../src/data/metadataPresentation'

describe('metadata presentation', () => {
  it('flattens nested objects and preserves compact primitive arrays', () => {
    expect(
      metadataEntries({ animal: { species: 'mouse' }, channels: [0, 1], empty: null }),
    ).toEqual([
      { label: 'animal.species', value: 'mouse' },
      { label: 'channels', value: '0, 1' },
      { label: 'empty', value: 'null' },
    ])
  })
})
