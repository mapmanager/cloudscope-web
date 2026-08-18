import type { ImagePlane } from './omeZarrLoader'
import type { Roi } from '../models/acqImageModels'

export interface DisplayPlane extends ImagePlane {
  sourceWidth: number
  sourceHeight: number
}

/**
 * Convert a selected source YX plane into CloudScope's display orientation.
 *
 * C, Z, and T have already been selected by the OME-Zarr loader. This operation
 * affects only the remaining raster plane: transpose YX, then flip the resulting
 * display Y axis. Display X therefore corresponds to source Y, while display Y
 * corresponds to reversed source X.
 */
export function orientYxPlaneForDisplay(plane: ImagePlane): DisplayPlane {
  const data = new Float64Array(plane.data.length)
  const displayWidth = plane.height
  const displayHeight = plane.width

  for (let sourceY = 0; sourceY < plane.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < plane.width; sourceX += 1) {
      const displayX = sourceY
      const displayY = plane.width - 1 - sourceX
      data[displayY * displayWidth + displayX] = Number(
        plane.data[sourceY * plane.width + sourceX],
      )
    }
  }

  return {
    ...plane,
    data,
    width: displayWidth,
    height: displayHeight,
    sourceWidth: plane.sourceHeight,
    sourceHeight: plane.sourceWidth,
    axes: { x: plane.axes.y, y: plane.axes.x },
  }
}

/** Map a full-resolution source ROI into the same display orientation as the plane. */
export function orientRoiForDisplay(roi: Roi, sourceWidth: number): Roi {
  if (roi.type === 'rect') {
    return {
      ...roi,
      x_start: roi.y_start,
      x_stop: roi.y_stop,
      y_start: sourceWidth - roi.x_stop,
      y_stop: sourceWidth - roi.x_start,
    }
  }

  return {
    ...roi,
    x0: roi.y0,
    y0: sourceWidth - 1 - roi.x0,
    x1: roi.y1,
    y1: sourceWidth - 1 - roi.x1,
  }
}
