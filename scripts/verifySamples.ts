import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { sampleCollections } from '../src/config/sampleCollections.ts'

interface CollectionEntry {
  id: string
  ome_zarr_path: string
  manifest_path: string
  sidecar_path: string
  reference_image_path?: string
}

interface CollectionManifest {
  format: string
  version: number
  acq_images: CollectionEntry[]
  analysis_tables: Record<string, string>
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

async function verifyCollection(sample: (typeof sampleCollections)[number]): Promise<number> {
  const root = collectionPath(sample.url)
  const manifest = await loadJson<CollectionManifest>(
    path.join(root, 'acqstore', 'acq_image_collection.json'),
    `${sample.name} collection manifest`,
  )
  if (manifest.format !== 'acqstore-acq-image-collection' || manifest.version !== 1) {
    throw new Error(`${sample.name} is not an AcqImageCollection v1 OME-Zarr wrapper`)
  }
  await requireFile(path.join(root, 'zarr.json'), `${sample.name} root Zarr metadata`)

  for (const image of manifest.acq_images) {
    const imageRoot = path.join(root, image.ome_zarr_path)
    await requireFile(path.join(imageRoot, 'zarr.json'), `${sample.name}/${image.id} Zarr metadata`)
    await requireFile(path.join(root, image.sidecar_path), `${sample.name}/${image.id} sidecar`)

    const native = await loadJson<NativeManifest>(
      path.join(root, image.manifest_path),
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
  for (const [name, tablePath] of Object.entries(manifest.analysis_tables)) {
    await requireFile(path.join(root, tablePath), `${sample.name} ${name} collection table`)
  }
  return manifest.acq_images.length
}

async function main(): Promise<void> {
  const ids = new Set<string>()
  const urls = new Set<string>()
  for (const sample of sampleCollections) {
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
  for (const sample of sampleCollections) imageCount += await verifyCollection(sample)
  console.log(
    `Verified ${sampleCollections.length} sample collections containing ${imageCount} AcqImages.`,
  )
}

await main()
