<script setup lang="ts">
import type { DatasetImage } from '../models/webDataset'

defineProps<{ images: DatasetImage[]; selectedImageId: string | null }>()
const emit = defineEmits<{ select: [imageId: string] }>()

function dimensions(image: DatasetImage): string {
  return image.dims.map((dim) => `${dim.toUpperCase()}:${image.sizes[dim] ?? '?'}`).join(' ')
}
</script>

<template>
  <div class="table-scroll">
    <table class="file-table">
      <thead>
        <tr>
          <th>File</th>
          <th>Dimensions</th>
          <th>Type</th>
          <th>Channels</th>
          <th>ROIs</th>
          <th>Analyses</th>
          <th>Acquired</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="image in images"
          :key="image.id"
          :class="{ selected: image.id === selectedImageId }"
          tabindex="0"
          @click="emit('select', image.id)"
          @keydown.enter="emit('select', image.id)"
          @keydown.space.prevent="emit('select', image.id)"
        >
          <td class="file-name">{{ image.name }}</td>
          <td>{{ dimensions(image) }}</td>
          <td>{{ image.dtype }}</td>
          <td>{{ image.num_channels }}</td>
          <td>{{ image.num_rois }}</td>
          <td>{{ image.analysis_types.join(', ') || '—' }}</td>
          <td>{{ image.acquisition.date || '—' }} {{ image.acquisition.time }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
