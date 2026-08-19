<script setup lang="ts">
import type { AcqImageDocument } from '../models/acqImageModels'
import SelectionControls from './SelectionControls.vue'

defineProps<{
  image: AcqImageDocument
  channel: number
  roiId: number | null
  z: number
  t: number
}>()
defineEmits<{
  'update:channel': [value: number]
  'update:roiId': [value: number | null]
  'update:z': [value: number]
  'update:t': [value: number]
}>()
</script>

<template>
  <section class="panel selected-acq-image">
    <div class="selected-acq-image__identity">
      <span class="eyebrow">Selected AcqImage</span>
      <strong>{{ image.name }}</strong>
      <span class="muted"
        >{{ image.image.dims.join('').toUpperCase() }} · {{ image.image.dtype }}</span
      >
    </div>
    <SelectionControls
      :image="image"
      :channel="channel"
      :roi-id="roiId"
      :z="z"
      :t="t"
      @update:channel="$emit('update:channel', $event)"
      @update:roi-id="$emit('update:roiId', $event)"
      @update:z="$emit('update:z', $event)"
      @update:t="$emit('update:t', $event)"
    />
  </section>
</template>
