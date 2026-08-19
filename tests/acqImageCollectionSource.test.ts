import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import AcqImageCollectionSource from '../src/components/AcqImageCollectionSource.vue'

afterEach(() => {
  document.body.replaceChildren()
})

describe('AcqImageCollectionSource', () => {
  it('light-dismisses the open panel after an outside pointer interaction', async () => {
    const wrapper = mount(AcqImageCollectionSource, {
      attachTo: document.body,
      props: { modelValue: '', serverUrl: '', loading: false, showLocalServer: false },
    })

    await wrapper.get('.collection-source__trigger').trigger('click')
    expect(wrapper.find('.collection-source__popover').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.collection-source__popover').exists()).toBe(false)
    wrapper.unmount()
  })

  it('dismisses the open panel with Escape', async () => {
    const wrapper = mount(AcqImageCollectionSource, {
      attachTo: document.body,
      props: { modelValue: '', serverUrl: '', loading: false, showLocalServer: false },
    })

    await wrapper.get('.collection-source__trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.collection-source__popover').exists()).toBe(false)
    wrapper.unmount()
  })
})
