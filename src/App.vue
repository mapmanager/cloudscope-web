<script setup lang="ts">
import { BookOpen } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import AnalysisPlot from './components/AnalysisPlot.vue'
import AppToolbar, { type InspectorKind } from './components/AppToolbar.vue'
import AcqImageCollectionSource from './components/AcqImageCollectionSource.vue'
import AcqImageCollectionTable from './components/AcqImageCollectionTable.vue'
import ImageViewer from './components/ImageViewer.vue'
import CollectionFilesInspector from './components/CollectionFilesInspector.vue'
import MetadataInspector from './components/MetadataInspector.vue'
import NicePoolPanel from './components/NicePoolPanel.vue'
import ResizableSection from './components/ResizableSection.vue'
import ReferenceImageInspector from './components/ReferenceImageInspector.vue'
import SelectedAcqImageBar from './components/SelectedAcqImageBar.vue'
import { useViewerState } from './composables/useViewerState'
import { appInformation } from './config/buildInfo'
import { preferredAnalysisTableForUrl } from './config/sampleCollections'
import { clampSectionHeight } from './data/resizableSection'
import { plotsForAnalysis } from './plots/analysisPlotRegistry'
import type { AxisRange, LinkedAxisUpdate } from './models/viewState'

const viewer = useViewerState()
const showLocalServer = import.meta.env.DEV
/** Hidden while the raster viewer owns Channel/ROI/Z/T. Restore after 2-channel sample smoke. */
const showSelectedAcqImageBar = false
const linkedTimeRange = ref<AxisRange | null>(null)
const activeInspector = ref<InspectorKind | null>(null)
/** Matches `--inspector-open-width` until the user drags the inspector split. */
const INSPECTOR_MIN_WIDTH = 0
const INSPECTOR_MAX_WIDTH = 720
const INSPECTOR_DEFAULT_WIDTH = 320
/** Widths thinner than the handle count as closed on pointer-up / Home. */
const INSPECTOR_CLOSE_WIDTH = 8
const inspectorWidth = ref(INSPECTOR_DEFAULT_WIDTH)
const inspectorResizing = ref(false)
const nicepoolOpen = ref(false)
const NICEPOOL_MIN_WIDTH = 0
const NICEPOOL_MAX_WIDTH = 1200
const NICEPOOL_DEFAULT_WIDTH = 720
const NICEPOOL_CLOSE_WIDTH = 8
const nicepoolWidth = ref(NICEPOOL_DEFAULT_WIDTH)
const nicepoolResizing = ref(false)
let inspectorDrag: { pointerId: number; startX: number; startWidth: number } | null = null
let nicepoolDrag: { pointerId: number; startX: number; startWidth: number } | null = null

function resizeInspector(requested: number): void {
  inspectorWidth.value = clampSectionHeight(requested, INSPECTOR_MIN_WIDTH, INSPECTOR_MAX_WIDTH)
}

function closeCollapsedInspector(): void {
  activeInspector.value = null
  inspectorWidth.value = INSPECTOR_DEFAULT_WIDTH
}

function finishInspectorResize(): void {
  inspectorDrag = null
  inspectorResizing.value = false
  if (inspectorWidth.value < INSPECTOR_CLOSE_WIDTH) closeCollapsedInspector()
}

function inspectorPointerDown(event: PointerEvent): void {
  inspectorDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: inspectorWidth.value,
  }
  inspectorResizing.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function inspectorPointerMove(event: PointerEvent): void {
  if (!inspectorDrag || inspectorDrag.pointerId !== event.pointerId) return
  resizeInspector(inspectorDrag.startWidth + event.clientX - inspectorDrag.startX)
}

function inspectorPointerUp(event: PointerEvent): void {
  if (inspectorDrag?.pointerId !== event.pointerId) return
  finishInspectorResize()
}

function inspectorKeyDown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 40 : 10
  if (event.key === 'ArrowLeft') resizeInspector(inspectorWidth.value - step)
  else if (event.key === 'ArrowRight') resizeInspector(inspectorWidth.value + step)
  else if (event.key === 'Home') resizeInspector(INSPECTOR_MIN_WIDTH)
  else resizeInspector(INSPECTOR_MAX_WIDTH)
  if (inspectorWidth.value < INSPECTOR_CLOSE_WIDTH) closeCollapsedInspector()
}

function resizeNicePool(requested: number): void {
  nicepoolWidth.value = clampSectionHeight(requested, NICEPOOL_MIN_WIDTH, NICEPOOL_MAX_WIDTH)
}

