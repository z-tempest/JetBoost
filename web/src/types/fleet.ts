/** A unit's three real operational settings, already descaled to
 * physical units (altitude in feet, not the raw file's thousands-of-feet). */
export interface OpSettings {
  altitudeFt: number
  mach: number
  tra: number
}

/** Real CMAPSS sensor readings, keyed by their real short codes
 * (T2, Nf, Ps30, ...) -- see sensorMeta.ts for labels/units. */
export type SensorMap = Record<string, number>

export interface HistoryEntry {
  cycle: number
  opSettings: OpSettings
  sensors: SensorMap
  /** First principal component of the z-scored sensors (see fit_pca_pc1 in
   * prepare_fleet_data.py). Higher means further degraded. */
  pc1: number
  /** Cycles left before this test log ends (total cycles minus cycle),
   * taken from the raw file. Not a model prediction. */
  cyclesRemaining: number
}

export interface PathPoint {
  x: number
  y: number
  z: number
  cycle: number
}

export interface Aircraft {
  id: string
  nickname: string
  /** Per-cycle log, in order. "Now" is derived from this via getLiveEntry
   * (utils/liveCycle.ts) rather than stored, so every view agrees. */
  history: HistoryEntry[]
  flightPath: PathPoint[]
}

/** Health band. 'pending' means no prediction has arrived yet. */
export type HealthKey = 'critical' | 'warning' | 'healthy' | 'pending'

export interface HealthStatus {
  key: HealthKey
  label: string
  color: string
}

/** id -> predicted RUL (cycles) from the inference API. Undefined means not
 * predicted yet or the request failed. */
export type PredictionMap = Record<string, number | undefined>

export type SidebarMode = 'aircraft' | 'fleet' | null
