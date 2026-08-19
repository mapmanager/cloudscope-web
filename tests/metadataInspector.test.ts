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
})
