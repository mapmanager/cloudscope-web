<script setup lang="ts">
import { ChartScatter, FileJson2, FlaskConical, Image, Info, Table2 } from '@lucide/vue'

/** Panes opened from the left inspector toolbar. */
export type InspectorKind = 'files' | 'reference-image' | 'image-header' | 'experiment' | 'app-info'

defineProps<{
  active: InspectorKind | null
  filesDisabled: boolean
  metadataDisabled: boolean
  nicepoolDisabled: boolean
  nicepoolOpen: boolean
}>()
defineEmits<{ select: [kind: InspectorKind]; 'toggle-nicepool': [] }>()
</script>

<template>
  <nav class="app-toolbar" aria-label="Views">
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'files' }"
      :disabled="filesDisabled"
      aria-label="File table"
      title="File table"
      @click="$emit('select', 'files')"
    >
      <Table2 :size="19" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-button"
      :class="{ active: nicepoolOpen }"
      :disabled="nicepoolDisabled"
      aria-label="NicePool"
      title="NicePool"
      @click="$emit('toggle-nicepool')"
    >
      <ChartScatter :size="19" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'image-header' }"
      :disabled="metadataDisabled"
      aria-label="Header metadata"
      title="Header metadata"
      @click="$emit('select', 'image-header')"
    >
      <FileJson2 :size="19" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'experiment' }"
      :disabled="metadataDisabled"
      aria-label="Experimental metadata"
      title="Experimental metadata"
      @click="$emit('select', 'experiment')"
    >
      <FlaskConical :size="19" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'reference-image' }"
      :disabled="metadataDisabled"
      aria-label="Reference image"
      title="Reference image"
      @click="$emit('select', 'reference-image')"
    >
      <Image :size="19" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'app-info' }"
      aria-label="App information"
      title="App information"
      @click="$emit('select', 'app-info')"
    >
      <Info :size="19" aria-hidden="true" />
    </button>
  </nav>
</template>
