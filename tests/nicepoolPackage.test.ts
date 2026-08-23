import { describe, expect, it } from 'vitest'

import { NicePoolEngine } from '@mapmanager/nicepool'

describe('@mapmanager/nicepool integration', () => {
  it('loads the shared package and initializes its framework-independent engine', () => {
    const engine = new NicePoolEngine()
    engine.setData({
      rowIdColumn: 'row_id',
      rows: [
        { row_id: 'row-1', time: 0, velocity: -1.5 },
        { row_id: 'row-2', time: 1, velocity: 2.5 },
      ],
    })

    expect(engine.state.layout).toBe('1x1')
    expect(engine.state.plots).toHaveLength(4)
    expect(engine.selection.selectedRowIds).toEqual([])
  })
})
