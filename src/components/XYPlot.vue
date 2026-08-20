<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import { PLOT_GUTTERS } from '../config/viewLayout'
import type { AxisRange, LinkedAxisUpdate } from '../models/viewState'
import {
  plotlyXRangeUpdate,
  sameAxisRange,
  xRangeFromRelayout,
  type PlotlyRelayoutEvent,
} from '../plots/plotlyAxisRange'
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
  xRange: AxisRange | null
}>()
const emit = defineEmits<{ 'x-range-change': [update: LinkedAxisUpdate] }>()
const plotElement = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
let request: AbortController | null = null
let plotly: typeof import('plotly.js') | null = null
let resizeObserver: ResizeObserver | null = null
let resizeFrame: number | null = null
let plotReady = false
let applyingLinkedRange = false
let currentXRange: AxisRange | null = null
let boundElement:
  | (HTMLDivElement & {
      on: (name: string, handler: (event: PlotlyRelayoutEvent) => void) => void
      removeListener: (name: string, handler: (event: PlotlyRelayoutEvent) => void) => void
    })
  | null = null

function handleRelayout(event: PlotlyRelayoutEvent): void {
  if (applyingLinkedRange) return
  const range = xRangeFromRelayout(event)
  if (range === undefined || sameAxisRange(range, currentXRange)) return
  currentXRange = range
  emit('x-range-change', { group: props.spec.presentation.xLinkGroup, range })
}

function bindRelayout(): void {
  const element = plotElement.value as typeof boundElement
  if (!element || element === boundElement) return
  boundElement?.removeListener('plotly_relayout', handleRelayout)
  element.on('plotly_relayout', handleRelayout)
  boundElement = element
}

/** Resize Plotly when its host changes without a browser-window resize event. */
function schedulePlotResize(): void {
  if (!plotReady || !plotly || !plotElement.value) return
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null
    const element = plotElement.value
    if (element && element.clientWidth > 0 && element.clientHeight > 0) {
      void plotly?.Plots.resize(element)
    }
  })
}

async function applyLinkedRange(range: AxisRange | null): Promise<void> {
  if (!plotly || !plotElement.value || sameAxisRange(range, currentXRange)) return
  currentXRange = range
  applyingLinkedRange = true
  try {
    await plotly.relayout(plotElement.value, plotlyXRangeUpdate(range))
  } finally {
    applyingLinkedRange = false
  }
}

async function renderPlot(): Promise<void> {
  request?.abort()
  const currentRequest = new AbortController()
  request = currentRequest
  error.value = null
  if (!plotElement.value) return
  plotReady = false
  loading.value = true
  try {
    const [table, ...overlayTables] = await Promise.all([
      props.loadTable(props.resourceUrl, currentRequest.signal),
      ...(props.overlays ?? []).map((overlay) =>
        props.loadTable(overlay.resourceUrl, currentRequest.signal),
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
    const hasLegend = overlayTraces.length > 0
    const fixedMargin = {
      l: PLOT_GUTTERS.left,
      r: PLOT_GUTTERS.right,
      t: 18,
      b: hasLegend ? 82 : 52,
      autoexpand: false,
    }
    plotly ??= (await import('plotly.js-dist-min')).default
    currentXRange = props.xRange
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
        margin: fixedMargin,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#d8e5ea' },
        xaxis: {
          title: { text: props.spec.presentation.xLabel },
          gridcolor: '#2a3d46',
          automargin: false,
          ...(props.xRange
            ? { range: [props.xRange.min, props.xRange.max], autorange: false }
            : { autorange: true }),
        },
        yaxis: {
          title: { text: props.spec.presentation.yLabel },
          gridcolor: '#2a3d46',
          automargin: false,
        },
        showlegend: hasLegend,
        legend: {
          orientation: 'h',
          x: 0.5,
          xanchor: 'center',
          y: -0.22,
          yanchor: 'top',
        },
      },
      { responsive: true, displaylogo: false },
    )
    plotReady = true
    bindRelayout()
    schedulePlotResize()
  } catch (reason) {
    if (!currentRequest.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (request === currentRequest) loading.value = false
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(schedulePlotResize)
  if (plotElement.value) resizeObserver.observe(plotElement.value)
  void renderPlot()
})
watch([() => props.spec, () => props.resourceUrl.href], renderPlot)
watch(
  () => props.xRange,
  (range) => void applyLinkedRange(range),
  { deep: true },
)
onBeforeUnmount(() => {
  request?.abort()
  resizeObserver?.disconnect()
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
  boundElement?.removeListener('plotly_relayout', handleRelayout)
  boundElement = null
  if (plotElement.value) plotly?.purge(plotElement.value)
})
</script>

<template>
  <article class="analysis-card" :aria-busy="loading">
    <p v-if="error" class="error-message">{{ error }}</p>
    <div ref="plotElement" class="plot" :aria-label="`${spec.title} plot`"></div>
  </article>
</template>
