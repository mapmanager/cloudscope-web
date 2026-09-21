# Data format

CloudScope Web consumes AcqStore OME-Zarr Collection v1. AcqStore owns the
writer, schema, validation, and format specification; this page only summarizes
the browser entry point.

## Collection discovery

For a collection root such as:

```text
https://example.org/my-dataset.ome.zarr/
```

CloudScope loads `acqstore/collection.json`. The document must declare
`format: acqstore-ome-zarr-collection` and `version: 1`. Each member explicitly
links its primary OME-Zarr image, `acqimage.json`, optional `analyses.json`, and
optional reference image.

## Authority boundaries

- OME-Zarr metadata owns pixels, shape, dimensions, axes, calibration, dtype,
  channels, and pyramid levels.
- `acqimage.json` owns AcqStore metadata and opaque-string ROI identities.
- `analyses.json` owns analysis instances and their CSV resources.
- `reference-image.json` owns reference-image metadata and scan paths.
- `collection.json` may advertise collection-level CSV tables for NicePool.

Member summaries are optional discovery hints and are not authoritative image
metadata. CloudScope validates collection-relative paths before following them.

See the [AcqStore documentation](https://mapmanager.github.io/acqstore/) for the
normative contract and export workflow.
