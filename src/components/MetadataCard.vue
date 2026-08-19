<script setup lang="ts">
import { computed } from 'vue'

import { metadataEntries } from '../data/metadataPresentation'

const props = defineProps<{ metadata: Record<string, unknown>; emptyMessage: string }>()
const entries = computed(() => metadataEntries(props.metadata))
</script>

<template>
  <dl v-if="entries.length" class="metadata-list">
    <template v-for="entry in entries" :key="entry.label">
      <dt>{{ entry.label }}</dt>
      <dd>{{ entry.value }}</dd>
    </template>
  </dl>
  <p v-else class="muted metadata-empty">{{ emptyMessage }}</p>
</template>
