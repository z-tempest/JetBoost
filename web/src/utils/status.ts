import type { HealthKey, HealthStatus } from '../types/fleet'

interface Band {
  max: number
  color: string
  label: string
}

/** RUL bands that color paths, markers, and badges. Separate from the fleet
 * panel's at-risk threshold, which only filters its list. */
const BANDS: Record<Exclude<HealthKey, 'pending'>, Band> = {
  critical: { max: 35, color: '#FF3B30', label: 'Critical' },
  warning: { max: 60, color: '#FF9F0A', label: 'Warning' },
  healthy: { max: Infinity, color: '#34C759', label: 'Healthy' },
}

/** Color/label shown while a prediction hasn't come back from the API yet. */
const PENDING: HealthStatus = { key: 'pending', label: 'Predicting…', color: '#8E8E93' }

/**
 * Classifies a predicted RUL value into a health band.
 *
 * Args:
 *   predictedRul: The model's predicted remaining useful life, in
 *     cycles, or undefined if a prediction hasn't arrived yet (see
 *     usePredictions.ts).
 *
 * Returns:
 *   The matching band as { key, label, color }, or the neutral
 *   "pending" status when predictedRul is undefined.
 */
export function getHealthStatus(predictedRul: number | undefined): HealthStatus {
  if (predictedRul === undefined) return PENDING
  if (predictedRul <= BANDS.critical.max) {
    return { key: 'critical', label: BANDS.critical.label, color: BANDS.critical.color }
  }
  if (predictedRul <= BANDS.warning.max) {
    return { key: 'warning', label: BANDS.warning.label, color: BANDS.warning.color }
  }
  return { key: 'healthy', label: BANDS.healthy.label, color: BANDS.healthy.color }
}
