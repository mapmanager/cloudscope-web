<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import { buildXYSeries, type XYPlotOverlaySpec, type XYPlotSpec } from '../plots/xyPlot'

interface XYPlotOverlayInput {
  spec: XYPlotOverlaySpec
  resourceUrl: URL
}

const props = defineProps<{
  spec: XYPlotSpec
  resourceUrl: URL
  overlays?: XYPlotOverlayInput[]
  loadTable: (url: URL, signal?: AbortSignal) => Promise<CsvTable>
}>()
const plotElement = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
let request: AbortController | null = null
let plotly: typeof import('plotly.js') | null = null

async function renderPlot(): Promise<void> {
  request?.abort()
  request = new AbortController()
  error.value = null
  if (!plotElement.value) return
  loading.value = true
  try {
    const [table, ...overlayTables] = await Promise.all([
      props.loadTable(props.resourceUrl, request.signal),
      ...(props.overlays ?? []).map((overlay) =>
        props.loadTable(overlay.resourceUrl, request!.signal),
      ),
    ])
    const series = buildXYSeries(table, props.spec)
    const overlayTraces = (props.overlays ?? []).flatMap((overlay, index) => {
      const overlaySeries = buildXYSeries(overlayTables[index]!, overlay.spec, true)
      return overlaySeries.x.length
        ? [
            {
              ...overlaySeries,
              type: 'scattergl' as const,
              mode: overlay.spec.presentation.mode,
              name: overlay.spec.presentation.seriesName,
              marker: {
                color: overlay.spec.presentation.color,
                size: overlay.spec.presentation.size,
              },
            },
          ]
        : []
    })
    plotly ??= (await import('plotly.js-dist-min')).default
    await plotly.react(
      plotElement.value,
      [
        {
          ...series,
          type: 'scattergl',
          mode: props.spec.presentation.mode,
          name: props.spec.presentation.seriesName,
        },
        ...overlayTraces,
      ],
      {
        autosize: true,
        margin: { l: 64, r: 20, t: 18, b: 52 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#d8e5ea' },
        xaxis: { title: { text: props.spec.presentation.xLabel }, gridcolor: '#2a3d46' },
        yaxis: { title: { text: props.spec.presentation.yLabel }, gridcolor: '#2a3d46' },
        showlegend: overlayTraces.length > 0,
      },
      { responsive: true, displaylogo: false },
    )
  } catch (reason) {
    if (!request.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

onMounted(() => void renderPlot())
watch(() => [props.spec, props.resourceUrl] as const, renderPlot)
onBeforeUnmount(() => {
  request?.abort()
  if (plotElement.value) plotly?.purge(plotElement.value)
})
</script>

<template>
  <article class="analysis-card">
    <p v-if="loading" class="muted">Loading plot…</p>
    <p v-if="error" class="error-message">{{ error }}</p>
    <div ref="plotElement" class="plot" :aria-label="`${spec.title} plot`"></div>
  </article>
</template>
