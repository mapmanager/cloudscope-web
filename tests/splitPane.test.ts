import { describe, expect, it } from 'vitest'

import { clampSplitSize } from '../src/data/splitPane'

describe('split pane sizing', () => {
  it('keeps both panes above their minimum sizes', () => {
    expect(clampSplitSize(20, 600, 100, 160)).toBe(100)
    expect(clampSplitSize(500, 600, 100, 160)).toBe(440)
    expect(clampSplitSize(280, 600, 100, 160)).toBe(280)
  })
})
