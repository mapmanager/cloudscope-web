<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { axisTicks, physicalAxisLabel } from '../data/axisTicks'
import {
  orientRoiForDisplay,
  orientYxPlaneForDisplay,
  type DisplayPlane,
} from '../data/imageDisplayTransform'
import {
  clampAxisRange,
  dominantDragAxis,
  fullAxisRange,
  panAxisRange,
  secondsPerPixel,
  selectedAxisRange,
  type DragAxis,
  zoomAxisRange,
} from '../data/imageViewport'
import { intensityRange, type ImagePlane, type PlaneIndices } from '../data/omeZarrLoader'
import type { AxisRange, LinkedAxisUpdate } from '../models/viewState'
import type { PrimaryImageDescriptor, Roi } from '../models/acqImageModels'

const props = defineProps<{
  image: PrimaryImageDescriptor
  documentUrl: URL
  channel: number
  z: number
  t: number
  roi: Roi | null
  xRange: AxisRange | null
  loadPlane: (
    descriptor: PrimaryImageDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ) => Promise<ImagePlane>
}>()
const emit = defineEmits<{ 'x-range-change': [update: LinkedAxisUpdate] }>()
const stage = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const plane = ref<DisplayPlane | null>(null)
const yRange = ref<AxisRange | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const source = document.createElement('canvas')
let controller: AbortController | null = null
let observer: ResizeObserver | null = null
interface DragState {
  id: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  xRange: AxisRange
  yRange: AxisRange
  behavior: 'select' | 'pan'
  axis: DragAxis | null
}
let drag: DragState | null = null
const selection = ref<{ axis: DragAxis; start: number; end: number } | null>(null)
const spacePressed = ref(false)
const pointerInside = ref(false)

const contrast = computed(
  () => props.image.channels.find(({ index }) => index === props.channel)?.contrast,
)
const timeSpacing = computed(() => {
  const axis = plane.value?.axes.x
  return axis ? secondsPerPixel(axis.spacing, axis.unit) : null
})
const fullX = computed(() =>
  plane.value && timeSpacing.value ? fullAxisRange(plane.value.width, timeSpacing.value) : null,
)
const shownX = computed(() => {
  const full = fullX.value
  const spacing = timeSpacing.value
  return full && spacing && props.xRange ? clampAxisRange(props.xRange, full, spacing) : full
})
const shownY = computed(() => {
  const p = plane.value
  if (!p) return null
  const range = yRange.value ?? fullAxisRange(p.height, 1)
  return { min: range.min * p.axes.y.spacing, max: range.max * p.axes.y.spacing }
})
const xTicks = computed(() => (shownX.value ? axisTicks(shownX.value) : []))
const yTicks = computed(() => (shownY.value ? axisTicks(shownY.value, 5, true) : []))
const xAxisLabel = computed(() => (plane.value ? physicalAxisLabel('s') : ''))
const yAxisLabel = computed(() => (plane.value ? physicalAxisLabel(plane.value.axes.y.unit) : ''))
const selectionStyle = computed(() => {
  const selected = selection.value
  const box = stage.value
  if (!selected || !box) return undefined
  const start = Math.min(selected.start, selected.end)
  const size = Math.abs(selected.end - selected.start)
  return selected.axis === 'x'
    ? { left: `${start}px`, width: `${size}px`, top: '0', bottom: '0' }
    : { top: `${start}px`, height: `${size}px`, left: '0', right: '0' }
})

function buildRaster(): void {
  const p = plane.value
  if (!p) return
  source.width = p.width
  source.height = p.height
  const context = source.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable in this browser')
  const pixels = context.createImageData(p.width, p.height)
  const [low, high] = intensityRange(p.data, contrast.value)
  const factor = 255 / (high - low)
  for (let i = 0; i < p.data.length; i += 1) {
    const gray = Math.max(0, Math.min(255, Math.round((Number(p.data[i]) - low) * factor)))
    pixels.data.set([gray, gray, gray, 255], i * 4)
  }
  context.putImageData(pixels, 0, 0)
}

