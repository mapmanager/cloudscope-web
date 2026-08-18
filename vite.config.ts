import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import sirv from 'sirv'
import { defineConfig } from 'vitest/config'

const configuredLocalDatasetRoot = process.env.ACQSTORE_OME_ZARR_ROOT
const localDatasetRoot = path.resolve(
  configuredLocalDatasetRoot ?? path.resolve(import.meta.dirname, 'data/output'),
)

export default defineConfig({
  base: './',
  define: {
    __ACQSTORE_DEV_DATASET_CONFIGURED__: JSON.stringify(Boolean(configuredLocalDatasetRoot)),
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
})
