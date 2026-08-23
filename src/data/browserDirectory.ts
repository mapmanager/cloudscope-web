/** Fetch-compatible function used by URL and browser-directory resources. */
export type ResourceFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | string
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}

/** Return whether this browser exposes the user-mediated directory picker. */
export function browserDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** Ask the user to grant read-only access to one local collection directory. */
export function pickCollectionDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!browserDirectoryPickerSupported()) {
    return Promise.reject(
      new Error('Opening local OME-Zarr directories requires Chrome or Edge.'),
    )
  }
  return (window as unknown as DirectoryPickerWindow).showDirectoryPicker({
    id: 'cloudscope-ome-zarr',
    mode: 'read',
  })
}

function isNotFound(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'NotFoundError'
}

async function fileAt(
  root: FileSystemDirectoryHandle,
  segments: readonly string[],
): Promise<File> {
  if (segments.length === 0) throw new DOMException('File path is empty', 'NotFoundError')
  let directory = root
  for (const segment of segments.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(segment)
  }
  return (await directory.getFileHandle(segments.at(-1)!)).getFile()
}

function requestedRange(request: Request, size: number): [number, number] | null {
  const header = request.headers.get('range')
  if (!header) return null
  const match = /^bytes=(\d+)-(\d*)$/.exec(header)
  if (!match) return null
  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start >= size) return null
  return [start, Math.min(requestedEnd, size - 1)]
}

/** Adapt one granted directory handle to the Fetch API used by CloudScope loaders. */
export function createDirectoryFetch(
  root: FileSystemDirectoryHandle,
  baseUrl: URL,
): ResourceFetch {
  const basePath = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`
  return async (input, init) => {
    const request = new Request(input, init)
    if (request.signal.aborted) throw new DOMException('The request was aborted', 'AbortError')
    const url = new URL(request.url)
    if (url.origin !== baseUrl.origin || !url.pathname.startsWith(basePath)) {
      return new Response('Resource is outside the selected collection', { status: 403 })
    }
    const relative = url.pathname.slice(basePath.length)
    let segments: string[]
    try {
      segments = relative.split('/').filter(Boolean).map(decodeURIComponent)
    } catch {
      return new Response('Resource path is not valid URL encoding', { status: 400 })
    }
    if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('/'))) {
      return new Response('Resource path is not collection-relative', { status: 400 })
    }
    try {
      const file = await fileAt(root, segments)
      if (request.signal.aborted) throw new DOMException('The request was aborted', 'AbortError')
      const range = requestedRange(request, file.size)
      if (!range) return new Response(await file.arrayBuffer(), { status: 200 })
      const [start, end] = range
      return new Response(await file.slice(start, end + 1).arrayBuffer(), {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${file.size}`,
        },
      })
    } catch (reason) {
      if (isNotFound(reason)) return new Response('Resource not found', { status: 404 })
      throw reason
    }
  }
}
