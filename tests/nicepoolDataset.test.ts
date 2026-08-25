import { describe, expect, it } from 'vitest'

import {
  csvTableToNicePoolDataset,
  nicePoolSelectionForViewer,
  nicePoolTargetForSelection,
} from '../src/data/nicepoolDataset'

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

const rows = [
  { pool_row_id: 'row-a', acq_image_id: 'image-1', channel: 0, roi_id: 1, value: 2 },
  { pool_row_id: 'row-b', acq_image_id: 'image-1', channel: 1, roi_id: 2, value: 3 },
  { pool_row_id: 'row-c', acq_image_id: 'image-2', channel: 0, roi_id: 1, value: 4 },
]

describe('NicePool and viewer selection identity', () => {
  it('selects all analysis rows for an image and makes channel/ROI exact row primary', () => {
    expect(nicePoolSelectionForViewer(rows, 'image-1', 1, 2)).toEqual({
      primaryRowId: 'row-b',
      selectedRowIds: ['row-a', 'row-b'],
    })
  })

  it('resolves a primary analysis row to manifest image, channel, and ROI', () => {
    expect(
      nicePoolTargetForSelection(rows, {
        primaryRowId: 'row-c',
        selectedRowIds: ['row-c'],
      }),
    ).toEqual({ acqImageId: 'image-2', channel: 0, roiId: 1 })
  })
})
