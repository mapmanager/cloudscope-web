import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { sampleCollections } from '../src/config/sampleCollections.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkingDist = process.argv.includes('--dist')
const siteRoot = path.resolve(projectRoot, checkingDist ? 'dist' : 'public')

async function findBundledOmeZarr(root: string): Promise<string[]> {
  const found: string[] = []

  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return found
    throw error
  }

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)

    if (entry.isDirectory() && entry.name.endsWith('.ome.zarr')) {
      found.push(entryPath)
      continue
    }

    if (entry.isDirectory()) {
      found.push(...(await findBundledOmeZarr(entryPath)))
    }
  }

  return found
}

function verifySampleUrl(sample: (typeof sampleCollections)[number]): void {
  let url: URL

  try {
    url = new URL(sample.url)
  } catch {
    throw new Error(`${sample.name} has an invalid URL: ${sample.url}`)
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${sample.name} URL must use HTTPS: ${sample.url}`)
  }

  if (url.hostname !== 'data.mapmanager.net') {
    throw new Error(`${sample.name} URL must be hosted at data.mapmanager.net: ${sample.url}`)
  }

  if (!url.pathname.endsWith('.ome.zarr/')) {
    throw new Error(`${sample.name} URL must end in '.ome.zarr/': ${sample.url}`)
  }
}

async function main(): Promise<void> {
  const ids = new Set<string>()
  const urls = new Set<string>()

  for (const sample of sampleCollections) {
    if (ids.has(sample.id)) throw new Error(`Duplicate sample ID: ${sample.id}`)
    if (urls.has(sample.url)) throw new Error(`Duplicate sample URL: ${sample.url}`)

    ids.add(sample.id)
    urls.add(sample.url)

    verifySampleUrl(sample)
  }

  const bundledSamples = await findBundledOmeZarr(path.join(siteRoot, 'samples'))

  if (bundledSamples.length) {
    throw new Error(
      `OME-Zarr samples must be hosted on Cloudflare R2, not bundled in ${
        checkingDist ? 'dist' : 'public'
      }:\n${bundledSamples
        .map((filePath) => `- ${path.relative(projectRoot, filePath)}`)
        .join('\n')}`,
    )
  }

  console.log(
    `Verified ${sampleCollections.length} R2-hosted sample collection URLs; no OME-Zarr samples are bundled in ${
      checkingDist ? 'dist' : 'public'
    }.`,
  )
}

await main()
