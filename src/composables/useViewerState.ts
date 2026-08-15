import { computed, ref, shallowRef, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import type { ImagePlane, PlaneIndices } from '../data/omeZarrLoader'
import {
  AcqStoreServerSource,
  ExportedDatasetSource,
  type LocalOpenKind,
  type ViewerDataSource,
} from '../data/viewerDataSource'
import type {
  AcqImageDocument,
  DatasetImage,
  LoadedDocument,
  WebDataset,
  PixelDescriptor,
} from '../models/webDataset'

const DEFAULT_DEVELOPMENT_DATASET = '/__dev_dataset__/dataset.json'

export function initialDatasetUrl(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('dataset')
  return fromUrl ?? (import.meta.env.DEV ? DEFAULT_DEVELOPMENT_DATASET : '')
}

interface UrlSelection {
  image: string | null
  channel: number
  roi: number | null
  z: number
  t: number
}

function nonNegativeInteger(params: URLSearchParams, key: string): number {
  const value = Number(params.get(key))
  return Number.isInteger(value) && value >= 0 ? value : 0
}

export function readUrlSelection(href: string): UrlSelection {
  const params = new URL(href).searchParams
  const roiValue = params.get('roi')
  const roi = roiValue === null ? null : Number(roiValue)
  return {
    image: params.get('image'),
    channel: nonNegativeInteger(params, 'channel'),
    roi: roi !== null && Number.isInteger(roi) && roi >= 0 ? roi : null,
    z: nonNegativeInteger(params, 'z'),
    t: nonNegativeInteger(params, 't'),
  }
}

export function viewerUrl(href: string, state: UrlSelection & { dataset: string }): string {
  const url = new URL(href)
  url.searchParams.set('dataset', state.dataset)
  if (state.image === null) url.searchParams.delete('image')
  else url.searchParams.set('image', state.image)
  url.searchParams.set('channel', String(state.channel))
  if (state.roi === null) url.searchParams.delete('roi')
  else url.searchParams.set('roi', String(state.roi))
  url.searchParams.set('z', String(state.z))
  url.searchParams.set('t', String(state.t))
  return url.href
}

export function useViewerState() {
  const datasetUrl = ref(initialDatasetUrl())
  const serverUrl = ref('http://127.0.0.1:8767')
  const activeSource = shallowRef<ViewerDataSource | null>(null)
  const datasetDocument = shallowRef<LoadedDocument<WebDataset> | null>(null)
  const acqImageDocument = shallowRef<LoadedDocument<AcqImageDocument> | null>(null)
  const selectedImageId = ref<string | null>(null)
  const selectedChannel = ref(0)
  const selectedRoiId = ref<number | null>(null)
  const selectedZ = ref(0)
  const selectedT = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const selectedIndexImage = computed<DatasetImage | null>(
    () =>
      datasetDocument.value?.data.images.find((image) => image.id === selectedImageId.value) ??
      null,
  )

  async function activateSource(source: ViewerDataSource): Promise<void> {
    loading.value = true
    error.value = null
    const previous = activeSource.value
    try {
      const document = await source.loadDataset()
      activeSource.value = source
      datasetDocument.value = document
      datasetUrl.value = datasetDocument.value.url.href
      if (previous && previous !== source) await previous.close()
      const requested = readUrlSelection(window.location.href)
      const first = datasetDocument.value.data.images[0] ?? null
      const target =
        datasetDocument.value.data.images.find((image) => image.id === requested.image) ?? first
      await selectImage(target?.id ?? null)
      const image = acqImageDocument.value?.data
      if (image) {
        if (image.image.channels.some(({ index }) => index === requested.channel)) {
          selectedChannel.value = requested.channel
        }
        if (image.rois.some(({ id }) => id === requested.roi)) selectedRoiId.value = requested.roi
        const zSize = image.image.sizes.z ?? 1
        const tSize = image.image.sizes.t ?? 1
        if (requested.z < zSize) selectedZ.value = requested.z
        if (requested.t < tSize) selectedT.value = requested.t
      }
    } catch (reason) {
      await source.close().catch(() => undefined)
      datasetDocument.value = null
      acqImageDocument.value = null
      selectedImageId.value = null
      error.value = reason instanceof Error ? reason.message : String(reason)
    } finally {
      loading.value = false
    }
  }

  async function openDataset(url = datasetUrl.value): Promise<void> {
    if (!url.trim()) return
    await activateSource(new ExportedDatasetSource(url.trim()))
  }

  async function openServer(kind: LocalOpenKind): Promise<void> {
    if (!serverUrl.value.trim()) return
    await activateSource(new AcqStoreServerSource(serverUrl.value.trim(), kind))
  }

  watch(
    [
      datasetUrl,
      selectedImageId,
      selectedChannel,
      selectedRoiId,
      selectedZ,
      selectedT,
      datasetDocument,
    ],
    () => {
      if (!datasetDocument.value) return
      window.history.replaceState(
        null,
        '',
        viewerUrl(window.location.href, {
          dataset: datasetUrl.value,
          image: selectedImageId.value,
          channel: selectedChannel.value,
          roi: selectedRoiId.value,
          z: selectedZ.value,
          t: selectedT.value,
        }),
      )
    },
    { flush: 'post' },
  )

  async function selectImage(imageId: string | null): Promise<void> {
    selectedImageId.value = imageId
    selectedChannel.value = 0
    selectedRoiId.value = null
    selectedZ.value = 0
    selectedT.value = 0
    acqImageDocument.value = null
    error.value = null
    if (imageId === null || datasetDocument.value === null) return
    const image = datasetDocument.value.data.images.find((candidate) => candidate.id === imageId)
    if (!image) {
      error.value = `Unknown image ID: ${imageId}`
      return
    }
    loading.value = true
    try {
      if (!activeSource.value) throw new Error('No dataset source is active')
      acqImageDocument.value = await activeSource.value.loadImage(
        datasetDocument.value.url,
        image.href,
      )
      selectedRoiId.value = acqImageDocument.value.data.rois[0]?.id ?? null
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason)
    } finally {
      loading.value = false
    }
  }

  function loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    if (!activeSource.value) return Promise.reject(new Error('No dataset source is active'))
    return activeSource.value.loadPlane(descriptor, documentUrl, indices, signal)
  }

  function loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    if (!activeSource.value) return Promise.reject(new Error('No dataset source is active'))
    return activeSource.value.loadTable(url, signal)
  }

  return {
    datasetUrl,
    serverUrl,
    datasetDocument,
    acqImageDocument,
    selectedImageId,
    selectedIndexImage,
    selectedChannel,
    selectedRoiId,
    selectedZ,
    selectedT,
    loading,
    error,
    openDataset,
    openServer,
    selectImage,
    loadPlane,
    loadTable,
  }
}
