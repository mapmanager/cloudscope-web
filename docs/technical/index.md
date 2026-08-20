# Technical information

CloudScope Web is a Vue 3 and TypeScript single-page application that reads CloudScope-compatible OME-Zarr exports in the browser.

The primary responsibility boundary is:

```text
AcqStore
writes the CloudScope-compatible OME-Zarr export
        ↓
CloudScope Web
reads and displays that export
```

CloudScope App is an important [AcqStore](https://mapmanager.github.io/acqstore/) client, but it is not the only way to create data that can follow this path. Custom Python scripts and notebooks can use AcqStore directly.

## Related technical documentation

- [AcqStore documentation](https://mapmanager.github.io/acqstore/) — reproducible Python analysis and the canonical writer/export behavior.
- [Architecture](architecture.md) — browser application responsibilities and loading model.
- [Data format](data-format.md) — the current collection contract consumed by CloudScope Web.
- [Development](development.md) — installation, local development, testing, and production builds.
