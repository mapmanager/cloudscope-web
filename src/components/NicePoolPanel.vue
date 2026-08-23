<script setup lang="ts">
import { NicePoolElement, registerNicePoolElement } from '@mapmanager/nicepool'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import { csvTableToNicePoolDataset } from '../data/nicepoolDataset'

registerNicePoolElement()

const props = defineProps<{
  collectionUrl: URL
  analysisTables: Record<string, string>
  preferredTable: string | null
  loadTable: (url: URL, signal?: AbortSignal) => Promise<CsvTable>
}>()

const element = ref<NicePoolElement | null>(null)
const selectedTable = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
let request: AbortController | null = null

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
  if (!selectedTable.value) return
  const controller = new AbortController()
  request = controller
  loading.value = true
  try {
    const path = props.analysisTables[selectedTable.value]
    if (!path) throw new Error(`Unknown analysis table: ${selectedTable.value}`)
    const table = await props.loadTable(new URL(path, props.collectionUrl), controller.signal)
    const dataset = csvTableToNicePoolDataset(table)
    await nextTick()
    if (!controller.signal.aborted) element.value?.setData(dataset)
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

watch(
  () => [props.collectionUrl.href, props.analysisTables, props.preferredTable] as const,
  () => {
    selectedTable.value = initialTable()
    void loadSelectedTable()
  },
  { immediate: true },
)
onBeforeUnmount(() => request?.abort())
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
    />
  </section>
</template>
