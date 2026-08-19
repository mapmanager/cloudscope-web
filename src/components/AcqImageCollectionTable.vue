<script setup lang="ts">
import type { AcqImageCollectionRow } from '../models/acqImageModels'

defineProps<{
  acqImages: AcqImageCollectionRow[]
  selectedAcqImageId: string | null
  canUnload: boolean
}>()
const emit = defineEmits<{ select: [acqImageId: string]; unload: [acqImageId: string] }>()

/** Format an AcqImage shape for the compact collection table. */
function dimensions(acqImage: AcqImageCollectionRow): string {
  return acqImage.dims.map((dim) => `${dim.toUpperCase()}:${acqImage.sizes[dim] ?? '?'}`).join(' ')
}
</script>

<template>
  <div class="table-scroll">
    <table class="file-table">
      <thead>
        <tr>
          <th>File</th>
          <th>Dimensions</th>
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
          v-for="acqImage in acqImages"
          :key="acqImage.id"
          :class="{ selected: acqImage.id === selectedAcqImageId }"
          tabindex="0"
          @click="emit('select', acqImage.id)"
          @keydown.enter="emit('select', acqImage.id)"
          @keydown.space.prevent="emit('select', acqImage.id)"
        >
          <td class="file-name">{{ acqImage.name }}</td>
          <td>{{ dimensions(acqImage) }}</td>
          <td>{{ acqImage.num_channels }}</td>
          <td>{{ acqImage.num_rois }}</td>
          <td>{{ acqImage.analysis_types.join(', ') || '—' }}</td>
          <td>{{ acqImage.acquisition.date || '—' }} {{ acqImage.acquisition.time }}</td>
          <td>{{ acqImage.load_state ? (acqImage.load_state.pixels ? 'Loaded' : '—') : 'N/A' }}</td>
          <td>
            {{ acqImage.load_state ? (acqImage.load_state.analysisCsv ? 'Loaded' : '—') : 'N/A' }}
          </td>
          <td>
            <button
              v-if="canUnload"
              type="button"
              class="table-action"
              :disabled="!acqImage.load_state?.pixels && !acqImage.load_state?.analysisCsv"
              @click.stop="emit('unload', acqImage.id)"
            >
              Unload
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
