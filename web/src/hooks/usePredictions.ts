import { useEffect, useRef, useState } from 'react'
import { fetchPredictedRUL } from '../api/client'
import { LIVE_DATA_UPDATE_MS } from '../utils/liveCycle'
import type { Aircraft, HistoryEntry, PredictionMap } from '../types/fleet'

interface UsePredictionsResult {
  /** id -> predicted RUL (cycles) at the aircraft's current cycle.
   * Missing means no prediction yet (rendered as "pending"). */
  predictions: PredictionMap
  isLoading: boolean
  /** Last request error's message, if any. Existing predictions are kept. */
  error: string | null
}

/**
 * Owns the fleet's predicted-RUL state.
 *
 * Every LIVE_DATA_UPDATE_MS, batches the aircraft whose current cycle has
 * no prediction yet into one inference request (see fetchPredictedRUL).
 * Results are cached by (aircraft, cycle), so no cycle is requested twice
 * and out-of-order responses can't overwrite newer ones. While a new
 * prediction is in flight, an aircraft keeps its previous value.
 *
 * Args:
 *   fleet: The current fleet, or null while it's still loading.
 *   liveEntries: id -> each aircraft's current live history entry
 *     (from App, kept fresh by MapView's onLiveUpdate).
 *
 * Returns:
 *   predictions, isLoading, and error.
 */
export function usePredictions(
  fleet: Aircraft[] | null,
  liveEntries: Record<string, HistoryEntry>,
): UsePredictionsResult {
  const [predictions, setPredictions] = useState<PredictionMap>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Latest live entries, read by the interval below without restarting it.
  const liveRef = useRef(liveEntries)
  liveRef.current = liveEntries

  /** "<id>:<cycle>" -> predicted RUL, for every prediction received. */
  const cacheRef = useRef<Map<string, number>>(new Map())
  /** "<id>:<cycle>" keys currently awaiting a response. */
  const inFlightRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!fleet || fleet.length === 0) return
    let cancelled = false

    /** Publishes each aircraft's cached prediction for its current cycle. */
    const publishFromCache = () => {
      setPredictions((prev) => {
        let next: PredictionMap | null = null
        for (const aircraft of fleet) {
          const entry = liveRef.current[aircraft.id]
          if (!entry) continue
          const value = cacheRef.current.get(`${aircraft.id}:${entry.cycle}`)
          if (value !== undefined && value !== prev[aircraft.id]) {
            next = next ?? { ...prev }
            next[aircraft.id] = value
          }
        }
        return next ?? prev
      })
    }

    const tick = () => {
      const missing: Array<{ id: string; cycle: number }> = []
      for (const aircraft of fleet) {
        const entry = liveRef.current[aircraft.id]
        if (!entry) continue
        const key = `${aircraft.id}:${entry.cycle}`
        if (!cacheRef.current.has(key) && !inFlightRef.current.has(key)) {
          missing.push({ id: aircraft.id, cycle: entry.cycle })
        }
      }

      publishFromCache()
      if (missing.length === 0) return

      missing.forEach((m) => inFlightRef.current.add(`${m.id}:${m.cycle}`))
      setIsLoading(true)
      fetchPredictedRUL(missing)
        .then((result) => {
          missing.forEach((m) => cacheRef.current.set(`${m.id}:${m.cycle}`, result[m.id] as number))
          if (cancelled) return
          setError(null)
          publishFromCache()
        })
        .catch((err) => {
          console.error('Prediction request failed:', err)
          if (!cancelled) setError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          missing.forEach((m) => inFlightRef.current.delete(`${m.id}:${m.cycle}`))
          if (!cancelled && inFlightRef.current.size === 0) setIsLoading(false)
        })
    }

    tick()
    const timer = setInterval(tick, LIVE_DATA_UPDATE_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [fleet])

  return { predictions, isLoading, error }
}
