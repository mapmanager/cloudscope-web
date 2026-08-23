# Architecture

## Static browser application

CloudScope Web is a static Vue 3, TypeScript, and Vite application. In normal hosted use there is no CloudScope Web application server.

The browser loads the application and then fetches the published CloudScope OME-Zarr dataset directly from its host:

```text
CloudScope Web static site
        ↓ browser requests
published CloudScope OME-Zarr dataset
```

The application can therefore be deployed independently from the scientific data.

Chrome and Edge users can also grant read-only access to a local `.ome.zarr` directory. A fetch-compatible directory adapter resolves collection-relative paths through `FileSystemDirectoryHandle`; the manifest, CSV, and OME-Zarr parsers are shared with hosted loading. Zarrita requests metadata and chunks lazily through the same adapter. Local handles are session-only and are never serialized into the page URL.

## Collection-first loading

CloudScope Web starts by loading the AcqStore collection manifest. The collection manifest contains enough summary information to populate the collection table before the full resources for every image are loaded.

When the user selects an image, CloudScope Web resolves that image's native manifest, metadata, image data, ROIs, and analysis resources from the collection.

This keeps the collection overview lightweight and avoids loading all image pixels and analysis tables up front.

## Image data

Image planes are loaded from OME-Zarr through the browser using Zarrita and Numcodecs. The current application includes browser-side plane caching so previously requested image planes can be reused during a viewing session.

The raster viewer owns image interaction and display behavior, including channel-oriented viewing, ROI overlays, contrast/LUT controls, viewport interaction, and related image-viewer state.

The raster viewer code is shared with CloudScope Desktop, which helps keep core image interaction behavior consistent between the desktop and web viewers.

## Analysis resources

Analysis resources are associated with an analysis identity, image channel, and ROI. CloudScope Web loads analysis tables as needed and dispatches supported analysis types through its plot registry.

The current plot registry includes:

- `diameter`
- `sum_intensity`
- `radon_velocity`

CloudScope Web displays exported analysis results; it does not reproduce the Python analysis pipeline in JavaScript.

## URL state

Hosted collection sources are persisted in the browser URL along with primary selection state. The current state implementation serializes the collection URL and selection fields including the selected AcqImage, channel, ROI, and additional plane-selection state.

This provides the basis for copy-and-paste sharing links while keeping the application itself static.

## Optional local development server

Development builds expose optional AcqStore Server controls. These can open local files, folders, CSVs, or exported folders through the server at a configurable URL, defaulting to:

```text
http://127.0.0.1:8767
```

These controls are enabled only in Vite development mode and are hidden from the production static application.

CloudScope Web also supports mounting a local exported collection directly through the Vite development server with `ACQSTORE_OME_ZARR_ROOT`; this path does not require the production site to contain the dataset.
