<script setup lang="ts">
import type { AcqImageCollectionRow } from '../models/acqImageModels'

/** Columns the collection table can show. Call sites pass a subset. */
export type CollectionTableColumn =
  | 'file'
  | 'dimensions'
  | 'channels'
  | 'rois'
  | 'analyses'
  | 'acquired'
  | 'pixels'
  | 'analysis'
  | 'unload'

const props = withDefaults(
  defineProps<{
    acqImages: AcqImageCollectionRow[]
    selectedAcqImageId: string | null
    canUnload?: boolean
    columns?: CollectionTableColumn[]
  }>(),
  {
    canUnload: false,
    columns: () => [
      'file',
      'dimensions',
      'channels',
      'rois',
      'analyses',
      'acquired',
      'pixels',
      'analysis',
      'unload',
    ],
  },
)
const emit = defineEmits<{ select: [acqImageId: string]; unload: [acqImageId: string] }>()

/** Format an AcqImage shape for the compact collection table. */
function dimensions(acqImage: AcqImageCollectionRow): string {
  return acqImage.dims.map((dim) => `${dim.toUpperCase()}:${acqImage.sizes[dim] ?? '?'}`).join(' ')
}

function show(column: CollectionTableColumn): boolean {
  return props.columns.includes(column)
}
</script>

<template>
  <div class="table-scroll">
    <table class="file-table">
      <thead>
        <tr>
          <th v-if="show('file')">File</th>
          <th v-if="show('dimensions')">Dimensions</th>
          <th v-if="show('channels')">Channels</th>
          <th v-if="show('rois')">ROIs</th>
          <th v-if="show('analyses')">Analyses</th>
          <th v-if="show('acquired')">Acquired</th>
          <th v-if="show('pixels')">Pixels</th>
          <th v-if="show('analysis')">Analysis</th>
          <th v-if="show('unload')"></th>
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
          <td v-if="show('file')" class="file-name">{{ acqImage.name }}</td>
          <td v-if="show('dimensions')">{{ dimensions(acqImage) }}</td>
          <td v-if="show('channels')">{{ acqImage.num_channels }}</td>
          <td v-if="show('rois')">{{ acqImage.num_rois }}</td>
          <td v-if="show('analyses')">{{ acqImage.analysis_types.join(', ') || '—' }}</td>
          <td v-if="show('acquired')">
            {{ acqImage.acquisition.date || '—' }} {{ acqImage.acquisition.time }}
          </td>
          <td v-if="show('pixels')">
            {{ acqImage.load_state ? (acqImage.load_state.pixels ? 'Loaded' : '—') : 'N/A' }}
          </td>
          <td v-if="show('analysis')">
            {{ acqImage.load_state ? (acqImage.load_state.analysisCsv ? 'Loaded' : '—') : 'N/A' }}
          </td>
          <td v-if="show('unload')">
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
