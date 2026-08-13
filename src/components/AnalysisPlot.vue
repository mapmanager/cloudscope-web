<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import { loadCsv } from '../data/csvLoader'
import type { ExportedAnalysis } from '../models/webDataset'

const props = defineProps<{ analysis: ExportedAnalysis; documentUrl: URL }>()
const plotElement = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
let request: AbortController | null = null
let plotly: typeof import('plotly.js') | null = null

watch(
  () => [props.analysis, props.documentUrl] as const,
  async () => {
    request?.abort()
    request = new AbortController()
    error.value = null
    if (!props.analysis.plot || !plotElement.value) return
    loading.value = true
    try {
      const plot = props.analysis.plot
      const table = await loadCsv(new URL(plot.href, props.documentUrl), request.signal)
      const x = table.rows.map((row) => Number(row[plot.x_column]))
      const y = table.rows.map((row) => Number(row[plot.y_column]))
      plotly ??= (await import('plotly.js-dist-min')).default
      await plotly.react(
        plotElement.value,
        [{ x, y, type: 'scattergl', mode: 'lines', name: plot.series_name }],
        {
          autosize: true,
          margin: { l: 64, r: 20, t: 18, b: 52 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#d8e5ea' },
          xaxis: { title: { text: plot.x_label }, gridcolor: '#2a3d46' },
          yaxis: { title: { text: plot.y_label }, gridcolor: '#2a3d46' },
          showlegend: false,
        },
        { responsive: true, displaylogo: false },
      )
    } catch (reason) {
      if (!request.signal.aborted)
        error.value = reason instanceof Error ? reason.message : String(reason)
    } finally {
      loading.value = false
    }
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  request?.abort()
  if (plotElement.value) plotly?.purge(plotElement.value)
})
</script>

<template>
  <article class="analysis-card">
    <header>
      <div>
        <p class="eyebrow">{{ analysis.analysis_type.replaceAll('_', ' ') }}</p>
        <h3>{{ analysis.display_name }}</h3>
      </div>
      <span v-if="analysis.peaks" class="badge">{{ analysis.peaks.count }} peaks</span>
    </header>
    <p v-if="loading" class="muted">Loading plot…</p>
    <p v-if="error" class="error-message">{{ error }}</p>
    <div ref="plotElement" class="plot" :aria-label="`${analysis.display_name} plot`"></div>
  </article>
</template>
