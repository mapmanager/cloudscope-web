import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppToolbar from '../src/components/AppToolbar.vue'

describe('AppToolbar', () => {
  it('presents inspector buttons in workflow order', () => {
    const wrapper = mount(AppToolbar, {
      props: { active: null, filesDisabled: false, metadataDisabled: false },
    })

    expect(wrapper.findAll('button').map((button) => button.attributes('aria-label'))).toEqual([
      'File table',
      'Header metadata',
      'Experimental metadata',
      'Reference image',
      'App information',
    ])
  })

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

  it('opens the reference image pane for a selected AcqImage', async () => {
    const wrapper = mount(AppToolbar, {
      props: { active: null, filesDisabled: false, metadataDisabled: false },
    })

    await wrapper.get('[aria-label="Reference image"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['reference-image']])
  })

  it('keeps app information available when no collection is open', async () => {
    const wrapper = mount(AppToolbar, {
      props: { active: null, filesDisabled: true, metadataDisabled: true },
    })
    expect(wrapper.get('[aria-label="File table"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Header metadata"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Experimental metadata"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Reference image"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="App information"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[aria-label="App information"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['app-info']])
  })
})
