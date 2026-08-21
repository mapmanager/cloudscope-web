import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReferenceImageInspector from '../src/components/ReferenceImageInspector.vue'
import type { ImagePlane } from '../src/data/omeZarrLoader'
import type { ReferenceImageResource } from '../src/models/acqImageModels'

const viewerSpies = vi.hoisted(() => ({
  addXYPlot: vi.fn(),
  clear: vi.fn(),
  destroy: vi.fn(),
  hideXYPlot: vi.fn(),
  load: vi.fn().mockResolvedValue(undefined),
  showXYPlot: vi.fn(),
}))

vi.mock('../src/data/omeZarrLoader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/data/omeZarrLoader')>()),
  loadPixelDescriptor: vi.fn().mockResolvedValue({
    shape: [2, 512, 512],
    dims: ['c', 'y', 'x'],
    sizes: { c: 2, y: 512, x: 512 },
    dtype: 'uint16',
    axes: [
      { name: 'c', size: 2, spacing: 1, unit: 'Pixels' },
      { name: 'y', size: 512, spacing: 0.5, unit: 'micrometer' },
      { name: 'x', size: 512, spacing: 0.5, unit: 'micrometer' },
    ],
    num_channels: 2,
  }),
}))

vi.mock('../src/raster-viewer/raster-viewer.js', () => ({
  RasterViewer: class {
    loadSourcePlane = null
    displayWidth = 512
    displayHeight = 512
    addXYPlot = viewerSpies.addXYPlot
    clear = viewerSpies.clear
    destroy = viewerSpies.destroy
    hideXYPlot = viewerSpies.hideXYPlot
    load = viewerSpies.load
    showXYPlot = viewerSpies.showXYPlot
  },
}))

const image: ReferenceImageResource = {
  href: 'https://example.test/reference/',
  metadata: {},
  num_channels: 2,
  scan_path: { x_pixels: [10, 20], y_pixels: [30, 40] },
}

const plane: ImagePlane = {
  data: new Uint16Array(512 * 512),
  width: 512,
  height: 512,
  sourceWidth: 512,
  sourceHeight: 512,
  level: '0',
  axes: {
    x: { spacing: 0.5, unit: 'micrometer' },
    y: { spacing: 0.5, unit: 'micrometer' },
  },
}

describe('ReferenceImageInspector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads its own viewer and toggles the non-interactive scan path', async () => {
    const loadPlane = vi.fn().mockResolvedValue(plane)
    const wrapper = mount(ReferenceImageInspector, {
      props: {
        image,
        documentUrl: new URL('https://example.test/acqstore/manifest.json'),
        loadPlane,
      },
    })
    await flushPromises()

    expect(viewerSpies.load).toHaveBeenCalledOnce()
    expect(viewerSpies.addXYPlot).toHaveBeenCalledWith(
      expect.objectContaining({
        plot_id: 'reference-scan-path',
        mode: 'lines',
        x: [15, 20],
        y: [5, 10],
        visible: true,
      }),
    )

    await wrapper.get('input[type="checkbox"]').setValue(false)
    expect(viewerSpies.hideXYPlot).toHaveBeenCalledWith('reference-scan-path')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(viewerSpies.showXYPlot).toHaveBeenCalledWith('reference-scan-path')
  })

  it('shows a normal empty state without creating a data request', async () => {
    const loadPlane = vi.fn()
    const wrapper = mount(ReferenceImageInspector, {
      props: {
        image: null,
        documentUrl: new URL('https://example.test/acqstore/manifest.json'),
        loadPlane,
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('This AcqImage has no reference image.')
    expect(loadPlane).not.toHaveBeenCalled()
  })
})
