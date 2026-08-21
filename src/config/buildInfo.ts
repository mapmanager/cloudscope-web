import { ACQ_IMAGE_COLLECTION_VERSION } from '../models/acqImageCollectionManifest'

export const buildInfo = __CLOUDSCOPE_BUILD_INFO__

export const appInformation: Record<string, unknown> = {
  App: 'CloudScope Web',
  Version: buildInfo.version,
  ...(buildInfo.gitCommit ? { 'Git commit': buildInfo.gitCommit } : {}),
  ...(buildInfo.gitBranch ? { 'Git branch': buildInfo.gitBranch } : {}),
  ...(buildInfo.gitState ? { 'Git state': buildInfo.gitState } : {}),
  ...(buildInfo.builtEastern ? { 'Built (New York)': buildInfo.builtEastern } : {}),
  'AcqStore OME-Zarr collection version': ACQ_IMAGE_COLLECTION_VERSION,
}
