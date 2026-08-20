import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppToolbar from '../src/components/AppToolbar.vue'

describe('AppToolbar', () => {
  it('emits the requested inspector and marks the active button', async () => {
    const wrapper = mount(AppToolbar, {
      props: { active: 'image-header', filesDisabled: false, metadataDisabled: false },
    })

    expect(wrapper.get('[aria-label="Header metadata"]').classes()).toContain('active')
    await wrapper.get('[aria-label="Experimental metadata"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['experiment']])
  })

  it('opens the files pane independently of metadata', async () => {
    const wrapper = mount(AppToolbar, {
      props: { active: null, filesDisabled: false, metadataDisabled: true },
    })

    expect(wrapper.get('[aria-label="File table"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[aria-label="Header metadata"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="File table"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['files']])
  })

  it('disables metadata actions when no AcqImage is selected', () => {
    const wrapper = mount(AppToolbar, {
      props: { active: null, filesDisabled: true, metadataDisabled: true },
    })
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})
