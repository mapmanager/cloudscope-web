<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import AnalysisPlot from './components/AnalysisPlot.vue'
import AppToolbar, { type InspectorKind } from './components/AppToolbar.vue'
import AcqImageCollectionSource from './components/AcqImageCollectionSource.vue'
import AcqImageCollectionTable from './components/AcqImageCollectionTable.vue'
import ImageViewer from './components/ImageViewer.vue'
import GithubMark from './components/GithubMark.vue'
import MetadataInspector from './components/MetadataInspector.vue'
import SelectedAcqImageBar from './components/SelectedAcqImageBar.vue'
import VerticalSplitPane from './components/VerticalSplitPane.vue'
import { useViewerState } from './composables/useViewerState'
import { plotsForAnalysis } from './plots/analysisPlotRegistry'
import type { AxisRange, LinkedAxisUpdate } from './models/viewState'

const viewer = useViewerState()
const showLocalServer = import.meta.env.DEV
const linkedTimeRange = ref<AxisRange | null>(null)
const activeInspector = ref<InspectorKind | null>(null)

function updateLinkedAxis(update: LinkedAxisUpdate): void {
  if (update.group === 'time') linkedTimeRange.value = update.range
}

watch(
  () => viewer.selectedAcqImageId.value,
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

const inspector = computed(() =>
  activeInspector.value === 'image-header'
    ? {
        title: 'Image header',
        metadata: imageHeaderMetadata.value,
        emptyMessage: 'No image header metadata is available.',
      }
    : {
        title: 'Experiment metadata',
        metadata: viewer.acqImageDocument.value?.data.metadata.experiment ?? {},
        emptyMessage: 'No experiment metadata is available for this AcqImage.',
      },
)

const footerStatus = computed(() => {
  if (viewer.error.value) return `Error: ${viewer.error.value}`
  if (viewer.loading.value) return 'Loading…'
  if (viewer.acqImageCollectionDocument.value) return 'Ready'
  return 'No collection open'
})

function toggleInspector(kind: InspectorKind): void {
  activeInspector.value = activeInspector.value === kind ? null : kind
}

onMounted(() => {
  if (viewer.hostedCollectionUrl.value) void viewer.openAcqImageCollection()
})
</script>

<template>
  <div class="app-shell" :class="{ 'inspector-open': activeInspector }">
    <header class="app-header">
      <h1>CloudScope Web</h1>
      <div class="app-header__actions">
        <AcqImageCollectionSource
          v-model="viewer.hostedCollectionUrl.value"
          v-model:server-url="viewer.serverUrl.value"
          :loading="viewer.loading.value"
          :show-local-server="showLocalServer"
          @open="viewer.openAcqImageCollection()"
          @open-sample="viewer.openAcqImageCollection"
          @open-server="viewer.openServer"
          @open-exported-folder="viewer.openExportedFolder"
        />
        <a
          class="icon-button"
          href="https://github.com/mapmanager/cloudscope-web"
          target="_blank"
          rel="noreferrer"
          aria-label="Open the CloudScope Web GitHub repository"
          title="GitHub repository"
          ><GithubMark
        /></a>
      </div>
    </header>

    <AppToolbar
      :active="activeInspector"
      :disabled="!viewer.acqImageDocument.value"
      @select="toggleInspector"
    />
    <MetadataInspector
      v-if="activeInspector"
      :title="inspector.title"
      :metadata="inspector.metadata"
      :empty-message="inspector.emptyMessage"
      @close="activeInspector = null"
    />

    <main class="app-main">
      <p v-if="viewer.error.value" class="error-message" role="alert">{{ viewer.error.value }}</p>
      <VerticalSplitPane
        v-if="viewer.acqImageCollectionDocument.value"
        label="Resize collection table"
        :initial-primary-ratio="0.3"
        :minimum-primary="120"
        :minimum-secondary="260"
      >
        <template #primary>
          <section class="panel file-panel">
            <div class="file-panel__heading">
              <strong>{{ viewer.acqImageCollectionDocument.value.data.name }}</strong>
              <button
                type="button"
                class="secondary-action"
                @click="viewer.closeAcqImageCollection()"
              >
                Close collection
              </button>
            </div>
            <AcqImageCollectionTable
              :acq-images="viewer.acqImageCollectionDocument.value.data.acq_images"
              :selected-acq-image-id="viewer.selectedAcqImageId.value"
              :can-unload="viewer.canUnload.value"
              @select="viewer.selectAcqImage"
              @unload="viewer.unloadImage"
            />
          </section>
        </template>
        <template #secondary>
          <section v-if="viewer.acqImageDocument.value" class="selected-workspace">
            <SelectedAcqImageBar
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
            <VerticalSplitPane
              label="Resize image and analysis plots"
              :initial-primary-ratio="0.56"
              :minimum-primary="240"
              :minimum-secondary="180"
            >
              <template #primary>
                <ImageViewer
                  :image="viewer.acqImageDocument.value.data.image"
                  :document-url="viewer.acqImageDocument.value.url"
                  :channel="viewer.selectedChannel.value"
                  :roi="selectedRoi"
                  :z="viewer.selectedZ.value"
                  :t="viewer.selectedT.value"
                  :load-plane="viewer.loadPlane"
                  :x-range="linkedTimeRange"
                  @x-range-change="updateLinkedAxis"
                />
              </template>
              <template #secondary>
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
                <section v-else class="panel empty-state">
                  No plots for this channel and ROI.
                </section>
              </template>
            </VerticalSplitPane>
          </section>
          <section v-else class="panel empty-state">Loading selected AcqImage…</section>
        </template>
      </VerticalSplitPane>
      <section v-else class="panel empty-state">Open an AcqImageCollection to begin.</section>
    </main>

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
