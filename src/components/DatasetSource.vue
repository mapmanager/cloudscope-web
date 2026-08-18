<script setup lang="ts">
defineProps<{ modelValue: string; serverUrl: string; loading: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:serverUrl': [value: string]
  open: []
  'open-server': [kind: 'file' | 'folder' | 'csv']
  'open-exported-folder': []
}>()
</script>

<template>
  <details class="dataset-source">
    <summary>Open dataset</summary>
    <div class="dataset-source__popover">
      <form @submit.prevent>
        <label for="server-url">AcqStore Server</label>
        <div class="dataset-source__row">
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
            Open exported dataset folder
          </button>
        </div>
        <p class="muted">The local server opens the native file or folder picker.</p>
      </form>
      <details class="dataset-source__advanced">
        <summary>Open hosted OME-Zarr collection</summary>
        <form @submit.prevent="emit('open')">
          <label for="dataset-url">OME-Zarr collection root URL</label>
          <div class="dataset-source__row">
            <input
              id="dataset-url"
              :value="modelValue"
              type="url"
              required
              spellcheck="false"
              placeholder="https://example.org/dataset.ome.zarr/"
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
