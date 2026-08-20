<script setup lang="ts">
import { X } from '@lucide/vue'

import type { AcqImageCollectionRow } from '../models/acqImageModels'
import AcqImageCollectionTable from './AcqImageCollectionTable.vue'

defineProps<{
  acqImages: AcqImageCollectionRow[]
  selectedAcqImageId: string | null
}>()
defineEmits<{ close: []; select: [acqImageId: string] }>()
</script>

<template>
  <aside class="metadata-inspector" aria-label="Files">
    <header class="metadata-inspector__header">
      <h2>Files</h2>
      <button type="button" class="icon-button" aria-label="Close files" @click="$emit('close')">
        <X :size="17" aria-hidden="true" />
      </button>
    </header>
    <div class="metadata-inspector__body metadata-inspector__body--table">
      <AcqImageCollectionTable
        :acq-images="acqImages"
        :selected-acq-image-id="selectedAcqImageId"
        :columns="['file', 'channels', 'rois']"
        @select="$emit('select', $event)"
      />
    </div>
  </aside>
</template>