function toggleNicePool(): void {
  nicepoolOpen.value = !nicepoolOpen.value
  if (nicepoolOpen.value && nicepoolWidth.value < NICEPOOL_CLOSE_WIDTH) {
    nicepoolWidth.value = NICEPOOL_DEFAULT_WIDTH
  }
}

function finishNicePoolResize(): void {
  nicepoolDrag = null
  nicepoolResizing.value = false
  if (nicepoolWidth.value < NICEPOOL_CLOSE_WIDTH) {
    nicepoolOpen.value = false
    nicepoolWidth.value = NICEPOOL_DEFAULT_WIDTH
  }
}

function nicepoolPointerDown(event: PointerEvent): void {
  nicepoolDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: nicepoolWidth.value,
  }
  nicepoolResizing.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function nicepoolPointerMove(event: PointerEvent): void {
  if (!nicepoolDrag || nicepoolDrag.pointerId !== event.pointerId) return
  resizeNicePool(nicepoolDrag.startWidth - (event.clientX - nicepoolDrag.startX))
}

function nicepoolPointerUp(event: PointerEvent): void {
  if (nicepoolDrag?.pointerId !== event.pointerId) return
  finishNicePoolResize()
}

function nicepoolKeyDown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 40 : 10
  if (event.key === 'ArrowLeft') resizeNicePool(nicepoolWidth.value + step)
  else if (event.key === 'ArrowRight') resizeNicePool(nicepoolWidth.value - step)
  else if (event.key === 'Home') resizeNicePool(NICEPOOL_MIN_WIDTH)
  else resizeNicePool(NICEPOOL_MAX_WIDTH)
  if (nicepoolWidth.value < NICEPOOL_CLOSE_WIDTH) finishNicePoolResize()
}

function updateLinkedAxis(update: LinkedAxisUpdate): void {
  if (update.group === 'time') linkedTimeRange.value = update.range
}

watch(
  () => viewer.acqImageDocument.value?.data.id,
  () => {
    linkedTimeRange.value = null
  },
)

const visibleAnalyses = computed(() => {
  const image = viewer.acqImageDocument.value?.data
  if (!image) return []
  return image.analyses.filter(
    (analysis) =>
      analysis.channel === viewer.selectedChannel.value &&
      analysis.roi_id === viewer.selectedRoiId.value &&
      plotsForAnalysis(analysis.analysis_type).length > 0,
  )
})

const selectedRoi = computed(() => {
  const image = viewer.acqImageDocument.value?.data
  return image?.rois.find((roi) => roi.id === viewer.selectedRoiId.value) ?? null
})

const imageHeaderMetadata = computed<Record<string, unknown>>(() => {
  const image = viewer.acqImageDocument.value?.data
  if (!image) return {}
  return {
    shape: image.image.shape,
    dims: image.image.dims,
    sizes: image.image.sizes,
    dtype: image.image.dtype,
    num_channels: image.image.num_channels,
    acquisition: image.image.acquisition,
    axes: image.image.axes,
    ...image.metadata.image_header,
  }
})

const inspector = computed(() => {
  if (activeInspector.value === 'image-header') {
    return {
      title: 'Image header',
      metadata: imageHeaderMetadata.value,
      emptyMessage: 'No image header metadata is available.',
      loading: viewer.acqImageLoading.value,
    }
  }
  if (activeInspector.value === 'app-info') {
    return {
      title: 'App information',
      metadata: appInformation,
      emptyMessage: 'No app information is available.',
      loading: false,
    }
  }
  return {
    title: 'Experiment metadata',
    metadata: viewer.acqImageDocument.value?.data.metadata.experiment ?? {},
    emptyMessage: 'No experiment metadata is available for this AcqImage.',
    loading: viewer.acqImageLoading.value,
  }
})

const footerStatus = computed(() => {
  if (viewer.error.value) return `Error: ${viewer.error.value}`
  if (viewer.loading.value) return 'Loading…'
  if (viewer.acqImageCollectionDocument.value) return 'Ready'
  return 'No collection open'
})

function toggleInspector(kind: InspectorKind): void {
  if (activeInspector.value === kind) {
    activeInspector.value = null
    return
  }
  if (inspectorWidth.value < INSPECTOR_CLOSE_WIDTH) {
    inspectorWidth.value = INSPECTOR_DEFAULT_WIDTH
  }
  activeInspector.value = kind
}

