import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AcqImageCollectionTable from '../src/components/AcqImageCollectionTable.vue'
import type { AcqImageCollectionRow } from '../src/models/acqImageModels'

const rows: AcqImageCollectionRow[] = [
  {
    id: 'image-1',
    name: 'one.tif',
    href: 'images/one.json',
    shape: [5, 4],
    dims: ['y', 'x'],
    sizes: { y: 5, x: 4 },
    dtype: 'uint16',
    axes: [],
    acquisition: { date: '2022-01-10', time: '12:00' },
    num_channels: 2,
    num_rois: 1,
    analysis_types: ['diameter'],
    accepted: true,
    has_reference_image: false,
  },
]

describe('AcqImageCollectionTable', () => {
  it('emits select for the compact files columns', async () => {
    const wrapper = mount(AcqImageCollectionTable, {
      props: {
        acqImages: rows,
        selectedAcqImageId: 'image-1',
        columns: ['file', 'channels', 'rois'],
      },
    })

    expect(wrapper.text()).toContain('one.tif')
    expect(wrapper.get('thead th').text()).toBe('#')
    expect(wrapper.get('tbody td').text()).toBe('1')
    expect(wrapper.text()).toContain('File')
    expect(wrapper.text()).toContain('Channels')
    expect(wrapper.text()).toContain('ROIs')
    expect(wrapper.text()).not.toContain('Dimensions')
    expect(wrapper.text()).not.toContain('Acquired')
    expect(wrapper.text()).not.toContain('Unload')

    await wrapper.get('tbody tr').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['image-1']])
  })
})
