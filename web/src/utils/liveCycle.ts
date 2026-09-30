import { cycleAtProgress } from './path'
import type { Aircraft, HistoryEntry } from '../types/fleet'

/**
 * Seconds for one full loop through an aircraft's path and history. The map
 * animation and getLiveEntry both derive from this, so changing it speeds up
 * or slows down everything together.
 */
export const LOOP_SECONDS = 100

/**
 * How often (ms) live entries are pushed into React state. Much coarser than
 * the per-frame animation, which stays on a ref; telemetry updating faster
 * than about once a second reads as noise.
 */
export const LIVE_DATA_UPDATE_MS = 1000

/**
 * Deterministic hash of an id string to [0, 1), used to give each
 * aircraft a small phase jitter without relying on Math.random() (which
 * would reshuffle every remount).
 *
 * Args:
 *   id: The aircraft id, e.g. "unit-3".
 *
 * Returns:
 *   A value in [0, 1).
 */
function hashUnit(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return ((h >>> 0) % 1000) / 1000
}

/**
 * Each aircraft's fixed head start into the loop, so a fleet doesn't
 * all start at the same point (evenly spaced by index) and doesn't move
 * in perfect lockstep with its neighbors (a small per-id jitter on top).
 *
 * Args:
 *   aircraftId: The aircraft's id.
 *   index: Its position in the fleet array.
 *   total: Total fleet size.
 *
 * Returns:
 *   An offset in seconds to add before taking the loop's modulo.
 */
export function loopOffsetSeconds(aircraftId: string, index: number, total: number): number {
  const evenSlot = (index / Math.max(1, total)) * LOOP_SECONDS
  const jitter = hashUnit(aircraftId) * (LOOP_SECONDS / Math.max(1, total))
  return evenSlot + jitter
}

/**
 * Converts elapsed real seconds plus an aircraft's offset into its
 * progress around the loop, in [0, 1).
 *
 * Args:
 *   elapsedSeconds: Seconds since the clock driving the animation
 *     started (e.g. R3F's state.clock.elapsedTime).
 *   offsetSeconds: This aircraft's loopOffsetSeconds.
 *
 * Returns:
 *   Progress fraction, 0 to 1.
 */
export function loopProgress(elapsedSeconds: number, offsetSeconds: number): number {
  return ((elapsedSeconds + offsetSeconds) % LOOP_SECONDS) / LOOP_SECONDS
}

/**
 * Finds the history entry at or just before a (possibly fractional) cycle.
 * Uses a direct index lookup when cycles are contiguous, with a linear-scan
 * fallback for gaps.
 *
 * Args:
 *   history: An aircraft's history, sorted by cycle.
 *   cycle: The target cycle (from cycleAtProgress).
 *
 * Returns:
 *   The matching (or closest preceding) history entry.
 */
export function historyEntryAtCycle(history: HistoryEntry[], cycle: number): HistoryEntry {
  const first = history[0]
  const last = history[history.length - 1]
  const clamped = Math.max(first.cycle, Math.min(last.cycle, cycle))

  const guessIndex = Math.round(clamped - first.cycle)
  const guess = history[guessIndex]
  if (guess && guess.cycle === Math.round(clamped)) return guess

  let best = first
  for (const entry of history) {
    if (entry.cycle > clamped) break
    best = entry
  }
  return best
}

/**
 * The history entry an aircraft's marker is currently over, given the shared
 * animation clock.
 *
 * Args:
 *   aircraft: One fleet entry.
 *   elapsedSeconds: Seconds since the shared animation clock started.
 *   index: This aircraft's position in the fleet array.
 *   total: Total fleet size.
 *
 * Returns:
 *   The history entry this aircraft is "currently" at.
 */
export function getLiveEntry(
  aircraft: Aircraft,
  elapsedSeconds: number,
  index: number,
  total: number,
): HistoryEntry {
  const offset = loopOffsetSeconds(aircraft.id, index, total)
  const t = loopProgress(elapsedSeconds, offset)
  const cycle = cycleAtProgress(aircraft.flightPath, t)
  return historyEntryAtCycle(aircraft.history, cycle)
}
