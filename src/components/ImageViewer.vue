<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { axisSize, buildRasterDescriptor } from '../data/rasterDescriptor'
import {
  displayTimeStepSeconds,
  fullLinkedTimeRange,
  linkedRangeFromPhysical,
} from '../data/rasterTimeRange'
import { asPlaneSamples, maxProjectPlanes, slidingZIndices } from '../data/slidingZ'
import type { ImagePlane, PlaneIndices } from '../data/omeZarrLoader'
import type { AxisRange, LinkedAxisUpdate } from '../models/viewState'
import type { PrimaryImageDescriptor, Roi } from '../models/acqImageModels'
import {
  RasterViewer,
  type RasterChannelRef,
  type RasterPlaneSelection,
} from '../raster-viewer/raster-viewer.js'
import '../raster-viewer/raster-viewer.css'

const props = defineProps<{
  image: PrimaryImageDescriptor
  documentUrl: URL
  channel: number
  z: number
  t: number
  roi: Roi | null
  rois: Roi[]
  xRange: AxisRange | null
  loadPlane: (
    descriptor: PrimaryImageDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ) => Promise<ImagePlane>
}>()
const emit = defineEmits<{
  'x-range-change': [update: LinkedAxisUpdate]
  'update:channel': [value: number]
  'update:z': [value: number]
  'update:t': [value: number]
  'update:roiId': [value: number | null]
}>()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let viewer: RasterViewer | null = null
let loadGeneration = 0
let loadController: AbortController | null = null
let fullTime: AxisRange | null = null
let applyingLinkedRange = false

const PROGRAMMATIC_CAUSES = new Set(['api-x-range', 'api-y-range', 'api-physical-range'])

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

async function loadSourcePlane(
  channel: RasterChannelRef,
  selection: RasterPlaneSelection,
  signal?: AbortSignal,
): Promise<ArrayLike<number>> {
  const zSize = axisSize(props.image.sizes, 'z')
  const z = selection.z_index ?? 0
  const t = selection.t_index ?? 0
  const radius = selection.plus_minus_z ?? 0
  if (radius > 0 && zSize !== undefined) {
    const planes = await Promise.all(
      slidingZIndices(z, radius, zSize).map((zIndex) =>
        props.loadPlane(
          props.image,
          props.documentUrl,
          { channel: channel.index, z: zIndex, t },
          signal,
        ),
      ),
    )
    const first = planes[0]
    if (!first) throw new Error('Sliding-Z requires at least one plane')
    assertPlaneMatchesViewer(first)
    return maxProjectPlanes(planes.map((plane) => asPlaneSamples(plane.data)))
  }
  const plane = await props.loadPlane(
    props.image,
    props.documentUrl,
    { channel: channel.index, z, t },
    signal,
  )
  assertPlaneMatchesViewer(plane)
  return asPlaneSamples(plane.data)
}

function assertPlaneMatchesViewer(plane: ImagePlane): void {
  if (!viewer?.displayWidth) return
  const expected = viewer.displayHeight * viewer.displayWidth
  // Descriptor stores source YX; display size is the transpose of that.
  if (plane.data.length !== expected) {
    throw new Error(
      `channel plane sample count mismatch: expected ${String(expected)}, received ${String(plane.data.length)}`,
    )
  }
}

function onViewChange(event: Event): void {
  const detail = (event as CustomEvent).detail as {
    cause?: string
    physical_range?: { x?: { minimum: number; maximum: number } }
  }
  if (!fullTime || applyingLinkedRange) return
  if (detail.cause && PROGRAMMATIC_CAUSES.has(detail.cause)) return
  if (detail.cause === 'reset' || detail.cause === 'api-reset') {
    emit('x-range-change', { group: 'time', range: null })
    return
  }
  const physical = detail.physical_range?.x
  if (!physical) return
  emit('x-range-change', {
    group: 'time',
    range: linkedRangeFromPhysical(physical.minimum, physical.maximum, fullTime),
  })
}

function onChannelSelected(event: Event): void {
  const channelId = (event as CustomEvent).detail?.channel_id
  const channel = Number(channelId)
  if (Number.isInteger(channel) && channel !== props.channel) emit('update:channel', channel)
}

function onRoiSelect(event: Event): void {
  const roiId = (event as CustomEvent).detail?.roi_id as number | null
  if (roiId !== props.roi?.id) emit('update:roiId', roiId)
}

function onPlaneChange(event: Event): void {
  const detail = (event as CustomEvent).detail as {
    z_index?: number | null
    t_index?: number | null
  }
  if (typeof detail.z_index === 'number' && detail.z_index !== props.z) {
    emit('update:z', detail.z_index)
  }
  if (typeof detail.t_index === 'number' && detail.t_index !== props.t) {
    emit('update:t', detail.t_index)
  }
}