function drawRoi(
  context: CanvasRenderingContext2D,
  p: DisplayPlane,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  width: number,
  height: number,
): void {
  if (!props.roi || props.image.sizes.x === undefined) return
  const roi = orientRoiForDisplay(props.roi, props.image.sizes.x)
  const x = (v: number) => (((v * p.width) / p.sourceWidth - sx) / sw) * width
  const y = (v: number) => (((v * p.height) / p.sourceHeight - sy) / sh) * height
  context.save()
  context.strokeStyle = '#ffb44c'
  context.lineWidth = 2
  if (roi.type === 'rect')
    context.strokeRect(
      x(roi.x_start),
      y(roi.y_start),
      x(roi.x_stop) - x(roi.x_start),
      y(roi.y_stop) - y(roi.y_start),
    )
  else {
    context.beginPath()
    context.moveTo(x(roi.x0), y(roi.y0))
    context.lineTo(x(roi.x1), y(roi.y1))
    context.stroke()
  }
  context.restore()
}

function render(): void {
  const target = canvas.value
  const box = stage.value
  const p = plane.value
  const xr = shownX.value
  const xf = fullX.value
  if (!target || !box || !p || !xr || !xf) return
  const width = Math.max(1, box.clientWidth)
  const height = Math.max(1, box.clientHeight)
  const ratio = Math.min(devicePixelRatio || 1, 2)
  target.width = Math.round(width * ratio)
  target.height = Math.round(height * ratio)
  const context = target.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.imageSmoothingEnabled = false
  const yr = yRange.value ?? fullAxisRange(p.height, 1)
  const denominator = Math.max(xf.max - xf.min, Number.EPSILON)
  const sx = ((xr.min - xf.min) / denominator) * (p.width - 1)
  const sw = ((xr.max - xr.min) / denominator) * (p.width - 1) + 1
  const sy = yr.min
  const sh = yr.max - yr.min + 1
  context.clearRect(0, 0, width, height)
  context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
  drawRoi(context, p, sx, sy, sw, sh, width, height)
}

function emitX(range: AxisRange | null): void {
  emit('x-range-change', { group: 'time', range })
}
function resetView(): void {
  if (plane.value) yRange.value = fullAxisRange(plane.value.height, 1)
  emitX(null)
  render()
}
function wheel(event: WheelEvent): void {
  const xr = shownX.value
  const xf = fullX.value
  const p = plane.value
  const box = stage.value
  const spacing = timeSpacing.value
  if (!xr || !xf || !p || !box || !spacing) return
  const rect = box.getBoundingClientRect()
  const factor = Math.exp(event.deltaY * 0.0015)
  emitX(zoomAxisRange(xr, (event.clientX - rect.left) / rect.width, factor, xf, spacing))
  const yf = fullAxisRange(p.height, 1)
  yRange.value = zoomAxisRange(
    yRange.value ?? yf,
    (event.clientY - rect.top) / rect.height,
    factor,
    yf,
    1,
  )
  render()
}
function pointerDown(event: PointerEvent): void {
  const box = stage.value
  if (!shownX.value || !plane.value || !box) return
  const bounds = box.getBoundingClientRect()
  drag = {
    id: event.pointerId,
    startX: event.clientX - bounds.left,
    startY: event.clientY - bounds.top,
    currentX: event.clientX - bounds.left,
    currentY: event.clientY - bounds.top,
    xRange: shownX.value,
    yRange: yRange.value ?? fullAxisRange(plane.value.height, 1),
    behavior: spacePressed.value ? 'pan' : 'select',
    axis: null,
  }
  canvas.value?.setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent): void {
  const d = drag
  const xf = fullX.value
  const p = plane.value
  const box = stage.value
  const spacing = timeSpacing.value
  if (!d || d.id !== event.pointerId || !xf || !p || !box || !spacing) return
  const bounds = box.getBoundingClientRect()
  d.currentX = Math.max(0, Math.min(box.clientWidth, event.clientX - bounds.left))
  d.currentY = Math.max(0, Math.min(box.clientHeight, event.clientY - bounds.top))
  if (d.behavior === 'pan') {
    emitX(panAxisRange(d.xRange, (d.startX - d.currentX) / box.clientWidth, xf, spacing))
    yRange.value = panAxisRange(
      d.yRange,
      (d.startY - d.currentY) / box.clientHeight,
      fullAxisRange(p.height, 1),
      1,
    )
    render()
    return
  }
  d.axis ??= dominantDragAxis(d.currentX - d.startX, d.currentY - d.startY)
  if (d.axis) {
    selection.value = {
      axis: d.axis,
      start: d.axis === 'x' ? d.startX : d.startY,
      end: d.axis === 'x' ? d.currentX : d.currentY,
    }
  }
}
function pointerUp(event: PointerEvent): void {
  const d = drag
  const box = stage.value
  const p = plane.value
  const spacing = timeSpacing.value
  if (!d || d.id !== event.pointerId || !box || !p || !spacing) return
  if (d.behavior === 'select' && d.axis === 'x') {
    const range = selectedAxisRange(d.xRange, d.startX, d.currentX, box.clientWidth, spacing)
    if (range) emitX(range)
  } else if (d.behavior === 'select' && d.axis === 'y') {
    const range = selectedAxisRange(d.yRange, d.startY, d.currentY, box.clientHeight, 1)
    if (range) {
      yRange.value = range
      render()
    }
  }
  selection.value = null
  drag = null
}

