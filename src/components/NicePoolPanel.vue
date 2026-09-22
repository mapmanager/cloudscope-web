<script setup lang="ts">
import {
  NicePoolElement,
  registerNicePoolElement,
  type DatasetInput,
  type NicePoolPresetDefinition,
  type NicePoolSelection,
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
  loadTable: (url: URL, signal?: AbortSignal) => Promise<CsvTable>
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
const warning = ref<string | null>(null)
let request: AbortController | null = null
let currentRows: readonly NicePoolRow[] = []

interface TablePreset {
  definition: NicePoolPresetDefinition
  requiredColumns: readonly string[]
}

const tablePresets: Readonly<Partial<Record<string, TablePreset>>> = {
  velocity: {
    definition: {
      name: 'Velocity Default',
      state: {
        layout: '1x1',
        plots: [{ plotType: 'swarm', yColumn: 'velocity_mean', groupColumn: 'grandparent' }],
      },
    },
    requiredColumns: ['velocity_mean', 'grandparent'],
  },
  sum_intensity: {
    definition: {
      name: 'Diameter Default',
      state: {
        layout: '1x1',
        plots: [{ plotType: 'scatter', xColumn: 'onset_time_sec', yColumn: 'peak_value' }],
      },
    },
    requiredColumns: ['onset_time_sec', 'peak_value'],
  },
}

function initializeNicePool(dataset: DatasetInput): void {
  if (!element.value) return
  const preset = tablePresets[selectedTable.value]
  const columns = new Set(dataset.rows.flatMap((row) => Object.keys(row)))
  const missing = preset?.requiredColumns.filter((column) => !columns.has(column)) ?? []
  const definitions = preset && missing.length === 0 ? [preset.definition] : []
  warning.value =
    preset && missing.length > 0
      ? `${preset.definition.name} is unavailable because the table is missing ${missing.join(', ')}.`
      : null
  element.value.setControlsCollapsed(true)
  element.value.setShowPresetEditing(false)
  element.value.initializeData(dataset, definitions, definitions[0]?.name ?? null)
}

const tableNames = computed(() => Object.keys(props.analysisTables))

function initialTable(): string {
  return tableNames.value[0] ?? ''
}

async function loadSelectedTable(): Promise<void> {
  request?.abort()
  error.value = null
  warning.value = null
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
    await nextTick()
    if (!controller.signal.aborted && element.value) {
      currentRows = dataset.rows
      initializeNicePool(dataset)
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
  () => [props.collectionUrl.href, props.analysisTables] as const,
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
    <p v-else-if="warning" class="nicepool-panel__message" role="status">{{ warning }}</p>
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