onMounted(() => {
  if (viewer.hostedCollectionUrl.value) void viewer.openAcqImageCollection()
})
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'inspector-open': activeInspector,
      'inspector-resizing': inspectorResizing,
      'nicepool-open': nicepoolOpen,
      'nicepool-resizing': nicepoolResizing,
    }"
    :style="{
      '--inspector-open-width': `${inspectorWidth}px`,
      '--nicepool-open-width': `${nicepoolWidth}px`,
    }"
  >
    <header class="app-header">
      <h1>CloudScope Web</h1>
      <div class="app-header__actions">
        <span v-if="viewer.acqImageCollectionDocument.value" class="app-header__collection-name">
          {{ viewer.acqImageCollectionDocument.value.data.name }}
        </span>
        <AcqImageCollectionSource
          v-model="viewer.hostedCollectionUrl.value"
          v-model:server-url="viewer.serverUrl.value"
          :loading="viewer.loading.value"
          :show-local-server="showLocalServer"
          @open="viewer.openAcqImageCollection()"
          @open-sample="viewer.openAcqImageCollection"
          @open-server="viewer.openServer"
          @open-exported-folder="viewer.openExportedFolder"
          @open-local-directory="viewer.openLocalDirectory"
        />
        <a
          class="icon-button"
          href="https://mapmanager.github.io/cloudscope-web/docs/"
          target="_blank"
          rel="noreferrer"
          aria-label="Open the CloudScope Web documentation"
          title="Documentation"
        >
          <BookOpen :size="19" aria-hidden="true" />
        </a>
      </div>
    </header>

    <AppToolbar
      :active="activeInspector"
      :files-disabled="!viewer.acqImageCollectionDocument.value"
      :metadata-disabled="!viewer.acqImageDocument.value"
      :nicepool-disabled="!viewer.acqImageCollectionDocument.value"
      :nicepool-open="nicepoolOpen"
      @select="toggleInspector"
      @toggle-nicepool="toggleNicePool"
    />
    <CollectionFilesInspector
      v-if="activeInspector === 'files' && viewer.acqImageCollectionDocument.value"
      :acq-images="viewer.acqImageCollectionDocument.value.data.acq_images"
      :selected-acq-image-id="viewer.selectedAcqImageId.value"
      @select="viewer.selectAcqImage"
      @close="activeInspector = null"
    />
    <MetadataInspector
      v-else-if="
        activeInspector === 'image-header' ||
        activeInspector === 'experiment' ||
        activeInspector === 'app-info'
      "
      :title="inspector.title"
      :metadata="inspector.metadata"
      :empty-message="inspector.emptyMessage"
      :loading="inspector.loading"
      @close="activeInspector = null"
    >
      <template v-if="activeInspector === 'app-info'" #before-metadata>
        <div class="app-information-intro">
          <p>
            CloudScope Web is a static, browser-based viewer for
            <a href="https://mapmanager.github.io/acqstore/" target="_blank" rel="noreferrer">
              AcqStore
            </a>
            Collection OME-Zarr stores.
          </p>
          <p>
            Learn more in the
            <a href="https://mapmanager.github.io/cloudscope-app/" target="_blank" rel="noreferrer">
              CloudScope App documentation</a
            >.
          </p>
          <p>
            Contact:
            <a href="mailto:robert.cudmore@gmail.com">robert.cudmore@gmail.com</a>
          </p>
        </div>
      </template>
    </MetadataInspector>
    <ReferenceImageInspector
      v-else-if="activeInspector === 'reference-image' && viewer.acqImageDocument.value"
      :image="viewer.acqImageDocument.value.data.reference_image"
      :document-url="viewer.acqImageDocument.value.url"
      :load-plane="viewer.loadPlane"
      :load-pixel-descriptor="viewer.loadPixelDescriptor"
      @close="activeInspector = null"
    />
    <div
      v-if="activeInspector"
      class="resize-handle resize-handle--vertical resize-handle--inspector"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label="Resize inspector"
      :aria-valuemin="INSPECTOR_MIN_WIDTH"
      :aria-valuemax="INSPECTOR_MAX_WIDTH"
      :aria-valuenow="Math.round(inspectorWidth)"
      @pointerdown="inspectorPointerDown"
      @pointermove="inspectorPointerMove"
      @pointerup="inspectorPointerUp"
      @pointercancel="inspectorPointerUp"
      @keydown="inspectorKeyDown"
    >
      <span aria-hidden="true" />
    </div>

    <main class="app-main">
      <p v-if="viewer.error.value" class="error-message" role="alert">{{ viewer.error.value }}</p>
      <template v-if="viewer.acqImageCollectionDocument.value">
        <ResizableSection
          label="Resize collection table"
          :initial-height="250"
          :minimum-height="0"
          :maximum-height="600"
        >
          <section class="panel file-panel">
            <AcqImageCollectionTable
              :acq-images="viewer.acqImageCollectionDocument.value.data.acq_images"
              :selected-acq-image-id="viewer.selectedAcqImageId.value"
              :can-unload="viewer.canUnload.value"
              @select="viewer.selectAcqImage"
              @unload="viewer.unloadImage"
            />
          </section>
        </ResizableSection>

        <template v-if="viewer.acqImageDocument.value">
          <SelectedAcqImageBar
            v-if="showSelectedAcqImageBar"
            :image="viewer.acqImageDocument.value.data"
            :channel="viewer.selectedChannel.value"
            :roi-id="viewer.selectedRoiId.value"
            :z="viewer.selectedZ.value"
            :t="viewer.selectedT.value"
            @update:channel="viewer.selectedChannel.value = $event"
            @update:roi-id="viewer.selectedRoiId.value = $event"
            @update:z="viewer.selectedZ.value = $event"
            @update:t="viewer.selectedT.value = $event"
          />
          <ResizableSection
            label="Resize image viewer"
            :initial-height="440"
            :minimum-height="0"
            :maximum-height="900"
          >
            <ImageViewer
              :image="viewer.acqImageDocument.value.data.image"
              :document-url="viewer.acqImageDocument.value.url"
              :channel="viewer.selectedChannel.value"
              :rois="viewer.acqImageDocument.value.data.rois"
              :roi="selectedRoi"
              :z="viewer.selectedZ.value"
              :t="viewer.selectedT.value"
              :load-plane="viewer.loadPlane"
              :x-range="linkedTimeRange"
              @x-range-change="updateLinkedAxis"
              @update:channel="viewer.selectedChannel.value = $event"
              @update:z="viewer.selectedZ.value = $event"
              @update:t="viewer.selectedT.value = $event"
              @update:roi-id="viewer.selectedRoiId.value = $event"
            />
          </ResizableSection>
          <div v-if="visibleAnalyses.length" class="analysis-list">
            <AnalysisPlot
              v-for="analysis in visibleAnalyses"
              :key="analysis.id"
              :analysis="analysis"
              :document-url="viewer.acqImageDocument.value.url"
              :load-table="viewer.loadTable"
              :x-range="linkedTimeRange"
              @x-range-change="updateLinkedAxis"
            />
          </div>
          <section v-else class="panel empty-state">No plots for this channel and ROI.</section>
        </template>
        <section v-else class="panel empty-state">Loading selected AcqImage…</section>
      </template>
      <section v-else class="panel empty-state">Open an AcqImageCollection to begin.</section>
    </main>

    <div
      v-if="nicepoolOpen"
      class="resize-handle resize-handle--vertical resize-handle--nicepool"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label="Resize NicePool"
      :aria-valuemin="NICEPOOL_MIN_WIDTH"
      :aria-valuemax="NICEPOOL_MAX_WIDTH"
      :aria-valuenow="Math.round(nicepoolWidth)"
      @pointerdown="nicepoolPointerDown"
      @pointermove="nicepoolPointerMove"
      @pointerup="nicepoolPointerUp"
      @pointercancel="nicepoolPointerUp"
      @keydown="nicepoolKeyDown"
    >
      <span aria-hidden="true" />
    </div>
    <NicePoolPanel
      v-if="nicepoolOpen && viewer.acqImageCollectionDocument.value"
      :collection-url="viewer.acqImageCollectionDocument.value.url"
      :analysis-tables="viewer.acqImageCollectionDocument.value.data.analysis_tables"
      :preferred-table="preferredAnalysisTableForUrl(viewer.acqImageCollectionDocument.value.url)"
      :load-table="viewer.loadCollectionTable"
      :load-json="viewer.loadCollectionJson"
      :selected-acq-image-id="viewer.selectedAcqImageId.value"
      :selected-channel="viewer.selectedChannel.value"
      :selected-roi-id="viewer.selectedRoiId.value"
      @select-analysis-row="viewer.selectAnalysisRow"
    />

    <footer class="app-footer">
      <span>{{ viewer.acqImageDocument.value?.data.name ?? 'No AcqImage' }}</span>
      <span>Channel {{ viewer.selectedChannel.value }}</span>
      <span>ROI {{ viewer.selectedRoiId.value ?? '—' }}</span>
      <span class="app-footer__status" :class="{ error: viewer.error.value }">{{
        footerStatus
      }}</span>
    </footer>
  </div>
</template>
