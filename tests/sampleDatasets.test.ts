import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DatasetSource from '../src/components/DatasetSource.vue'
import { defaultSampleDataset, sampleDatasets } from '../src/config/sampleDatasets'

describe('bundled sample catalog', () => {
  it('has unique IDs and deployment-safe URLs', () => {
    expect(new Set(sampleDatasets.map(({ id }) => id)).size).toBe(sampleDatasets.length)
    expect(new Set(sampleDatasets.map(({ url }) => url)).size).toBe(sampleDatasets.length)
    for (const sample of sampleDatasets) {
      expect(sample.url).toMatch(/^\.\/samples\/.+\.ome\.zarr\/$/)
    }
    expect(defaultSampleDataset.id).toBe('diameter')
  })

  it('emits the selected sample and hides local-server controls in production mode', async () => {
    const wrapper = mount(DatasetSource, {
      props: {
        modelValue: defaultSampleDataset.url,
        serverUrl: 'http://127.0.0.1:8767',
        loading: false,
        showLocalServer: false,
      },
    })

    expect(wrapper.get<HTMLSelectElement>('#sample-dataset').element.value).toBe(
      defaultSampleDataset.url,
    )
    await wrapper.get('#sample-dataset').setValue(sampleDatasets[1].url)

    expect(wrapper.emitted('open-sample')).toEqual([[sampleDatasets[1].url]])
    expect(wrapper.find('#server-url').exists()).toBe(false)
  })
})
