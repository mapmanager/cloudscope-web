<script setup lang="ts">
import { computed } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import type { ExportedAnalysis } from '../models/webDataset'
import { plotsForAnalysis } from '../plots/analysisPlotRegistry'
import type { XYPlotOverlaySpec, XYPlotSpec } from '../plots/xyPlot'
import XYPlot from './XYPlot.vue'

const props = defineProps<{
  analysis: ExportedAnalysis
  documentUrl: URL
  loadTable: (url: URL, signal?: AbortSignal) => Promise<CsvTable>
}>()

const specs = computed(() => plotsForAnalysis(props.analysis.analysis_type))

function resourceUrl(spec: XYPlotSpec): URL | null {
  const resources = props.analysis.resources
  const resource = spec.source.resource === 'table' ? resources?.table : resources?.peaks
  if (resource) return new URL(resource.href, props.documentUrl)
  if (spec.source.resource === 'table' && props.analysis.plot) {
    return new URL(props.analysis.plot.href, props.documentUrl)
  }
  return null
}

function overlayResourceUrl(spec: XYPlotOverlaySpec): URL | null {
  const resource =
    spec.source.resource === 'table'
      ? props.analysis.resources?.table
      : props.analysis.resources?.peaks
  return resource ? new URL(resource.href, props.documentUrl) : null
}

function overlays(spec: XYPlotSpec) {
  return (spec.overlays ?? []).flatMap((overlay) => {
    const url = overlayResourceUrl(overlay)
    return url ? [{ spec: overlay, resourceUrl: url }] : []
  })
}
</script>

<template>
  <template v-for="spec in specs" :key="spec.id">
    <XYPlot
      v-if="resourceUrl(spec)"
      :spec="spec"
      :resource-url="resourceUrl(spec)!"
      :overlays="overlays(spec)"
      :load-table="loadTable"
    />
    <p v-else class="error-message">{{ spec.title }} has no {{ spec.source.resource }} resource.</p>
  </template>
</template>
