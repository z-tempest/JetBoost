import type { Aircraft, PredictionMap } from "../types/fleet";

const API_BASE = "https://zephyrntempest-jetboost-api.hf.space";
/**
 * Fetches the full fleet from a backend endpoint. Currently unused: the
 * app loads public/data/fleet.json via loadDemoFleet instead.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   The fleet.
 */
export async function fetchFleet(): Promise<Aircraft[]> {
  const res = await fetch(`${API_BASE}/fleet`);
  if (!res.ok) throw new Error(`Failed to load fleet: ${res.status}`);
  return res.json() as Promise<Aircraft[]>;
}

/**
 * Fetches a single aircraft/unit's full detail by id.
 *
 * Args:
 *   id: The aircraft id, e.g. "unit-3".
 *
 * Returns:
 *   The aircraft's full record, same shape as one entry from
 *   fetchFleet().
 */
export async function fetchAircraft(id: string): Promise<Aircraft> {
  const res = await fetch(`${API_BASE}/aircraft/${id}`);
  if (!res.ok) throw new Error(`Failed to load ${id}: ${res.status}`);
  return res.json() as Promise<Aircraft>;
}

/**
 * Converts an aircraft id ("unit-16") to the engine index the API expects (16).
 *
 * Args:
 *   aircraftId: The aircraft id, e.g. "unit-16".
 *
 * Returns:
 *   The engine index, e.g. 16.
 */
export function engineIndexFromId(aircraftId: string): number {
  return Number(aircraftId.replace(/^unit-/, ""));
}

/**
 * Fetches predicted RUL for a batch of engines, each at its own cycle
 * (GET /predict). target_idxs[i] and cycles[i] describe one engine, and the
 * response is in the same order. In dev, '/api' is proxied to
 * localhost:8000 by vite.config; set VITE_API_BASE to override.
 *
 * Args:
 *   requests: One { id, cycle } per engine to predict, where id is the
 *     aircraft id (e.g. "unit-16") and cycle is its time cycle. Each
 *     engine may appear at most once per call.
 *
 * Returns:
 *   A map of aircraft id -> predicted RUL (cycles, rounded to a whole
 *   number). Empty if requests is empty.
 */
export async function fetchPredictedRUL(
  requests: Array<{ id: string; cycle: number }>,
): Promise<PredictionMap> {
  if (requests.length === 0) return {};

  const params = new URLSearchParams();
  requests.forEach((r) =>
    params.append("target_idxs", String(engineIndexFromId(r.id))),
  );
  requests.forEach((r) => params.append("cycles", String(r.cycle)));

  const res = await fetch(`${API_BASE}/predict?${params.toString()}`);
  if (!res.ok) throw new Error(`Prediction request failed: ${res.status}`);

  const body = (await res.json()) as { "Predicted RUL": number[] };
  const values = body["Predicted RUL"];
  if (!Array.isArray(values) || values.length !== requests.length) {
    throw new Error("Prediction response did not match the request");
  }

  const result: PredictionMap = {};
  requests.forEach((r, i) => {
    result[r.id] = Math.round(values[i]);
  });
  return result;
}
