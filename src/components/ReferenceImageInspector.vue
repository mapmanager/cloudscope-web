<script setup lang="ts">
import { X } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { buildReferenceRasterDescriptor } from '../data/rasterDescriptor'
import { loadPixelDescriptor, type ImagePlane, type PlaneIndices } from '../data/omeZarrLoader'
import type {
  PixelDescriptor,
  ReferenceImageDescriptor,
  ReferenceImageResource,
} from '../models/acqImageModels'
import {
  RasterViewer,
  type RasterChannelRef,
  type RasterPlaneSelection,
} from '../raster-viewer/raster-viewer.js'

const SCAN_PATH_ID = 'reference-scan-path'

const props = defineProps<{
  image: ReferenceImageResource | null
  documentUrl: URL
  loadPlane: (
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ) => Promise<ImagePlane>
}>()
defineEmits<{ close: [] }>()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const scanPathVisible = ref(true)
const descriptor = ref<ReferenceImageDescriptor | null>(null)
let viewer: RasterViewer | null = null
let controller: AbortController | null = null
let generation = 0

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

async function loadSourcePlane(
  channel: RasterChannelRef,
  _selection: RasterPlaneSelection,
  signal?: AbortSignal,
): Promise<ArrayLike<number>> {
  if (!descriptor.value) throw new Error('No reference image is loaded')
  const plane = await props.loadPlane(
    descriptor.value,
    props.documentUrl,
    { channel: channel.index, z: 0, t: 0 },
    signal,
  )
  return plane.data
}

function installScanPath(image: ReferenceImageDescriptor): void {
  if (!viewer || !image.scan_path) return
  const xAxis = image.axes.find(({ name }) => name.toLowerCase() === 'x')
  const yAxis = image.axes.find(({ name }) => name.toLowerCase() === 'y')
  if (!xAxis || !yAxis) throw new Error('Reference image scan path requires X and Y axes')
  viewer.addXYPlot({
    plot_id: SCAN_PATH_ID,
    name: 'Scan Path',
    // RasterViewer transposes source Y/X into display X/Y.
    x: image.scan_path.y_pixels.map((value) => value * yAxis.spacing),
    y: image.scan_path.x_pixels.map((value) => value * xAxis.spacing),
    mode: 'lines',
    style: { color: '#facc15', line_width: 2 },
    visible: scanPathVisible.value,
    coordinate_space: 'physical',
  })
}

async function reload(): Promise<void> {
  if (!viewer) return
  controller?.abort()
  descriptor.value = null
  viewer.clear()
  if (!props.image) return
  const current = new AbortController()
  controller = current
  const request = ++generation
  loading.value = true
  error.value = null
  try {
    const pixels = await loadPixelDescriptor(props.image.href, current.signal)
    const dimensions = pixels.dims.map((name) => name.toLowerCase())
    if (!(
      (dimensions.length === 2 && dimensions.join(',') === 'y,x') ||
      (dimensions.length === 3 && dimensions.join(',') === 'c,y,x')
    )) {
      throw new Error('Reference image must have Y/X or C/Y/X dimensions')
    }
    if (pixels.num_channels !== 1 && pixels.num_channels !== 2) {
      throw new Error('Reference image must contain one or two channels')
    }
    if (pixels.num_channels !== props.image.num_channels) {
      throw new Error('Reference image channel count does not match its metadata')
    }
    const loadedDescriptor: ReferenceImageDescriptor = {
      ...props.image,
      ...pixels,
      channels: Array.from({ length: pixels.num_channels }, (_, index) => ({
        index,
        contrast: null,
      })),
    }
    descriptor.value = loadedDescriptor
    const plane = await props.loadPlane(
      loadedDescriptor,
      props.documentUrl,
      { channel: 0, z: 0, t: 0 },
      current.signal,
    )
    if (request !== generation) return
    viewer.loadSourcePlane = loadSourcePlane
    await viewer.load(buildReferenceRasterDescriptor(loadedDescriptor, plane))
    if (request !== generation) return
    installScanPath(loadedDescriptor)
  } catch (reason) {
    if (
      request === generation &&
      !(reason instanceof DOMException && reason.name === 'AbortError')
    ) {
      error.value = errorMessage(reason)
    }
  } finally {
    if (request === generation) loading.value = false
  }
}

watch(
  () => props.image?.href ?? null,
  () => void reload(),
)

watch(scanPathVisible, (visible) => {
  if (visible) viewer?.showXYPlot(SCAN_PATH_ID)
  else viewer?.hideXYPlot(SCAN_PATH_ID)
})

onMounted(() => {
  if (!host.value) throw new Error('Reference viewer host is not mounted')
  viewer = new RasterViewer(host.value, {
    theme: 'dark',
    roiChromeEnabled: false,
    hostClipboardBridge: false,
    loadSourcePlane,
  })
  void reload()
})

onBeforeUnmount(() => {
  controller?.abort()
  generation += 1
  viewer?.destroy()
  viewer = null
})
</script>

<template>
  <aside class="metadata-inspector reference-image-inspector" aria-label="Reference image">
    <header class="metadata-inspector__header">
      <h2>Reference image</h2>
      <button
        type="button"
        class="icon-button"
        aria-label="Close reference image"
        @click="$emit('close')"
      >
        <X :size="17" aria-hidden="true" />
      </button>
    </header>
    <div v-show="image" class="reference-image-inspector__body">
      <label class="reference-image-inspector__toggle">
        <input v-model="scanPathVisible" type="checkbox" :disabled="!image?.scan_path" />
        Scan Path
      </label>
      <div ref="host" class="raster-viewer-host" :aria-busy="loading" />
      <p v-if="loading" class="image-status">Loading reference image…</p>
      <p v-else-if="error" class="image-status error-message" role="alert">{{ error }}</p>
    </div>
    <div v-if="!image" class="metadata-inspector__body">
      <p class="muted metadata-empty">This AcqImage has no reference image.</p>
    </div>
  </aside>
</template>
