# CloudScope Web

CloudScope Web is a static website for viewing CloudScope analysis datasets saved as OME-Zarr. To use CloudScope Web, there is nothing to install or run, just open it in a browser, open a dataset, and view it.

**Open CloudScope Web:** https://mapmanager.github.io/cloudscope-web/

**Documentation:** https://mapmanager.github.io/cloudscope-web/docs/

## CloudScope workflow

[CloudScope App](https://mapmanager.github.io/cloudscope-app/) is the macOS and Windows analysis application used to visualize and analyze imaging data, including while experiments are in progress and later during offline analysis. An analyzed dataset can be exported as OME-Zarr for viewing and sharing with CloudScope Web.

[AcqStore](https://mapmanager.github.io/acqstore/) provides the reproducible Python analysis used by CloudScope App and can also be used directly from scripts and notebooks. This makes it possible to create the same CloudScope-compatible exports outside the desktop application.

A typical workflow is:

```text
imaging data
    ↓
CloudScope App
visualize + analyze
    ↓
CloudScope analysis dataset
saved as OME-Zarr
    ↓
CloudScope Web
view + share + publish
```

AcqStore also supports a script- or notebook-based workflow:

```text
Python script / notebook
        ↓
      AcqStore
        ↓
CloudScope analysis dataset
saved as OME-Zarr
        ↓
   CloudScope Web
```

When publishing a figure analyzed with CloudScope, authors can publish the corresponding CloudScope analysis dataset and provide a CloudScope Web link so readers can inspect the underlying images and analyses interactively. OME-Zarr datasets can be hosted on suitable web storage or deposited with public scientific archives such as the [DANDI Archive](https://about.dandiarchive.org/), subject to the archive's current format and submission requirements.

See the [CloudScope Web documentation](https://mapmanager.github.io/cloudscope-web/docs/) for the end-user guide, sharing workflow, publishing guidance, and technical information.

## Development

CloudScope Web is implemented with Vue 3, TypeScript, and Vite.

Requirements for the web application:

- Node.js 22 or newer
- npm

Install the locked dependencies:

```bash
npm ci
```

Start the development site:

```bash
npm run dev
```

Run the application verification suite:

```bash
npm run check
```

Build the static application:

```bash
npm run build
```

Documentation uses MkDocs Material. Install the documentation dependencies with:

```bash
python3 -m pip install -r requirements-docs.txt
```

Then preview or build the documentation with:

```bash
npm run docs:serve
npm run docs:build
```

Developer details are maintained in the [technical documentation](https://mapmanager.github.io/cloudscope-web/docs/technical/).
