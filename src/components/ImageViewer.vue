<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import {
  orientRoiForDisplay,
  orientYxPlaneForDisplay,
  type DisplayPlane,
} from '../data/imageDisplayTransform'
import { intensityRange, type ImagePlane, type PlaneIndices } from '../data/omeZarrLoader'
import type { PrimaryImageDescriptor, Roi } from '../models/webDataset'

const props = defineProps<{
  image: PrimaryImageDescriptor
  documentUrl: URL
  channel: number
  z: number
  t: number
  roi: Roi | null
  loadPlane: (
    descriptor: PrimaryImageDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ) => Promise<ImagePlane>
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const plane = ref<DisplayPlane | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let controller: AbortController | null = null

const contrast = computed(
  () => props.image.channels.find(({ index }) => index === props.channel)?.contrast,
)

function drawRoi(context: CanvasRenderingContext2D, current: DisplayPlane): void {
  if (!props.roi) return
  const sourceXSize = props.image.sizes.x
  if (sourceXSize === undefined) return
  const roi = orientRoiForDisplay(props.roi, sourceXSize)
  const scaleX = current.width / current.sourceWidth
  const scaleY = current.height / current.sourceHeight
  context.save()
  context.strokeStyle = '#ffb44c'
  context.lineWidth = Math.max(1, Math.min(current.width, current.height) / 300)
  if (roi.type === 'rect') {
    context.strokeRect(
      roi.x_start * scaleX,
      roi.y_start * scaleY,
      (roi.x_stop - roi.x_start) * scaleX,
      (roi.y_stop - roi.y_start) * scaleY,
    )
  } else {
    context.beginPath()
    context.moveTo(roi.x0 * scaleX, roi.y0 * scaleY)
    context.lineTo(roi.x1 * scaleX, roi.y1 * scaleY)
    context.stroke()
  }
  context.restore()
}

function render(): void {
  const target = canvas.value
  const current = plane.value
  if (!target || !current) return
  target.width = current.width
  target.height = current.height
  const context = target.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable in this browser')
  const pixels = context.createImageData(current.width, current.height)
  const [low, high] = intensityRange(current.data, contrast.value)
  const factor = 255 / (high - low)
  for (let index = 0; index < current.data.length; index += 1) {
    const gray = Math.max(
      0,
      Math.min(255, Math.round((Number(current.data[index]) - low) * factor)),
    )
    const offset = index * 4
    pixels.data[offset] = gray
    pixels.data[offset + 1] = gray
    pixels.data[offset + 2] = gray
    pixels.data[offset + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  drawRoi(context, current)
}

async function load(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = null
  try {
    const sourcePlane: ImagePlane = await props.loadPlane(
      props.image,
      props.documentUrl,
      { channel: props.channel, z: props.z, t: props.t },
      controller.signal,
    )
    plane.value = orientYxPlaneForDisplay(sourcePlane)
    await nextTick()
    render()
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return
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
watch([() => props.roi, contrast], render)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="panel image-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">OME-Zarr raster</p>
        <h2>Image</h2>
      </div>
      <span v-if="plane" class="muted"
        >{{ plane.width }} × {{ plane.height }} · level {{ plane.level }}</span
      >
    </div>
    <div class="image-stage" :aria-busy="loading">
      <canvas ref="canvas" aria-label="Selected acquisition image" />
      <p v-if="loading" class="image-status">Loading image plane…</p>
      <p v-else-if="error" class="image-status error-message" role="alert">{{ error }}</p>
    </div>
  </section>
</template>
