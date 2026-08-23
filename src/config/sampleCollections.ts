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
  /** Collection analysis table selected when the sample opens. */
  preferredAnalysisTable: string
}

/** Hosted sample collections served from Cloudflare R2. */
export const sampleCollections = [
  {
    id: 'diameter',
    name: 'Diameter sample',
    description: 'Diameter and summed-intensity analyses',
    url: 'https://data.mapmanager.net/samples/diameter-sample-data.ome.zarr/',
    preferredAnalysisTable: 'sum_intensity',
  },
  {
    id: 'velocity',
    name: 'Velocity sample',
    description: 'Radon-velocity and heart-rate analyses',
    url: 'https://data.mapmanager.net/samples/velocity-sample-data.ome.zarr/',
    preferredAnalysisTable: 'velocity',
  },
  {
    id: 'two-channel',
    name: 'Two-channel sample',
    description: 'Two-channel kymographs',
    url: 'https://data.mapmanager.net/samples/two-channel-sample-data.ome.zarr/',
    preferredAnalysisTable: 'velocity',
  },
] as const satisfies readonly SampleCollection[]

/** Default collection shown when no explicit or local development source is selected. */
export const defaultSampleCollection = sampleCollections[0]

/** Return a configured initial analysis table for a hosted sample URL. */
export function preferredAnalysisTableForUrl(url: string | URL): string | null {
  const href = new URL(url, window.location.href).href
  return (
    sampleCollections.find((sample) => new URL(sample.url).href === href)?.preferredAnalysisTable ??
    null
  )
}
