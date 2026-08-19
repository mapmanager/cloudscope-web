<script setup lang="ts">
import { X } from '@lucide/vue'

import MetadataCard from './MetadataCard.vue'

defineProps<{
  title: string
  metadata: Record<string, unknown>
  emptyMessage: string
}>()
defineEmits<{ close: [] }>()
</script>

<template>
  <aside class="metadata-inspector" :aria-label="title">
    <header class="metadata-inspector__header">
      <h2>{{ title }}</h2>
      <button
        type="button"
        class="icon-button"
        aria-label="Close metadata inspector"
        @click="$emit('close')"
      >
        <X :size="17" aria-hidden="true" />
      </button>
    </header>
    <div class="metadata-inspector__body">
      <MetadataCard :metadata="metadata" :empty-message="emptyMessage" />
    </div>
  </aside>
</template>