function onRasterError(event: Event): void {
  const message = (event as CustomEvent).detail?.message
  error.value = typeof message === 'string' ? message : 'Raster viewer error'
}

function bindViewer(instance: RasterViewer): void {
  instance.host.addEventListener('raster-view-change', onViewChange)
  instance.host.addEventListener('raster-channel-selected', onChannelSelected)
  instance.host.addEventListener('raster-roi-select', onRoiSelect)
  instance.host.addEventListener('raster-plane-change', onPlaneChange)
  instance.host.addEventListener('raster-error', onRasterError)
}

function unbindViewer(instance: RasterViewer): void {
  instance.host.removeEventListener('raster-view-change', onViewChange)
  instance.host.removeEventListener('raster-channel-selected', onChannelSelected)
  instance.host.removeEventListener('raster-roi-select', onRoiSelect)
  instance.host.removeEventListener('raster-plane-change', onPlaneChange)
  instance.host.removeEventListener('raster-error', onRasterError)
}

async function applyLinkedRange(range: AxisRange | null): Promise<void> {
  if (!viewer) return
  applyingLinkedRange = true
  try {
    if (range === null) viewer.resetXRange()
    else viewer.setXRange(range.min, range.max)
  } finally {
    applyingLinkedRange = false
  }
}

async function reload(): Promise<void> {
  if (!viewer) return
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  const generation = ++loadGeneration
  loading.value = true
  error.value = null
  try {
    const probeChannel =
      props.image.channels.find((channel) => channel.index === props.channel)?.index ??
      props.image.channels[0]?.index ??
      0
    const probe = await props.loadPlane(
      props.image,
      props.documentUrl,
      { channel: probeChannel, z: props.z, t: props.t },
      controller.signal,
    )
    if (generation !== loadGeneration) return
    fullTime = fullLinkedTimeRange(probe.height, displayTimeStepSeconds(probe.axes.y))
    const descriptor = buildRasterDescriptor(props.image, probe, props.rois)
    viewer.loadSourcePlane = loadSourcePlane
    await viewer.load(descriptor)
    if (generation !== loadGeneration) return
    const selected = String(props.channel)
    if (descriptor.channels.some((channel) => channel.id === selected)) {
      viewer.selectChannel(selected, false)
    }
    await viewer.setZIndex(props.z)
    await viewer.setTIndex(props.t)
    if (props.roi) viewer.selectRoi(props.roi.id)
    else viewer.selectRoi(null)
    if (props.xRange) await applyLinkedRange(props.xRange)
    await nextTick()
  } catch (reason) {
    if (
      generation === loadGeneration &&
      !(reason instanceof DOMException && reason.name === 'AbortError')
    ) {
      error.value = errorMessage(reason)
    }
  } finally {
    if (generation === loadGeneration) {
      loading.value = false
      if (loadController === controller) loadController = null
    }
  }
}

watch(
  () => [props.image.href, props.documentUrl.href],
  () => {
    void reload()
  },
)

watch(
  () => props.channel,
  (channel) => {
    if (!viewer) return
    try {
      viewer.selectChannel(String(channel), false)
    } catch {
      // Channel list is rebuilt on image load; ignore stale selections.
    }
  },
)

watch(
  () => props.z,
  (z) => {
    if (viewer) void viewer.setZIndex(z)
  },
)

watch(
  () => props.t,
  (t) => {
    if (viewer) void viewer.setTIndex(t)
  },
)

watch(
  () => props.roi?.id ?? null,
  (roiId) => {
    viewer?.selectRoi(roiId)
  },
)

watch(
  () => props.xRange,
  (range) => {
    void applyLinkedRange(range)
  },
  { deep: true },
)

onMounted(() => {
  const root = host.value
  if (!root) throw new Error('Raster viewer host is not mounted')
  viewer = new RasterViewer(root, {
    theme: 'dark',
    roiChromeEnabled: true,
    roiToolbarVisible: true,
    roiEditingEnabled: false,
    roiHostMode: 'delegated',
    hostClipboardBridge: false,
    loadSourcePlane,
  })
  bindViewer(viewer)
  void reload()
})

onBeforeUnmount(() => {
  loadController?.abort()
  loadGeneration += 1
  if (viewer) {
    unbindViewer(viewer)
    viewer.destroy()
    viewer = null
  }
})
</script>

<template>
  <section class="panel image-panel">
    <div ref="host" class="raster-viewer-host" :aria-busy="loading" />
    <p v-if="loading" class="image-status">Loading image plane…</p>
    <p v-else-if="error" class="image-status error-message" role="alert">{{ error }}</p>
  </section>
</template>
