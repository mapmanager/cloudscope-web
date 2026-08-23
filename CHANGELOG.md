# Changelog

Notable user-facing changes to CloudScope Web are documented here.

The site is deployed from `main`. Dates below represent deployment dates rather
than tagged releases. Pending changes remain under `Unreleased` until they are
deployed.

## Unreleased

### Added

- Added a collapsible, resizable NicePool panel for exploring collection-level analysis tables.

### Changed

- Deduplicated the Plotly runtime shared by CloudScope Web and NicePool in production builds.
- Reordered the left toolbar into file, metadata, reference-image, and application-information workflow order.
- Expanded the App Information panel with a project description, documentation links, and contact information.

## 2026-08-21

### Fixed

- Recognized AcqStore `linesegmentroi` records when loading primary-image line ROIs.

### Changed

- Documented the AcqStore producer contract that should be consulted when changing OME-Zarr loading behavior.

## 2026-08-20

### Added

- Added an independent Reference Image viewer with multichannel display and an optional scan-path overlay.
- Added left-toolbar panels for the collection file table and application build information.
- Added the CloudScope Web documentation site.

### Changed

- Moved deployable sample collections to Cloudflare R2 instead of bundling large OME-Zarr stores with the site.
- Added a resizable left inspector and improved toolbar labels and tooltips.

## 2026-08-19

### Added

- Integrated the browser-native raster viewer with multichannel contrast, ROI selection, zoom, and pan controls.
- Added two-channel sample support and channel-aware viewer controls.

### Changed

- Improved the main image, analysis, and file-table layout, including collapsible and resizable sections.
- Reduced visual flashing while switching between acquisition images.

## 2026-08-18

### Changed

- Adopted the AcqStore AcqImageCollection OME-Zarr format for collection loading.
- Linked compatible axes across image and analysis views.
- Added automated checks and deployment workflow support.

## 2026-08-15

### Added

- Added lazy image and analysis-resource loading with explicit cache lifecycle controls.
- Added shared loading support for static web collections and AcqStore Server development sources.
