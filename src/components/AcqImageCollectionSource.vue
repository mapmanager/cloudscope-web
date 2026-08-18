<script setup lang="ts">
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
</script>

<template>
  <details class="collection-source">
    <summary>Open collection</summary>
    <div class="collection-source__popover">
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
      <form v-if="showLocalServer" @submit.prevent>
        <label for="server-url">AcqStore Server</label>
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
      <details class="collection-source__advanced">
        <summary>Open hosted AcqImageCollection</summary>
        <form @submit.prevent="emit('open')">
          <label for="collection-url">AcqImageCollection OME-Zarr root URL</label>
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
      </details>
    </div>
  </details>
</template>
