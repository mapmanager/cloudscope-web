<script setup lang="ts">
import { FileJson2, FlaskConical } from '@lucide/vue'

/** Metadata views supported by the fixed AcqImage inspector toolbar. */
export type InspectorKind = 'image-header' | 'experiment'

defineProps<{ active: InspectorKind | null; disabled: boolean }>()
defineEmits<{ select: [kind: InspectorKind] }>()
</script>

<template>
  <nav class="app-toolbar" aria-label="AcqImage information">
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'image-header' }"
      :disabled="disabled"
      aria-label="Image header metadata"
      title="Image header metadata"
      @click="$emit('select', 'image-header')"
    >
      <FileJson2 :size="19" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-button"
      :class="{ active: active === 'experiment' }"
      :disabled="disabled"
      aria-label="Experiment metadata"
      title="Experiment metadata"
      @click="$emit('select', 'experiment')"
    >
      <FlaskConical :size="19" aria-hidden="true" />
    </button>
  </nav>
</template>
