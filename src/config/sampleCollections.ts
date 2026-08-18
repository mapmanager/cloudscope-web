/** A bundled, publicly deployable OME-Zarr collection. */
export interface SampleCollection {
  /** Stable identifier used by tests and UI controls. */
  id: string
  /** Short user-facing name. */
  name: string
  /** Summary of the analyses represented by the sample. */
  description: string
  /** Site-relative collection root; safe under a GitHub Pages project path. */
  url: string
}

/** Bundled samples copied from `public/` into every production build. */
export const sampleCollections = [
  {
    id: 'diameter',
    name: 'Diameter sample',
    description: 'Diameter and summed-intensity analyses',
    url: './samples/diameter-sample-data.ome.zarr/',
  },
  {
    id: 'velocity',
    name: 'Velocity sample',
    description: 'Radon-velocity and heart-rate analyses',
    url: './samples/velocity-sample-data.ome.zarr/',
  },
] as const satisfies readonly SampleCollection[]

/** Default collection shown when no explicit or local development source is selected. */
export const defaultSampleCollection = sampleCollections[0]
