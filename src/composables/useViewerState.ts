import { computed, ref, shallowRef, watch } from 'vue'

import type { CsvTable } from '../data/csvLoader'
import type { ImagePlane, PlaneIndices } from '../data/omeZarrLoader'
import { defaultSampleCollection } from '../config/sampleCollections'
import {
  AcqStoreServerSource,
  ExportedDatasetSource,
  AcqImageCollectionSource,
  ServerExportedDatasetSource,
  type LocalOpenKind,
  type ViewerDataSource,
} from '../data/viewerDataSource'
import { DEFAULT_PLANE_CACHE_OPTIONS, PlaneCache, type PlaneCacheOptions } from '../data/planeCache'
import type {
  AcqImageDocument,
  AcqImageCollection,
  AcqImageCollectionRow,
  LoadedDocument,
  PixelDescriptor,
} from '../models/acqImageModels'

const DEFAULT_DEVELOPMENT_COLLECTION = '/__dev_collection__/'

/**
 * Selects the initial collection without requiring a runtime server.
 *
 * Explicit query-string state wins, followed by a configured Vite development
 * collection and finally the bundled diameter sample.
 *
 * @returns A URL accepted by {@link openAcqImageCollection}.
 */
export function initialCollectionUrl(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('collection')
  if (fromUrl) return fromUrl
  if (import.meta.env.DEV && __ACQSTORE_DEV_DATASET_CONFIGURED__) {
    return DEFAULT_DEVELOPMENT_COLLECTION
  }
  return defaultSampleCollection.url
}

interface UrlSelection {
  acqImage: string | null
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
    acqImage: params.get('acq_image'),
    channel: nonNegativeInteger(params, 'channel'),
    roi: roi !== null && Number.isInteger(roi) && roi >= 0 ? roi : null,
    z: nonNegativeInteger(params, 'z'),
    t: nonNegativeInteger(params, 't'),
  }
}

export function viewerUrl(href: string, state: UrlSelection & { collection: string }): string {
  const url = new URL(href)
  url.searchParams.set('collection', state.collection)
  if (state.acqImage === null) url.searchParams.delete('acq_image')
  else url.searchParams.set('acq_image', state.acqImage)
  url.searchParams.set('channel', String(state.channel))
  if (state.roi === null) url.searchParams.delete('roi')
  else url.searchParams.set('roi', String(state.roi))
  url.searchParams.set('z', String(state.z))
  url.searchParams.set('t', String(state.t))
  return url.href
}

