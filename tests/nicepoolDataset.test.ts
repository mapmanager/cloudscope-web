import { describe, expect, it } from 'vitest'

import { csvTableToNicePoolDataset } from '../src/data/nicepoolDataset'

describe('NicePool collection table adapter', () => {
  it('infers scalar columns and preserves missing values as null', () => {
    const dataset = csvTableToNicePoolDataset({
      columns: ['pool_row_id', 'name', 'accept', 'velocity_mean'],
      rows: [
        {
          pool_row_id: '/source/a|channel=0|roi_id=1',
          name: '001',
          accept: 'True',
          velocity_mean: '-2.5',
        },
        {
          pool_row_id: '/source/b|channel=0|roi_id=1',
          name: 'sample',
          accept: 'False',
          velocity_mean: '',
        },
      ],
    })
    expect(dataset.rows).toEqual([
      {
        pool_row_id: '/source/a|channel=0|roi_id=1',
        name: '001',
        accept: true,
        velocity_mean: -2.5,
      },
      {
        pool_row_id: '/source/b|channel=0|roi_id=1',
        name: 'sample',
        accept: false,
        velocity_mean: null,
      },
    ])
  })

  it('rejects tables without stable row identities', () => {
    expect(() => csvTableToNicePoolDataset({ columns: ['value'], rows: [{ value: '1' }] })).toThrow(
      'missing required pool_row_id',
    )
  })
})