function pointerCancel(): void {
  selection.value = null
  drag = null
}

function keyDown(event: KeyboardEvent): void {
  if (event.code !== 'Space' || event.repeat) return
  const target = event.target as HTMLElement | null
  if (target?.matches('input, select, textarea, button, [contenteditable="true"]')) return
  spacePressed.value = true
  if (pointerInside.value) event.preventDefault()
}

function keyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePressed.value = false
}

function clearKeyboardState(): void {
  spacePressed.value = false
}

async function load(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = null
  try {
    const loaded = await props.loadPlane(
      props.image,
      props.documentUrl,
      { channel: props.channel, z: props.z, t: props.t },
      controller.signal,
    )
    plane.value = orientYxPlaneForDisplay(loaded)
    yRange.value = fullAxisRange(plane.value.height, 1)
    if (timeSpacing.value === null)
      throw new Error(
        `Image X axis must have time units to link views; received "${plane.value.axes.x.unit}"`,
      )
    buildRaster()
    await nextTick()
    observer?.disconnect()
    observer = new ResizeObserver(render)
    if (stage.value) observer.observe(stage.value)
    render()
  } catch (reason) {
    if (!(reason instanceof DOMException && reason.name === 'AbortError'))
      error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.image.href, props.documentUrl.href, props.channel, props.z, props.t],
  () => void load(),
  { immediate: true },
)
watch(() => props.xRange, render, { deep: true })
watch([() => props.roi, contrast], () => {
  buildRaster()
  render()
})
onBeforeUnmount(() => {
  controller?.abort()
  observer?.disconnect()
  window.removeEventListener('keydown', keyDown)
  window.removeEventListener('keyup', keyUp)
  window.removeEventListener('blur', clearKeyboardState)
})
onMounted(() => {
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('blur', clearKeyboardState)
})
</script>

<template>
  <section class="panel image-panel">
    <p class="eyebrow image-heading">
      OME-Zarr raster<span v-if="plane"> · level {{ plane.level }}</span>
    </p>
    <div class="image-chart">
      <div class="image-y-axis" aria-hidden="true">
        <span
          v-for="tick in yTicks"
          :key="tick.position"
          class="image-axis-tick"
          :style="{ top: `${tick.position * 100}%` }"
          >{{ tick.label }}</span
        >
        <strong>{{ yAxisLabel }}</strong>
      </div>
      <div
        ref="stage"
        class="image-stage"
        :class="{ 'image-stage--pan': spacePressed }"
        :aria-busy="loading"
        @wheel.prevent="wheel"
        @pointerdown="pointerDown"
        @pointermove="pointerMove"
        @pointerup="pointerUp"
        @pointercancel="pointerCancel"
        @pointerenter="pointerInside = true"
        @pointerleave="pointerInside = false"
        @dblclick="resetView"
      >
        <canvas ref="canvas" aria-label="Interactive selected acquisition image" />
        <div
          v-if="selection"
          class="image-selection"
          :class="`image-selection--${selection.axis}`"
          :style="selectionStyle"
          aria-hidden="true"
        />
        <p v-if="loading" class="image-status">Loading image plane…</p>
        <p v-else-if="error" class="image-status error-message" role="alert">{{ error }}</p>
      </div>
      <div class="image-x-axis" aria-hidden="true">
        <span
          v-for="tick in xTicks"
          :key="tick.position"
          class="image-axis-tick"
          :style="{ left: `${tick.position * 100}%` }"
          >{{ tick.label }}</span
        >
        <strong>{{ xAxisLabel }}</strong>
      </div>
    </div>
  </section>
</template>
