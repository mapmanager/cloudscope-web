import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AcqImageCollectionSource from '../src/components/AcqImageCollectionSource.vue'
const samples = [
  {
    name: 'Diameter sample',
    url: 'https://data.mapmanager.net/cloudscope-web/samples/diameter-sample-data.ome.zarr/',
  },
  {
    name: 'Velocity sample',
    url: 'https://data.mapmanager.net/cloudscope-web/samples/velocity-sample-data.ome.zarr/',
  },
] as const

describe('hosted sample catalog', () => {
  it('emits the selected sample', async () => {
    const wrapper = mount(AcqImageCollectionSource, {
      props: {
        modelValue: samples[0].url,
        loading: false,
        samples,
        sampleCatalogError: null,
      },
    })
    await wrapper.get('.collection-source__trigger').trigger('click')

    expect(wrapper.get<HTMLSelectElement>('#sample-collection').element.value).toBe(samples[0].url)
    await wrapper.get('#sample-collection').setValue(samples[1].url)

    expect(wrapper.emitted('open-sample')).toEqual([[samples[1].url]])
    expect(wrapper.find('.collection-source__popover').exists()).toBe(false)
  })
})
