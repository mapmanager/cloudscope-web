import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('offers the Chrome/Edge local-directory action', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    const wrapper = mount(AcqImageCollectionSource, {
      props: { modelValue: '', serverUrl: '', loading: false, showLocalServer: false },
    })

    await wrapper.get('.collection-source__trigger').trigger('click')
    const localButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Open local directory')
    expect(localButton).toBeDefined()
    await localButton!.trigger('click')

    expect(wrapper.emitted('open-local-directory')).toEqual([[]])
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
