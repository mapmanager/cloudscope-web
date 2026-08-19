import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppToolbar from '../src/components/AppToolbar.vue'

describe('AppToolbar', () => {
  it('emits the requested inspector and marks the active button', async () => {
    const wrapper = mount(AppToolbar, {
      props: { active: 'image-header', disabled: false },
    })

    expect(wrapper.get('[aria-label="Image header metadata"]').classes()).toContain('active')
    await wrapper.get('[aria-label="Experiment metadata"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['experiment']])
  })

  it('disables metadata actions when no AcqImage is selected', () => {
    const wrapper = mount(AppToolbar, { props: { active: null, disabled: true } })
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})
