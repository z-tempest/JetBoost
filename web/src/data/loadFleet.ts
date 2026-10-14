import type { Aircraft } from "../types/fleet";

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
  const url = `${import.meta.env.BASE_URL}data/fleet.json`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to load demo fleet: ${res.status} (${url})`);
  return res.json();
}
