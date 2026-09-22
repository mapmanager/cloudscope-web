<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { browserDirectoryPickerSupported } from '../data/browserDirectory'
import type { CloudScopeSample } from '../data/sampleCatalog'

withDefaults(
  defineProps<{
    modelValue: string
    loading: boolean
    samples?: readonly CloudScopeSample[]
    sampleCatalogError?: string | null
  }>(),
  {
    samples: () => [],
    sampleCatalogError: null,
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  open: []
  'open-sample': [url: string]
  'open-local-directory': []
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const localDirectorySupported = browserDirectoryPickerSupported()

/** Close the collection popover when a pointer interaction occurs outside it. */
function handleDocumentPointerDown(event: PointerEvent): void {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}

/** Support the conventional Escape-key dismissal behavior. */
function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

function openHostedCollection(): void {
  open.value = false
  emit('open')
}

function openSampleCollection(event: Event): void {
  open.value = false
  emit('open-sample', (event.target as HTMLSelectElement).value)
}

function openLocalDirectory(): void {
  open.value = false
  emit('open-local-directory')
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeyDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeyDown)
})
</script>

<template>
  <div ref="root" class="collection-source">
    <button
      type="button"
      class="collection-source__trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = !open"
    >
      Open collection
    </button>
    <div v-if="open" class="collection-source__popover" role="dialog" aria-label="Open collection">
      <section aria-labelledby="ome-zarr-source-heading">
        <h2 id="ome-zarr-source-heading" class="collection-source__heading">
          OME-Zarr collections
        </h2>
        <form class="collection-source__row">
          <label for="sample-collection">Sample AcqStore OME-Zarr</label>
          <select
            id="sample-collection"
            :value="samples.some(({ url }) => url === modelValue) ? modelValue : ''"
            :disabled="loading || samples.length === 0"
            @change="openSampleCollection"
          >
            <option value="" disabled>Choose a sample…</option>
            <option v-for="sample in samples" :key="sample.url" :value="sample.url">
              {{ sample.name }}
            </option>
          </select>
        </form>
        <p v-if="sampleCatalogError" class="muted">{{ sampleCatalogError }}</p>
        <form @submit.prevent="openHostedCollection">
          <div class="collection-source__row">
            <button type="submit" :disabled="loading || !modelValue.trim()">
              {{ loading ? 'Loading…' : 'Open AcqStore OME-Zarr URL' }}
            </button>
            <input
              id="collection-url"
              aria-label="AcqStore OME-Zarr URL"
              :value="modelValue"
              type="url"
              required
              spellcheck="false"
              placeholder="https://example.org/collection.ome.zarr/"
              @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </form>
        <div class="collection-source__section">
          <div class="collection-source__row">
            <button
              type="button"
              :disabled="loading || !localDirectorySupported"
              @click="openLocalDirectory"
            >
              Open Local AcqStore OME-Zarr
            </button>
          </div>
          <p v-if="!localDirectorySupported" class="muted">
            Local directory loading requires Chrome or Edge.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
