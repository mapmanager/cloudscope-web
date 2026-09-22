<script setup lang="ts">
import { computed } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import type { ExportedAnalysis } from '../models/acqImageModels'
import type { AxisRange, LinkedAxisUpdate } from '../models/viewState'
import { plotsForAnalysis } from '../plots/analysisPlotRegistry'
import { filterAnalysisTable, peakSeriesFromSummary, type XYPlotSpec } from '../plots/xyPlot'
import XYPlot from './XYPlot.vue'

const props = defineProps<{
  analysis: ExportedAnalysis
  documentUrl: URL
  loadTable: (url: URL, signal?: AbortSignal) => Promise<CsvTable>
  xRange: AxisRange | null
}>()
const emit = defineEmits<{ 'x-range-change': [update: LinkedAxisUpdate] }>()

const specs = computed(() => plotsForAnalysis(props.analysis.analysis_type))

function resourceUrl(spec: XYPlotSpec): URL | null {
  const resource = props.analysis.resources?.table
  if (resource) return new URL(resource.href, props.documentUrl)
  if (props.analysis.plot) {
    return new URL(props.analysis.plot.href, props.documentUrl)
  }
  return null
}

async function loadScopedTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
  const table = await props.loadTable(url, signal)
  return filterAnalysisTable(table, props.analysis.channel, props.analysis.roi_id)
}

function overlays(spec: XYPlotSpec) {
  return (spec.overlays ?? []).map((overlay) => ({
    spec: overlay,
    series: peakSeriesFromSummary(props.analysis.summary),
  }))
}
</script>

<template>
  <template v-for="spec in specs" :key="spec.id">
    <XYPlot
      v-if="resourceUrl(spec)"
      :spec="spec"
      :resource-url="resourceUrl(spec)!"
      :overlays="overlays(spec)"
      :load-table="loadScopedTable"
      :x-range="xRange"
      @x-range-change="emit('x-range-change', $event)"
    />
    <p v-else class="error-message">{{ spec.title }} has no {{ spec.source.resource }} resource.</p>
  </template>
</template>
