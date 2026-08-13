<script setup lang="ts">
import { computed } from 'vue'

import type { AcqImageDocument } from '../models/webDataset'

const props = defineProps<{
  image: AcqImageDocument
  channel: number
  roiId: number | null
  z: number
  t: number
}>()
const emit = defineEmits<{
  'update:channel': [value: number]
  'update:roiId': [value: number | null]
  'update:z': [value: number]
  'update:t': [value: number]
}>()

const zSize = computed(() => props.image.image.sizes.z ?? 0)
const tSize = computed(() => props.image.image.sizes.t ?? 0)
</script>

<template>
  <div class="selection-controls">
    <label>
      Channel
      <select
        :value="channel"
        @change="emit('update:channel', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="item in image.image.channels" :key="item.index" :value="item.index">
          Channel {{ item.index }}
        </option>
      </select>
    </label>

    <label>
      ROI
      <select
        :value="roiId ?? ''"
        :disabled="image.rois.length === 0"
        @change="
          emit(
            'update:roiId',
            ($event.target as HTMLSelectElement).value === ''
              ? null
              : Number(($event.target as HTMLSelectElement).value),
          )
        "
      >
        <option value="">No ROI</option>
        <option v-for="roi in image.rois" :key="roi.id" :value="roi.id">
          {{ roi.name || `ROI ${roi.id}` }}
        </option>
      </select>
    </label>

    <label v-if="zSize > 0">
      Z
      <input
        :value="z"
        type="number"
        min="0"
        :max="zSize - 1"
        @input="emit('update:z', Number(($event.target as HTMLInputElement).value))"
      />
    </label>

    <label v-if="tSize > 0">
      T
      <input
        :value="t"
        type="number"
        min="0"
        :max="tSize - 1"
        @input="emit('update:t', Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </div>
</template>
