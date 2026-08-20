/** A publicly hosted OME-Zarr sample collection. */
export interface SampleCollection {
  /** Stable identifier used by tests and UI controls. */
  id: string
  /** Short user-facing name. */
  name: string
  /** Summary of the analyses represented by the sample. */
  description: string
  /** HTTPS URL of the hosted OME-Zarr collection root. */
  url: string
}

/** Hosted sample collections served from Cloudflare R2. */
export const sampleCollections = [
  {
    id: 'diameter',
    name: 'Diameter sample',
    description: 'Diameter and summed-intensity analyses',
    url: 'https://data.mapmanager.net/samples/diameter-sample-data.ome.zarr/',
  },
  {
    id: 'velocity',
    name: 'Velocity sample',
    description: 'Radon-velocity and heart-rate analyses',
    url: 'https://data.mapmanager.net/samples/velocity-sample-data.ome.zarr/',
  },
  {
    id: 'two-channel',
    name: 'Two-channel sample',
    description: 'Two-channel kymographs',
    url: 'https://data.mapmanager.net/samples/two-channel-sample-data.ome.zarr/',
  },
] as const satisfies readonly SampleCollection[]

/** Default collection shown when no explicit or local development source is selected. */
export const defaultSampleCollection = sampleCollections[0]
