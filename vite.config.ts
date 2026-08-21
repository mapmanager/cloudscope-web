import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import sirv from 'sirv'
import { defineConfig } from 'vitest/config'

interface PackageJson {
  version: string
}

function gitValue(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'),
) as PackageJson

const configuredLocalDatasetRoot = process.env.ACQSTORE_OME_ZARR_ROOT
const localDatasetRoot = path.resolve(
  configuredLocalDatasetRoot ?? path.resolve(import.meta.dirname, 'data/output'),
)

export default defineConfig(() => {
  const gitStatus = gitValue(['status', '--porcelain'])
  const buildInfo = {
    version: packageJson.version,
    gitCommit: gitValue(['rev-parse', 'HEAD']),
    gitBranch: process.env.GITHUB_REF_NAME || gitValue(['branch', '--show-current']) || null,
    gitState: gitStatus === null ? null : gitStatus ? 'dirty' : 'clean',
    builtEastern: new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'long',
      timeZone: 'America/New_York',
    }).format(new Date()),
  }

  return {
    base: './',
    define: {
      __ACQSTORE_DEV_DATASET_CONFIGURED__: JSON.stringify(Boolean(configuredLocalDatasetRoot)),
      __CLOUDSCOPE_BUILD_INFO__: JSON.stringify(buildInfo),
    },
    plugins: [
      vue(),
      {
        name: 'cloudscope-local-dataset',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use(
            '/__dev_collection__',
            sirv(localDatasetRoot, { dev: true, etag: true }),
          )
        },
      },
    ],
    test: {
      environment: 'jsdom',
    },
  }
})
