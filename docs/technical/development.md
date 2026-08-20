# Development

## Requirements

CloudScope Web application development requires:

- Node.js 22 or newer
- npm

Documentation development additionally requires Python with the packages pinned in `requirements-docs.txt`.

## Install the web application

Install the locked npm dependencies:

```bash
npm ci
```

Start the Vite development server:

```bash
npm run dev
```

The default local URL is typically:

```text
http://localhost:5173/
```

## Open a local exported collection

A local CloudScope-compatible OME-Zarr collection can be exposed through the Vite development server:

```bash
ACQSTORE_OME_ZARR_ROOT=/absolute/path/to/collection.ome.zarr npm run dev
```

The development server mounts the configured directory at:

```text
/__dev_collection__/
```

Startup source priority is:

1. an explicit `collection` query parameter in the page URL
2. `ACQSTORE_OME_ZARR_ROOT` when running the Vite development server
3. the configured default hosted sample

## Optional AcqStore Server controls

Vite development mode also exposes optional controls for an AcqStore Server. The default server URL is:

```text
http://127.0.0.1:8767
```

The current development controls can request local file, folder, CSV, and exported-folder operations. These controls are hidden from the production build.

## Tests and quality checks

Run the test suite:

```bash
npm test
```

Run the complete application verification configured by the repository:

```bash
npm run check
```

The current npm configuration runs formatting checks, linting, sample verification, tests, type checking, the Vite production build, and final production-artifact verification.

## Production application build

Build the application with:

```bash
npm run build
```

Vite writes the static application to:

```text
dist/
```

The Vite configuration uses a relative base so the application can be deployed at a project path rather than requiring the web-server root.

Large OME-Zarr datasets are intentionally hosted separately from the application and should not be bundled into `dist/`.

## Documentation development

Install the pinned documentation dependencies:

```bash
python3 -m pip install -r requirements-docs.txt
```

Preview the documentation locally:

```bash
npm run docs:serve
```

By default MkDocs serves its preview on:

```text
http://127.0.0.1:8000/
```

Build the documentation with strict validation:

```bash
npm run docs:build
```

The MkDocs configuration writes documentation into:

```text
dist/docs/
```

The build order for a combined deployment is therefore important: build the Vite application first, then build MkDocs. A Vite production build recreates `dist/`, while MkDocs adds the documentation beneath the finished application tree.

## Running mkdocs locally

Follow this script to run mkdocs serve using local install Python

```
python3 -m venv .venv-docs
source .venv-docs/bin/activate
python -m pip install -r requirements-docs.txt

mkdocs serve
```

The docs site will then be available locally at:

```
http://127.0.0.1:8000/cloudscope-web/docs
```

## Source organization

Key source locations are:

- `src/components/` — Vue presentation components
- `src/composables/` — viewer orchestration and reactive state
- `src/config/` — application and hosted-sample configuration
- `src/data/` — data sources, format loaders, viewport helpers, and caching
- `src/models/` — collection, image, and serialized-manifest TypeScript contracts
- `src/plots/` — plot specifications and analysis registry
- `src/raster-viewer/` — shared raster-viewer implementation
- `tests/` — unit and component tests
- `docs/` — MkDocs documentation source

## Documentation deployment layout

The production deployment combines the two static outputs:

```text
dist/
├── index.html          # CloudScope Web application
├── assets/             # Vite application assets
└── docs/
    └── index.html      # MkDocs documentation
```

This produces the public layout:

```text
/cloudscope-web/        CloudScope Web application
/cloudscope-web/docs/   CloudScope Web documentation
```
