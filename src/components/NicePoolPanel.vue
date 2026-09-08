<script setup lang="ts">
import {
  NicePoolElement,
  registerNicePoolElement,
  type NicePoolPreset,
  type NicePoolSelection,
  type NicePoolState,
  type NicePoolRow,
} from '@mapmanager/nicepool'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import {
  csvTableToNicePoolDataset,
  nicePoolSelectionForViewer,
  nicePoolTargetForSelection,
} from '../data/nicepoolDataset'
import type { AnalysisTableDescriptor } from '../models/acqImageCollectionManifest'

registerNicePoolElement()

const props = defineProps<{
  collectionUrl: URL
  analysisTables: Record<string, AnalysisTableDescriptor>
  preferredTable: string | null
  loadTable: (url: URL, signal?: AbortSignal) => Promise<CsvTable>
  loadJson: (url: URL, signal?: AbortSignal) => Promise<unknown>
  selectedAcqImageId: string | null
  selectedChannel: number
  selectedRoiId: number | null
}>()
const emit = defineEmits<{
  selectAnalysisRow: [acqImageId: string, channel: number, roiId: number]
}>()

const element = ref<NicePoolElement | null>(null)
const selectedTable = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
let request: AbortController | null = null
let currentRows: readonly NicePoolRow[] = []

const tableNames = computed(() => Object.keys(props.analysisTables))

function initialTable(): string {
  if (props.preferredTable && tableNames.value.includes(props.preferredTable)) {
    return props.preferredTable
  }
  return tableNames.value[0] ?? ''
}

async function loadSelectedTable(): Promise<void> {
  request?.abort()
  error.value = null
  currentRows = []
  if (!selectedTable.value) return
  const controller = new AbortController()
  request = controller
  loading.value = true
  try {
    const descriptor = props.analysisTables[selectedTable.value]
    if (!descriptor) throw new Error(`Unknown analysis table: ${selectedTable.value}`)
    const table = await props.loadTable(
      new URL(descriptor.csv, props.collectionUrl),
      controller.signal,
    )
    const dataset = csvTableToNicePoolDataset(table)
    const workspace = descriptor.nicepool_state
      ? await props.loadJson(
          new URL(descriptor.nicepool_state, props.collectionUrl),
          controller.signal,
        )
      : null
    await nextTick()
    if (!controller.signal.aborted && element.value) {
      currentRows = dataset.rows
      element.value.setShowPresetEditing(false)
      element.value.setData(dataset)
      if (workspace !== null) {
        const preset: NicePoolPreset = {
          schemaVersion: 1,
          name: 'Collection default',
          state: workspace as NicePoolState,
        }
        element.value.setNicePoolPresets([preset])
        element.value.applyNicePoolPreset(preset.name)
      } else {
        element.value.setNicePoolPresets([])
      }
      syncSelectionFromViewer()
    }
  } catch (reason) {
    if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : String(reason)
    }
  } finally {
    if (request === controller) {
      request = null
      loading.value = false
    }
  }
}

function syncSelectionFromViewer(): void {
  if (!element.value || currentRows.length === 0) return
  element.value.setSelection(
    nicePoolSelectionForViewer(
      currentRows,
      props.selectedAcqImageId,
      props.selectedChannel,
      props.selectedRoiId,
    ),
  )
}

function handleNicePoolSelection(event: Event): void {
  const selection = (event as CustomEvent<NicePoolSelection>).detail
  try {
    const target = nicePoolTargetForSelection(currentRows, selection)
    if (target) emit('selectAnalysisRow', target.acqImageId, target.channel, target.roiId)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}

watch(
  () => [props.collectionUrl.href, props.analysisTables, props.preferredTable] as const,
  () => {
    selectedTable.value = initialTable()
    void loadSelectedTable()
  },
  { immediate: true },
)
onBeforeUnmount(() => request?.abort())
watch(
  () => [props.selectedAcqImageId, props.selectedChannel, props.selectedRoiId] as const,
  syncSelectionFromViewer,
)
</script>

<template>
  <section class="nicepool-panel" aria-label="NicePool analysis explorer">
    <header class="nicepool-panel__header">
      <label for="nicepool-analysis-table">Analysis table</label>
      <select
        id="nicepool-analysis-table"
        v-model="selectedTable"
        :disabled="loading || tableNames.length < 2"
        @change="loadSelectedTable"
      >
        <option v-for="name in tableNames" :key="name" :value="name">
          {{ name.replaceAll('_', ' ') }}
        </option>
      </select>
    </header>
    <p v-if="loading" class="nicepool-panel__message">Loading analysis table…</p>
    <p v-else-if="error" class="nicepool-panel__message error-message" role="alert">{{ error }}</p>
    <p v-else-if="tableNames.length === 0" class="nicepool-panel__message">
      This collection does not advertise any analysis tables.
    </p>
    <nice-pool
      v-show="!error && tableNames.length > 0"
      ref="element"
      class="nicepool-panel__widget"
      @nicepool-selection-change="handleNicePoolSelection"
    />
  </section>
</template>
