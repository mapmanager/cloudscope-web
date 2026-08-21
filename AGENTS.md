# CloudScope Web — Agent Instructions

## Repository role

`cloudscope-web` is an independent Vue 3 and TypeScript single-page viewer for
AcqStore AcqImageCollection OME-Zarr stores. It must remain buildable as a static site. A
Python runtime or AcqStore Server may enhance local development, but neither is
required to use the production viewer.

Do not confuse this repository with the sibling `cloudscope-app` Python/NiceGUI
application. If a request names `cloudscope-app` while discussing this viewer,
confirm whether the user meant `cloudscope-web` before inspecting or editing
the sibling repository.

## Source of truth and scope

- The live repository is the source of truth. Archives under `zips/` are not
  authoritative unless the user explicitly says otherwise.
- Work only in `cloudscope-web` unless the user explicitly authorizes a
  cross-repository task.
- Do not rename AcqStore domain concepts or change the exported OME-Zarr layout
  without an explicit schema and compatibility decision.

## AcqStore export contract

CloudScope Web consumes the AcqStore-owned OME-Zarr collection format. Before
adding or changing OME-Zarr loading behavior, consult the producer contract in
the sibling AcqStore repository:

- `../acqstore/docs/ome-zarr-export-format.md`
- `../acqstore/src/acqstore/acq_image/io/export_schema/acqstore_ome_zarr_contract.schema.json`

Treat AcqStore as the producer source of truth. Do not infer serialized field
names or relationships from sample data alone, and do not redefine the export
contract in CloudScope Web. If the sibling repository is unavailable, ask for
the producer contract rather than guessing.

This is a development-time reference only. CloudScope Web must remain
independent at runtime: do not import AcqStore, require Python, copy the schema
into this repository, or fetch the schema in the production viewer.

## Data boundaries

- `public/samples/` contains intentionally public, deployable OME-Zarr samples.
  Vite copies them into the production site.
- `data/` is for private, temporary, or large local datasets and remains
  ignored by Git.
- Inspect metadata before adding a sample to `public/samples/`; GitHub Pages is
  public even when some repository plans permit private source repositories.
- Never commit `.DS_Store` or other operating-system metadata.
- Register every bundled sample in `src/config/sampleCollections.ts` and run
  `npm run verify:samples` after changing a sample or catalog entry.

## Static-hosting invariants

- Production must work from Vite's `dist/` directory without a running server.
- Keep public asset and sample URLs relative to the deployed site base.
- `ACQSTORE_OME_ZARR_ROOT` and `/__dev_collection__/` are development-only.
- Preserve hosted OME-Zarr URL loading. Cross-origin hosts must provide CORS.
- AcqStore Server controls are development-only until production access is
  deliberately designed and verified.

## TypeScript and Vue conventions

- Keep Vue components focused on presentation and user intent.
- Keep transport and format logic in `src/data/`, domain contracts in
  `src/models/`, sample configuration in `src/config/`, and plot definitions in
  `src/plots/`.
- Use explicit TypeScript types at public boundaries.
- Use TSDoc-compatible `/** ... */` comments for exported APIs and non-obvious
  contracts. Prefer `@param`, `@returns`, and `@throws` where they add useful
  information; do not restate obvious types.
- Use `AcqImageCollection` for the domain/serialized multi-image collection,
  `AcqImage` for one member, and `dataset` only where a legacy transport or the
  OME-NGFF specification uses that term.
- Preserve the distinction between an `AcqImageCollection`, its additive
  AcqStore wrapper metadata, each unchanged native child OME-Zarr image, and
  an active viewer/data-source session.
- Format with Prettier and lint with ESLint. Do not make broad formatting-only
  changes outside the task's scope.

## Verification

Match verification to the change. Before handing off deployment-related work,
run the same check used by the pre-push hook and GitHub Actions:

```bash
npm run check
```

For GUI changes, also serve the production build and inspect the real browser
flow. Unit tests alone do not prove that images or Plotly charts render.

Do not weaken tests to make a change pass. Report any verification that could
not be completed.
