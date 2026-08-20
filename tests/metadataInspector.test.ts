import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MetadataInspector from '../src/components/MetadataInspector.vue'

describe('MetadataInspector', () => {
  it('distinguishes loading metadata from loaded-but-empty metadata', async () => {
    const wrapper = mount(MetadataInspector, {
      props: {
        title: 'Experiment metadata',
        metadata: {},
        emptyMessage: 'No experiment metadata is available.',
        loading: true,
      },
    })

    expect(wrapper.text()).toContain('Loading selected AcqImage…')
    expect(wrapper.text()).not.toContain('No experiment metadata is available.')

    await wrapper.setProps({ loading: false })
    expect(wrapper.text()).toContain('No experiment metadata is available.')
  })

  it('keeps populated metadata visible while the next AcqImage is loading', () => {
    const wrapper = mount(MetadataInspector, {
      props: {
        title: 'Image header',
        metadata: { shape: [5, 4], dtype: 'uint16' },
        emptyMessage: 'No image header metadata is available.',
        loading: true,
      },
    })

    expect(wrapper.text()).toContain('shape')
    expect(wrapper.text()).toContain('uint16')
    expect(wrapper.text()).not.toContain('Loading selected AcqImage…')
  })
})
