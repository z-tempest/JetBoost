import { formatOpSetting } from '../data/sensorMeta'
import type { OpSettings } from '../types/fleet'

/**
 * Bin sizes for rounding op settings into operating conditions. Raw settings
 * carry measurement noise around each setpoint, so rounding collapses them
 * into a few distinct clusters (like grouping by the unique rounded
 * Setting1-3 triples in EDA). altitudeFt is Setting1 * 1000, so 1000 ft
 * equals rounding Setting1 to the nearest kft.
 */
const ALTITUDE_BIN_FT = 1000
const MACH_DECIMALS = 2
const TRA_BIN = 1

export interface OperatingCondition {
  /** Stable key, usable as a React key or chart series id. */
  key: string
  /** Human-readable label built from this condition's rounded settings,
   * e.g. "20,000 ft \u00b7 M0.62 \u00b7 TRA 60.0". */
  label: string
  /** The rounded settings. */
  rounded: OpSettings
}

/**
 * Rounds one op-settings reading down to its condition bucket.
 *
 * Args:
 *   op: A real (noisy) op-settings reading.
 *
 * Returns:
 *   The same shape, rounded to the bin sizes above.
 */
function roundToCondition(op: OpSettings): OpSettings {
  return {
    altitudeFt: Math.round(op.altitudeFt / ALTITUDE_BIN_FT) * ALTITUDE_BIN_FT,
    mach: Math.round(op.mach * 10 ** MACH_DECIMALS) / 10 ** MACH_DECIMALS,
    tra: Math.round(op.tra / TRA_BIN) * TRA_BIN,
  }
}

/**
 * A stable string key for a (rounded) op-settings condition, safe to
 * use for grouping/deduping.
 *
 * Args:
 *   rounded: An already-rounded op-settings reading (see
 *     roundToCondition).
 *
 * Returns:
 *   A key like "20000|0.62|60".
 */
function keyOf(rounded: OpSettings): string {
  return `${rounded.altitudeFt}|${rounded.mach}|${rounded.tra}`
}

/**
 * Which rounded condition a reading falls into. detectConditions uses the
 * same rounding, so the two always agree.
 *
 * Args:
 *   op: A real op-settings reading.
 *
 * Returns:
 *   That reading's condition key.
 */
export function conditionKeyFor(op: OpSettings): string {
  return keyOf(roundToCondition(op))
}

/**
 * Finds every distinct operating condition across a fleet's full history (not
 * just what's live so far), so the fleet chart can be split into one subplot
 * per condition. The count isn't hardcoded: FD001/FD003 have one condition,
 * FD002/FD004 have six.
 *
 * Args:
 *   fleet: The fleet, each aircraft's full history scanned.
 *
 * Returns:
 *   Conditions sorted by altitude, then Mach, then TRA.
 */
export function detectConditions(fleet: Array<{ history: Array<{ opSettings: OpSettings }> }>): OperatingCondition[] {
  const seen = new Map<string, OpSettings>()
  for (const aircraft of fleet) {
    for (const entry of aircraft.history) {
      const rounded = roundToCondition(entry.opSettings)
      const key = keyOf(rounded)
      if (!seen.has(key)) seen.set(key, rounded)
    }
  }

  return Array.from(seen.entries())
    .sort(([, a], [, b]) => a.altitudeFt - b.altitudeFt || a.mach - b.mach || a.tra - b.tra)
    .map(([key, rounded]) => ({
      key,
      label: `${formatOpSetting('altitudeFt', rounded.altitudeFt)} \u00b7 M${rounded.mach.toFixed(MACH_DECIMALS)} \u00b7 TRA ${formatOpSetting('tra', rounded.tra)}`,
      rounded,
    }))
}
