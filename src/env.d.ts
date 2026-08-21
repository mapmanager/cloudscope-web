/// <reference types="vite/client" />

/** True when the Vite process received `ACQSTORE_OME_ZARR_ROOT`. */
declare const __ACQSTORE_DEV_DATASET_CONFIGURED__: boolean

interface CloudScopeBuildInfoDefinition {
  version: string
  gitCommit: string | null
  gitBranch: string | null
  gitState: 'clean' | 'dirty' | null
  builtUtc: string | null
}

declare const __CLOUDSCOPE_BUILD_INFO__: CloudScopeBuildInfoDefinition
