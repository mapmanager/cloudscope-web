import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CLOUDSCOPE_SAMPLE_CATALOG_URL } from '../src/data/sampleCatalog.ts'

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

async function main(): Promise<void> {
  if (CLOUDSCOPE_SAMPLE_CATALOG_URL !== 'https://data.mapmanager.net/cloudscope-web/samples.json') {
    throw new Error(`Unexpected sample catalog URL: ${CLOUDSCOPE_SAMPLE_CATALOG_URL}`)
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
    `Verified the R2-hosted sample catalog URL; no OME-Zarr samples are bundled in ${
      checkingDist ? 'dist' : 'public'
    }.`,
  )
}

await main()
