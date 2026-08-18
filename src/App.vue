<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import AnalysisPlot from './components/AnalysisPlot.vue'
import AcqImageCollectionSource from './components/AcqImageCollectionSource.vue'
import AcqImageCollectionTable from './components/AcqImageCollectionTable.vue'
import ImageViewer from './components/ImageViewer.vue'
import SelectionControls from './components/SelectionControls.vue'
import { useViewerState } from './composables/useViewerState'
import { plotsForAnalysis } from './plots/analysisPlotRegistry'
import type { AxisRange, LinkedAxisUpdate } from './models/viewState'

const viewer = useViewerState()
const showLocalServer = import.meta.env.DEV
const linkedTimeRange = ref<AxisRange | null>(null)

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

onMounted(() => {
  if (viewer.hostedCollectionUrl.value) void viewer.openAcqImageCollection()
})
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <h1>CloudScope Web</h1>
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
    </header>

    <p v-if="viewer.error.value" class="error-message" role="alert">{{ viewer.error.value }}</p>

    <section v-if="viewer.acqImageCollectionDocument.value" class="panel file-panel">
      <div class="file-panel__heading">
        <strong>{{ viewer.acqImageCollectionDocument.value.data.name }}</strong>
        <button type="button" class="secondary-action" @click="viewer.closeAcqImageCollection()">
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

    <section v-if="viewer.acqImageDocument.value" class="workspace-grid">
      <aside class="panel detail-panel">
        <p class="eyebrow">Selected acquisition</p>
        <h2>{{ viewer.acqImageDocument.value.data.name }}</h2>
        <p class="muted">
          {{ viewer.acqImageDocument.value.data.image.dims.join('').toUpperCase() }} ·
          {{ viewer.acqImageDocument.value.data.image.dtype }}
        </p>
        <SelectionControls
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
      </aside>

      <div class="content-stack">
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
      </div>
    </section>

    <section v-else-if="viewer.loading.value" class="panel empty-state">
      Loading selected file…
    </section>
  </main>
</template>
