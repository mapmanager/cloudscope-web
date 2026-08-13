import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import sirv from 'sirv'
import { defineConfig } from 'vitest/config'

const localDatasetRoot = path.resolve(import.meta.dirname, 'data/output')

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    {
      name: 'cloudscope-local-dataset',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(
          '/__dev_dataset__',
          sirv(localDatasetRoot, { dev: true, etag: true }),
        )
      },
    },
  ],
  test: {
    environment: 'jsdom',
  },
})
