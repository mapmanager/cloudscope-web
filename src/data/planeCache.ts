import type { ImagePlane } from './omeZarrLoader'

export interface PlaneCacheOptions {
  maxBytes: number
  maxEntries: number
}

export const DEFAULT_PLANE_CACHE_OPTIONS: PlaneCacheOptions = {
  maxBytes: 256 * 1024 * 1024,
  maxEntries: 64,
}

interface CacheEntry {
  imageId: string
  plane: ImagePlane
  bytes: number
}

interface PendingEntry {
  imageId: string
  promise: Promise<ImagePlane>
}

function planeBytes(plane: ImagePlane): number {
  const data = plane.data
  return ArrayBuffer.isView(data) ? data.byteLength : data.length * 8
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export class PlaneCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly pending = new Map<string, PendingEntry>()
  private bytes = 0

  constructor(private readonly options: PlaneCacheOptions = DEFAULT_PLANE_CACHE_OPTIONS) {
    if (options.maxBytes < 0 || options.maxEntries < 0) {
      throw new RangeError('Plane cache limits must be non-negative')
    }
  }

  get size(): number {
    return this.entries.size
  }

  get byteLength(): number {
    return this.bytes
  }

  getOrLoad(
    key: string,
    imageId: string,
    loader: () => Promise<ImagePlane>,
    signal?: AbortSignal,
  ): Promise<ImagePlane> {
    const cached = this.entries.get(key)
    if (cached) {
      this.entries.delete(key)
      this.entries.set(key, cached)
      return withAbort(Promise.resolve(cached.plane), signal)
    }
    let pending = this.pending.get(key)
    if (!pending) {
      const request = loader().then((plane) => {
        if (this.pending.get(key)?.promise === request) {
          this.pending.delete(key)
          this.insert(key, { imageId, plane, bytes: planeBytes(plane) })
        }
        return plane
      })
      request.catch(() => {
        if (this.pending.get(key)?.promise === request) this.pending.delete(key)
      })
      pending = { imageId, promise: request }
      this.pending.set(key, pending)
    }
    return withAbort(pending.promise, signal)
  }

  invalidateImage(imageId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.imageId === imageId) this.remove(key, entry)
    }
    for (const [key, entry] of this.pending) {
      if (entry.imageId === imageId) this.pending.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
    this.pending.clear()
    this.bytes = 0
  }

  private insert(key: string, entry: CacheEntry): void {
    if (
      this.options.maxEntries === 0 ||
      this.options.maxBytes === 0 ||
      entry.bytes > this.options.maxBytes
    ) {
      return
    }
    this.entries.set(key, entry)
    this.bytes += entry.bytes
    while (
      this.entries.size > this.options.maxEntries ||
      this.bytes > this.options.maxBytes
    ) {
      const oldest = this.entries.entries().next().value as [string, CacheEntry] | undefined
      if (!oldest) break
      this.remove(oldest[0], oldest[1])
    }
  }

  private remove(key: string, entry: CacheEntry): void {
    this.entries.delete(key)
    this.bytes -= entry.bytes
  }
}
