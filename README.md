# CloudScope Web

CloudScope Web is a Vue 3 and TypeScript single-page viewer for AcqStore
multi-image OME-Zarr collections. It displays a collection table, the selected
acquisition image, ROIs, and registered analysis plots.

The production application is static: it can be hosted by GitHub Pages or any
ordinary HTTP file server. AcqStore Server is optional and used only by local
development controls.

## Requirements

- Node.js 22 or newer
- npm

Install the locked dependencies:

```bash
npm ci
```

## Local development

Start the viewer with its bundled diameter sample:

```bash
npm run dev
```

To expose a local exported collection through Vite's development server:

```bash
ACQSTORE_OME_ZARR_ROOT=/absolute/path/to/collection.ome.zarr npm run dev
```

An explicit `?dataset=...` query parameter has highest startup priority. When
the environment variable is set, the local development collection is next;
otherwise the bundled diameter sample opens automatically.

The development UI also exposes optional controls for an AcqStore Server at
`http://127.0.0.1:8767`. Those controls are hidden from production builds.

## Bundled public samples

Deployable samples live under `public/samples/` and are registered in
`src/config/sampleDatasets.ts`. Vite copies the directory to `dist/samples/`.

`data/` remains ignored and is reserved for private, temporary, or large local
datasets. Before publishing a new sample, inspect its manifests and sidecars
for sensitive source metadata.

Verify the catalog and every referenced sample resource:

```bash
npm run verify:samples
```

## Quality checks

```bash
npm run format:check
npm run lint
npm run verify:samples
npm test
```

## Production build

Build the static site and verify the resulting artifact:

```bash
npm run build
npm run verify:dist
```

Serve `dist/` through HTTP when testing it locally. Opening `dist/index.html`
directly with a `file://` URL is not a supported deployment mode.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` checks, builds, and deploys the
contents of `dist/` whenever the default branch is pushed, or when it is run
manually. In the GitHub repository settings, select **GitHub Actions** as the
Pages build source.

The Vite configuration uses a relative base so the site works at a project URL
such as `https://USER.github.io/cloudscope-web/`.

## Source organization

- `src/components/`: Vue presentation components
- `src/composables/`: viewer orchestration and reactive state
- `src/config/`: bundled-site configuration
- `src/data/`: data sources, format loaders, and caching
- `src/models/`: browser-side data contracts
- `src/plots/`: plot specifications and analysis registry
- `tests/`: unit and component tests
- `public/samples/`: public OME-Zarr samples included in production
