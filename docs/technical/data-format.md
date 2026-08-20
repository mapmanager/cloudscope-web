# Data format

CloudScope Web consumes the web-oriented OME-Zarr collection exported by AcqStore. The authoritative writer and export behavior belongs in AcqStore; CloudScope Web should document only the contract it needs in order to read that export.

See the [AcqStore documentation](https://mapmanager.github.io/acqstore/) for the Python analysis and export side of the workflow.

## Collection root

Given a collection root URL such as:

```text
https://example.org/my-dataset.ome.zarr/
```

CloudScope Web loads the collection manifest at:

```text
acqstore/acq_image_collection.json
```

The current loader requires the collection manifest to declare:

```text
format:      acqstore-acq-image-collection
version:     1
zarr_format: 3
```

The manifest also records the collection name, creation time, AcqStore version, image entries, and collection-level analysis-table paths.

## Image entries

Each collection entry has a stable image ID and summary information used to build the collection table. The current summary includes fields such as:

- image shape and dimensions
- data type
- channel count
- ROI count
- available analysis types
- acquisition date/time summary
- accepted state
- reference-image availability

Each entry also provides collection-relative paths to:

- the image's OME-Zarr group
- the per-image metadata JSON
- the image's native AcqStore manifest
- an optional reference image

CloudScope Web rejects absolute or parent-traversing paths in the collection manifest.

## Native image manifest

For each selected image, CloudScope Web currently requires the native AcqStore image manifest to declare:

```text
format:  acqstore-native-ome-zarr
version: 2
```

The native manifest identifies the image group, per-image metadata resource, optional reference image, and analysis resources associated with the image.

## ROIs and analyses

The per-image metadata contains the ROI definitions and analysis summaries exported by AcqStore. The current web client normalizes supported rectangular and line ROIs for display.

Analysis resources are matched using analysis name, channel, and ROI ID. When a registered plot is available for the analysis type, CloudScope Web loads the corresponding table and renders the plot.

## Version ownership

CloudScope Web validates the collection and native manifest versions it understands. If AcqStore changes the export contract, AcqStore remains the canonical source for the writer specification and migration/re-export instructions, while CloudScope Web should update its reader and this compatibility summary together.
