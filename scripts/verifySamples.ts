import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { sampleDatasets } from '../src/config/sampleDatasets.ts'

interface CollectionEntry {
  id: string
  path: string
  native_manifest: string
  sidecar: string
  reference_image?: string
}

interface CollectionManifest {
  format: string
  version: number
  images: CollectionEntry[]
}

interface NativeManifest {
  format: string
  version: number
  image_group: string
  sidecar: string
  reference_image?: string
  analyses: Array<{
    id: string
    resources: { table: string | null; peaks: string | null }
  }>
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteRoot = path.resolve(projectRoot, process.argv.includes('--dist') ? 'dist' : 'public')

async function requireFile(filePath: string, label: string): Promise<void> {
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile())
    throw new Error(`${label} is missing: ${path.relative(projectRoot, filePath)}`)
}

async function loadJson<T>(filePath: string, label: string): Promise<T> {
  await requireFile(filePath, label)
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${path.relative(projectRoot, filePath)}`, {
      cause: error,
    })
  }
}

async function findUnwantedFiles(root: string): Promise<string[]> {
  const unwanted: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.name === '.DS_Store') unwanted.push(entryPath)
    else if (entry.isDirectory()) unwanted.push(...(await findUnwantedFiles(entryPath)))
  }
  return unwanted
}

function collectionPath(sampleUrl: string): string {
  if (!sampleUrl.startsWith('./samples/') || !sampleUrl.endsWith('/')) {
    throw new Error(`Sample URL must be site-relative and end in '/': ${sampleUrl}`)
  }
  const resolved = path.resolve(siteRoot, sampleUrl.slice(2))
  if (!resolved.startsWith(`${siteRoot}${path.sep}`)) {
    throw new Error(`Sample URL escapes the site root: ${sampleUrl}`)
  }
  return resolved
}

async function verifyCollection(sample: (typeof sampleDatasets)[number]): Promise<number> {
  const root = collectionPath(sample.url)
  const manifest = await loadJson<CollectionManifest>(
    path.join(root, 'acqstore', 'manifest.json'),
    `${sample.name} collection manifest`,
  )
  if (manifest.format !== 'acqstore-multi-image-ome-zarr' || manifest.version !== 2) {
    throw new Error(`${sample.name} is not an AcqStore multi-image OME-Zarr v2 collection`)
  }
  await requireFile(path.join(root, 'zarr.json'), `${sample.name} root Zarr metadata`)

  for (const image of manifest.images) {
    const imageRoot = path.join(root, image.path)
    await requireFile(path.join(imageRoot, 'zarr.json'), `${sample.name}/${image.id} Zarr metadata`)
    await requireFile(path.join(root, image.sidecar), `${sample.name}/${image.id} sidecar`)

    const native = await loadJson<NativeManifest>(
      path.join(root, image.native_manifest),
      `${sample.name}/${image.id} native manifest`,
    )
    if (native.format !== 'acqstore-native-ome-zarr' || native.version !== 2) {
      throw new Error(`${sample.name}/${image.id} is not an AcqStore native OME-Zarr v2 image`)
    }
    await requireFile(
      path.join(imageRoot, native.sidecar),
      `${sample.name}/${image.id} native sidecar`,
    )
    if (native.reference_image) {
      await requireFile(
        path.join(imageRoot, native.reference_image, 'zarr.json'),
        `${sample.name}/${image.id} reference-image metadata`,
      )
    }
    for (const analysis of native.analyses) {
      for (const [resourceName, resourcePath] of Object.entries(analysis.resources)) {
        if (resourcePath) {
          await requireFile(
            path.join(imageRoot, resourcePath),
            `${sample.name}/${image.id}/${analysis.id} ${resourceName}`,
          )
        }
      }
    }
  }
  return manifest.images.length
}

async function main(): Promise<void> {
  const ids = new Set<string>()
  const urls = new Set<string>()
  for (const sample of sampleDatasets) {
    if (ids.has(sample.id)) throw new Error(`Duplicate sample ID: ${sample.id}`)
    if (urls.has(sample.url)) throw new Error(`Duplicate sample URL: ${sample.url}`)
    ids.add(sample.id)
    urls.add(sample.url)
  }

  const unwanted = await findUnwantedFiles(path.join(siteRoot, 'samples'))
  if (unwanted.length) {
    throw new Error(
      `Published samples contain unwanted files:\n${unwanted
        .map((filePath) => `- ${path.relative(projectRoot, filePath)}`)
        .join('\n')}`,
    )
  }

  let imageCount = 0
  for (const sample of sampleDatasets) imageCount += await verifyCollection(sample)
  console.log(
    `Verified ${sampleDatasets.length} sample collections containing ${imageCount} images.`,
  )
}

await main()
