<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { sampleCollections } from '../config/sampleCollections'

defineProps<{ modelValue: string; serverUrl: string; loading: boolean; showLocalServer: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:serverUrl': [value: string]
  open: []
  'open-sample': [url: string]
  'open-server': [kind: 'file' | 'folder' | 'csv']
  'open-exported-folder': []
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)

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
      </section>
      <section
        v-if="showLocalServer"
        class="collection-source__section"
        aria-labelledby="server-source-heading"
      >
        <h2 id="server-source-heading" class="collection-source__heading">
          AcqStore Server (local)
        </h2>
        <form @submit.prevent>
          <label for="server-url">Server URL</label>
          <div class="collection-source__row">
            <input
              id="server-url"
              :value="serverUrl"
              type="url"
              required
              spellcheck="false"
              placeholder="http://127.0.0.1:8767"
              @input="emit('update:serverUrl', ($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              :disabled="loading || !serverUrl.trim()"
              @click="emit('open-server', 'file')"
            >
              Open file
            </button>
            <button
              type="button"
              :disabled="loading || !serverUrl.trim()"
              @click="emit('open-server', 'folder')"
            >
              Open folder
            </button>
            <button
              type="button"
              :disabled="loading || !serverUrl.trim()"
              @click="emit('open-server', 'csv')"
            >
              Open CSV
            </button>
            <button
              type="button"
              :disabled="loading || !serverUrl.trim()"
              @click="emit('open-exported-folder')"
            >
              Open exported folder
            </button>
          </div>
          <p class="muted">The local server opens the native file or folder picker.</p>
        </form>
      </section>
    </div>
  </div>
</template>
