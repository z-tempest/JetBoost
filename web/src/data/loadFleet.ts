import type { Aircraft } from '../types/fleet'

/**
 * Loads the fleet: CMAPSS op settings and sensor data preprocessed by
 * src/scripts/prepare_fleet_data.py into public/data/fleet.json.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Promise<Aircraft[]>: The fleet.
 */
export async function loadDemoFleet(): Promise<Aircraft[]> {
  const res = await fetch('/data/fleet.json')
  if (!res.ok) throw new Error(`Failed to load demo fleet: ${res.status}`)
  return res.json()
}
