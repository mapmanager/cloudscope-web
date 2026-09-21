<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { sampleCollections } from '../config/sampleCollections'
import { browserDirectoryPickerSupported } from '../data/browserDirectory'

defineProps<{ modelValue: string; loading: boolean }>()
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
        <form>
          <label for="sample-collection">Bundled sample</label>
          <div class="collection-source__row">
            <select
              id="sample-collection"
              :value="sampleCollections.some(({ url }) => url === modelValue) ? modelValue : ''"
              :disabled="loading"
              @change="emit('open-sample', ($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>Choose a sample…</option>
              <option v-for="sample in sampleCollections" :key="sample.id" :value="sample.url">
                {{ sample.name }} — {{ sample.description }}
              </option>
            </select>
          </div>
        </form>
        <form @submit.prevent="emit('open')">
          <label for="collection-url">Hosted AcqImageCollection OME-Zarr root URL</label>
          <div class="collection-source__row">
            <input
              id="collection-url"
              :value="modelValue"
              type="url"
              required
              spellcheck="false"
              placeholder="https://example.org/collection.ome.zarr/"
              @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
            />
            <button type="submit" :disabled="loading || !modelValue.trim()">
              {{ loading ? 'Loading…' : 'Open URL' }}
            </button>
          </div>
        </form>
        <div class="collection-source__section">
          <label>Local AcqStore OME-Zarr</label>
          <div class="collection-source__row">
            <button
              type="button"
              :disabled="loading || !localDirectorySupported"
              @click="emit('open-local-directory')"
            >
              Open local directory
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
