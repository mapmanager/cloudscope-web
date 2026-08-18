import { computed, ref, shallowRef, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import type { ImagePlane, PlaneIndices } from '../data/omeZarrLoader'
import {
  AcqStoreServerSource,
  ExportedDatasetSource,
  OmeZarrCollectionSource,
  ServerExportedDatasetSource,
  type LocalOpenKind,
  type ViewerDataSource,
} from '../data/viewerDataSource'
import { DEFAULT_PLANE_CACHE_OPTIONS, PlaneCache, type PlaneCacheOptions } from '../data/planeCache'
import type {
  AcqImageDocument,
  DatasetImage,
  LoadedDocument,
  WebDataset,
  PixelDescriptor,
} from '../models/webDataset'

const DEFAULT_DEVELOPMENT_DATASET = '/__dev_collection__/'

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

export function useViewerState(planeCacheOptions: PlaneCacheOptions = DEFAULT_PLANE_CACHE_OPTIONS) {
  const hostedDatasetUrl = ref(initialDatasetUrl())
  const serverUrl = ref('http://127.0.0.1:8767')
  const planeCache = new PlaneCache(planeCacheOptions)
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
  const canUnload = computed(() => activeSource.value?.canUnload ?? false)
  let selectionRequest = 0

  function errorMessage(reason: unknown): string {
    if (import.meta.env.DEV) console.error(reason)
    return reason instanceof Error ? reason.message : String(reason)
  }

  function updateLoadState(
    imageId: string,
    patch: Partial<{ pixels: boolean; analysisCsv: boolean }>,
  ) {
    const document = datasetDocument.value
    if (!document) return
    datasetDocument.value = {
      ...document,
      data: {
        ...document.data,
        images: document.data.images.map((image) =>
          image.id === imageId
            ? {
                ...image,
                load_state: { pixels: false, analysisCsv: false, ...image.load_state, ...patch },
              }
            : image,
        ),
      },
    }
  }

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
      planeCache.clear()
      activeSource.value = source
      datasetDocument.value = document
      if (previous && previous !== source) await previous.close().catch(() => undefined)
      const requested = source.persistInUrl
        ? readUrlSelection(window.location.href)
        : { image: null, channel: 0, roi: null, z: 0, t: 0 }
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
      error.value = errorMessage(reason)
    } finally {
      loading.value = false
    }
  }

  async function openDataset(url = hostedDatasetUrl.value): Promise<void> {
    if (!url.trim()) return
    const resolved = url.trim()
    // Temporary migration compatibility: remove this Web Dataset v1 branch
    // after hosted and server-backed collection loading reach feature parity.
    const source = resolved.endsWith('.json')
      ? new ExportedDatasetSource(resolved)
      : new OmeZarrCollectionSource(resolved)
    await activateSource(source)
  }

  async function openServer(kind: LocalOpenKind): Promise<void> {
    if (!serverUrl.value.trim()) return
    await activateSource(new AcqStoreServerSource(serverUrl.value.trim(), kind))
  }

  async function openExportedFolder(): Promise<void> {
    if (!serverUrl.value.trim()) return
    await activateSource(new ServerExportedDatasetSource(serverUrl.value.trim()))
  }

  watch(
    [selectedImageId, selectedChannel, selectedRoiId, selectedZ, selectedT, datasetDocument],
    () => {
      if (!datasetDocument.value) return
      if (!activeSource.value?.persistInUrl) {
        const url = new URL(window.location.href)
        for (const key of ['dataset', 'image', 'channel', 'roi', 'z', 't']) {
          url.searchParams.delete(key)
        }
        window.history.replaceState(null, '', url)
        return
      }
      window.history.replaceState(
        null,
        '',
        viewerUrl(window.location.href, {
          dataset: datasetDocument.value.url.href,
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
    const request = ++selectionRequest
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
      const source = activeSource.value
      const loaded = await source.loadImage(datasetDocument.value.url, image.href)
      if (request !== selectionRequest || selectedImageId.value !== imageId) return
      acqImageDocument.value = loaded
      if (loaded.data.load_state) {
        updateLoadState(imageId, loaded.data.load_state)
      }
      selectedRoiId.value = loaded.data.rois[0]?.id ?? null
    } catch (reason) {
      if (request === selectionRequest) {
        error.value = errorMessage(reason)
      }
    } finally {
      if (request === selectionRequest) loading.value = false
    }
  }

  async function loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    if (!activeSource.value) throw new Error('No dataset source is active')
    const source = activeSource.value
    const imageId = acqImageDocument.value?.data.id
    if (!imageId) throw new Error('No image is selected')
    const key = [
      datasetDocument.value?.url.href ?? '',
      imageId,
      new URL(descriptor.href, documentUrl).href,
      indices.channel,
      indices.z,
      indices.t,
      0,
    ].join('|')
    const plane = await planeCache.getOrLoad(
      key,
      imageId,
      () => source.loadPlane(descriptor, documentUrl, indices),
      signal,
    )
    if (activeSource.value === source) {
      updateLoadState(imageId, { pixels: true })
    }
    return plane
  }

  async function loadTable(url: URL, signal?: AbortSignal): Promise<CsvTable> {
    if (!activeSource.value) throw new Error('No dataset source is active')
    const source = activeSource.value
    const imageId = acqImageDocument.value?.data.id
    const table = await source.loadTable(url, signal)
    if (imageId && activeSource.value === source) {
      updateLoadState(imageId, { analysisCsv: true })
    }
    return table
  }

  async function unloadImage(imageId: string): Promise<void> {
    if (!activeSource.value?.canUnload) return
    loading.value = true
    error.value = null
    try {
      await activeSource.value.unloadImage(imageId)
      planeCache.invalidateImage(imageId)
      if (activeSource.value.refreshAfterUnload) {
        datasetDocument.value = await activeSource.value.refreshDataset()
      } else {
        updateLoadState(imageId, { pixels: false, analysisCsv: false })
      }
    } catch (reason) {
      error.value = errorMessage(reason)
    } finally {
      loading.value = false
    }
  }

  async function closeDataset(): Promise<void> {
    const source = activeSource.value
    activeSource.value = null
    planeCache.clear()
    if (source) await source.close().catch(() => undefined)
    datasetDocument.value = null
    acqImageDocument.value = null
    selectedImageId.value = null
    hostedDatasetUrl.value = ''
    const url = new URL(window.location.href)
    for (const key of ['dataset', 'image', 'channel', 'roi', 'z', 't']) url.searchParams.delete(key)
    window.history.replaceState(null, '', url)
  }

  return {
    hostedDatasetUrl,
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
    canUnload,
    openDataset,
    openServer,
    openExportedFolder,
    selectImage,
    loadPlane,
    loadTable,
    unloadImage,
    closeDataset,
  }
}
