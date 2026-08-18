/** Numeric bounds shared by coordinated scientific views. */
export interface AxisRange {
  min: number
  max: number
}

/** Semantic coordinate shared by compatible views. */
export type AxisLinkGroup = 'time'

/** A linked range update; `null` requests the full automatic extent. */
export interface LinkedAxisUpdate {
  group: AxisLinkGroup
  range: AxisRange | null
}