export function useViewerState(planeCacheOptions: PlaneCacheOptions = DEFAULT_PLANE_CACHE_OPTIONS) {
  const hostedCollectionUrl = ref(initialCollectionUrl())
  const serverUrl = ref('http://127.0.0.1:8767')
  const planeCache = new PlaneCache(planeCacheOptions)
  const activeSource = shallowRef<ViewerDataSource | null>(null)
  const acqImageCollectionDocument = shallowRef<LoadedDocument<AcqImageCollection> | null>(null)
  const acqImageDocument = shallowRef<LoadedDocument<AcqImageDocument> | null>(null)
  const selectedAcqImageId = ref<string | null>(null)
  const selectedChannel = ref(0)
  const selectedRoiId = ref<number | null>(null)
  const selectedZ = ref(0)
  const selectedT = ref(0)
  const loading = ref(false)
  const acqImageLoading = ref(false)
  const error = ref<string | null>(null)
  const canUnload = computed(() => activeSource.value?.canUnload ?? false)
  let selectionRequest = 0
  let selectionController: AbortController | null = null

  /** Cancel a descriptor request that can no longer update the active selection. */
  function cancelSelectionRequest(): void {
    selectionRequest += 1
    selectionController?.abort()
    selectionController = null
    acqImageLoading.value = false
    loading.value = false
  }

  function errorMessage(reason: unknown): string {
    if (import.meta.env.DEV) console.error(reason)
    return reason instanceof Error ? reason.message : String(reason)
  }

  function updateLoadState(
    imageId: string,
    patch: Partial<{ pixels: boolean; analysisCsv: boolean }>,
  ) {
    const document = acqImageCollectionDocument.value
    if (!document) return
    acqImageCollectionDocument.value = {
      ...document,
      data: {
        ...document.data,
        acq_images: document.data.acq_images.map((image) =>
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

  const selectedIndexImage = computed<AcqImageCollectionRow | null>(
    () =>
      acqImageCollectionDocument.value?.data.acq_images.find(
        (image) => image.id === selectedAcqImageId.value,
      ) ?? null,
  )

  async function activateSource(source: ViewerDataSource): Promise<void> {
    cancelSelectionRequest()
    loading.value = true
    error.value = null
    const previous = activeSource.value
    try {
      const document = await source.loadCollection()
      planeCache.clear()
      activeSource.value = source
      acqImageCollectionDocument.value = document
      acqImageDocument.value = null
      selectedAcqImageId.value = null
      if (previous && previous !== source) await previous.close().catch(() => undefined)
      const requested = source.persistInUrl
        ? readUrlSelection(window.location.href)
        : { acqImage: null, channel: 0, roi: null, z: 0, t: 0 }
      const first = acqImageCollectionDocument.value.data.acq_images[0] ?? null
      const target =
        acqImageCollectionDocument.value.data.acq_images.find(
          (image) => image.id === requested.acqImage,
        ) ?? first
      await selectAcqImage(target?.id ?? null)
      const selectedDocument = acqImageDocument.value as LoadedDocument<AcqImageDocument> | null
      const image = selectedDocument?.data
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
      acqImageCollectionDocument.value = null
      acqImageDocument.value = null
      selectedAcqImageId.value = null
      error.value = errorMessage(reason)
    } finally {
      loading.value = false
    }
  }

  /** Opens a hosted, bundled, or development-served collection URL. */
  async function openAcqImageCollection(url = hostedCollectionUrl.value): Promise<void> {
    if (!url.trim()) return
    const resolved = url.trim()
    hostedCollectionUrl.value = resolved
    // Temporary migration compatibility: remove this Web Dataset v1 branch
    // after hosted and server-backed collection loading reach feature parity.
    const source = resolved.endsWith('.json')
      ? new ExportedDatasetSource(resolved)
      : new AcqImageCollectionSource(resolved)
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
    [
      selectedAcqImageId,
      selectedChannel,
      selectedRoiId,
      selectedZ,
      selectedT,
      acqImageCollectionDocument,
    ],
    () => {
      if (!acqImageCollectionDocument.value) return
      if (!activeSource.value?.persistInUrl) {
        const url = new URL(window.location.href)
        for (const key of ['collection', 'acq_image', 'channel', 'roi', 'z', 't']) {
          url.searchParams.delete(key)
        }
        window.history.replaceState(null, '', url)
        return
      }
      window.history.replaceState(
        null,
        '',
        viewerUrl(window.location.href, {
          collection: acqImageCollectionDocument.value.url.href,
          acqImage: selectedAcqImageId.value,
          channel: selectedChannel.value,
          roi: selectedRoiId.value,
          z: selectedZ.value,
          t: selectedT.value,
        }),
      )
    },
    { flush: 'post' },
  )

  async function selectAcqImage(imageId: string | null): Promise<void> {
    if (
      imageId === selectedAcqImageId.value &&
      (acqImageDocument.value !== null || acqImageLoading.value)
    ) {
      return
    }
    selectionController?.abort()
    const controller = new AbortController()
    selectionController = controller
    const request = ++selectionRequest
    acqImageLoading.value = imageId !== null && acqImageCollectionDocument.value !== null
    selectedAcqImageId.value = imageId
    selectedChannel.value = 0
    selectedRoiId.value = null
    selectedZ.value = 0
    selectedT.value = 0
    acqImageDocument.value = null
    error.value = null
    if (imageId === null || acqImageCollectionDocument.value === null) {
      selectionController = null
      acqImageLoading.value = false
      return
    }
    const image = acqImageCollectionDocument.value.data.acq_images.find(
      (candidate) => candidate.id === imageId,
    )
    if (!image) {
      selectionController = null
      acqImageLoading.value = false
      error.value = `Unknown image ID: ${imageId}`
      return
    }
    loading.value = true
    try {
      if (!activeSource.value) throw new Error('No collection source is active')
      const source = activeSource.value
      const loaded = await source.loadAcqImage(
        acqImageCollectionDocument.value.url,
        image.href,
        controller.signal,
      )
      if (request !== selectionRequest || selectedAcqImageId.value !== imageId) return
      acqImageDocument.value = loaded
      if (loaded.data.load_state) {
        updateLoadState(imageId, loaded.data.load_state)
      }
      selectedRoiId.value = loaded.data.rois[0]?.id ?? null
    } catch (reason) {
      if (
        request === selectionRequest &&
        !(reason instanceof DOMException && reason.name === 'AbortError')
      ) {
        error.value = errorMessage(reason)
      }
    } finally {
      if (request === selectionRequest) {
        selectionController = null
        acqImageLoading.value = false
        loading.value = false
      }
    }
  }

  async function loadPlane(
    descriptor: PixelDescriptor,
    documentUrl: URL,
    indices: PlaneIndices,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    if (!activeSource.value) throw new Error('No collection source is active')
    const source = activeSource.value
    const imageId = acqImageDocument.value?.data.id
    if (!imageId) throw new Error('No image is selected')
    const key = [
      acqImageCollectionDocument.value?.url.href ?? '',
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
    if (!activeSource.value) throw new Error('No collection source is active')
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
        acqImageCollectionDocument.value = await activeSource.value.refreshCollection()
      } else {
        updateLoadState(imageId, { pixels: false, analysisCsv: false })
      }
    } catch (reason) {
      error.value = errorMessage(reason)
    } finally {
      loading.value = false
    }
  }

  async function closeAcqImageCollection(): Promise<void> {
    cancelSelectionRequest()
    const source = activeSource.value
    activeSource.value = null
    planeCache.clear()
    if (source) await source.close().catch(() => undefined)
    acqImageCollectionDocument.value = null
    acqImageDocument.value = null
    selectedAcqImageId.value = null
    hostedCollectionUrl.value = ''
    const url = new URL(window.location.href)
    for (const key of ['collection', 'acq_image', 'channel', 'roi', 'z', 't']) {
      url.searchParams.delete(key)
    }
    window.history.replaceState(null, '', url)
  }

  return {
    hostedCollectionUrl,
    serverUrl,
    acqImageCollectionDocument,
    acqImageDocument,
    selectedAcqImageId,
    selectedIndexImage,
    selectedChannel,
    selectedRoiId,
    selectedZ,
    selectedT,
    loading,
    acqImageLoading,
    error,
    canUnload,
    openAcqImageCollection,
    openServer,
    openExportedFolder,
    selectAcqImage,
    loadPlane,
    loadTable,
    unloadImage,
    closeAcqImageCollection,
  }
}
