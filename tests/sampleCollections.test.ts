import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AcqImageCollectionSource from '../src/components/AcqImageCollectionSource.vue'
import { defaultSampleCollection, sampleCollections } from '../src/config/sampleCollections'

describe('hosted sample catalog', () => {
  it('has unique IDs and valid R2-hosted URLs', () => {
    expect(new Set(sampleCollections.map(({ id }) => id)).size).toBe(sampleCollections.length)
    expect(new Set(sampleCollections.map(({ url }) => url)).size).toBe(sampleCollections.length)

    for (const sample of sampleCollections) {
      const url = new URL(sample.url)

      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe('data.mapmanager.net')
      expect(url.pathname).toMatch(/^\/samples\/.+\.ome\.zarr\/$/)
    }

    expect(defaultSampleCollection.id).toBe('diameter')
  })

  it('emits the selected sample and hides local-server controls in production mode', async () => {
    const wrapper = mount(AcqImageCollectionSource, {
      props: {
        modelValue: defaultSampleCollection.url,
        serverUrl: 'http://127.0.0.1:8767',
        loading: false,
        showLocalServer: false,
      },
    })
    await wrapper.get('.collection-source__trigger').trigger('click')

    expect(wrapper.get<HTMLSelectElement>('#sample-collection').element.value).toBe(
      defaultSampleCollection.url,
    )
    await wrapper.get('#sample-collection').setValue(sampleCollections[1].url)

    expect(wrapper.emitted('open-sample')).toEqual([[sampleCollections[1].url]])
    expect(wrapper.find('#server-url').exists()).toBe(false)
  })
})
