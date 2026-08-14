<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AnalysisPlot from './components/AnalysisPlot.vue'
import DatasetSource from './components/DatasetSource.vue'
import FileTable from './components/FileTable.vue'
import ImageViewer from './components/ImageViewer.vue'
import SelectionControls from './components/SelectionControls.vue'
import { useViewerState } from './composables/useViewerState'

const viewer = useViewerState()

const visibleAnalyses = computed(() => {
  const image = viewer.acqImageDocument.value?.data
  if (!image) return []
  return image.analyses.filter(
    (analysis) =>
      analysis.channel === viewer.selectedChannel.value &&
      analysis.roi_id === viewer.selectedRoiId.value,
  )
})

const selectedRoi = computed(() => {
  const image = viewer.acqImageDocument.value?.data
  return image?.rois.find((roi) => roi.id === viewer.selectedRoiId.value) ?? null
})

onMounted(() => {
  if (viewer.datasetUrl.value) void viewer.openDataset()
})
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <h1>CloudScope Web</h1>
      <DatasetSource
        v-model="viewer.datasetUrl.value"
        :loading="viewer.loading.value"
        @open="viewer.openDataset()"
      />
    </header>

    <p v-if="viewer.error.value" class="error-message" role="alert">{{ viewer.error.value }}</p>

    <section v-if="viewer.datasetDocument.value" class="panel file-panel">
      <FileTable
        :images="viewer.datasetDocument.value.data.images"
        :selected-image-id="viewer.selectedImageId.value"
        @select="viewer.selectImage"
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
        />
        <section class="panel analysis-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Exported results</p>
              <h2>Analysis</h2>
            </div>
          </div>
          <div v-if="visibleAnalyses.length" class="analysis-list">
            <AnalysisPlot
              v-for="analysis in visibleAnalyses"
              :key="analysis.id"
              :analysis="analysis"
              :document-url="viewer.acqImageDocument.value.url"
            />
          </div>
          <p v-else class="empty-state">No exported analysis for this channel and ROI.</p>
        </section>
      </div>
    </section>

    <section v-else-if="viewer.loading.value" class="panel empty-state">
      Loading selected file…
    </section>
  </main>
</template>
