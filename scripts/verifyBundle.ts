import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsRoot = path.join(projectRoot, 'dist', 'assets')

async function main(): Promise<void> {
  const assets = await readdir(assetsRoot)
  const plotlyBundles = assets.filter((name) => name.startsWith('plotly') && name.endsWith('.js'))

  if (plotlyBundles.length !== 1) {
    throw new Error(
      `Expected exactly one Plotly production bundle, found ${plotlyBundles.length}: ${plotlyBundles.join(', ') || 'none'}`,
    )
  }

  console.log(`Verified one shared Plotly production bundle: ${plotlyBundles[0]}`)
}

await main()
