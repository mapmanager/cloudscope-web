<script setup lang="ts">
import type { DatasetImage } from '../models/webDataset'

defineProps<{ images: DatasetImage[]; selectedImageId: string | null; canUnload: boolean }>()
const emit = defineEmits<{ select: [imageId: string]; unload: [imageId: string] }>()

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
          <th>Pixels</th>
          <th>Analysis</th>
          <th></th>
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
          <td>{{ image.load_state ? (image.load_state.pixels ? 'Loaded' : '—') : 'N/A' }}</td>
          <td>{{ image.load_state ? (image.load_state.analysisCsv ? 'Loaded' : '—') : 'N/A' }}</td>
          <td>
            <button
              v-if="canUnload"
              type="button"
              class="table-action"
              :disabled="!image.load_state?.pixels && !image.load_state?.analysisCsv"
              @click.stop="emit('unload', image.id)"
            >
              Unload
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
