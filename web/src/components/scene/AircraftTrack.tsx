import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { FlightPath } from './FlightPath'
import { PlaneMarker } from './PlaneMarker'
import { pointAtProgress, directionAtProgress, cycleAtProgress, resamplePathEven } from '../../utils/path'
import { LIVE_DATA_UPDATE_MS, loopOffsetSeconds, loopProgress, historyEntryAtCycle } from '../../utils/liveCycle'
import type { Aircraft, HealthStatus, HistoryEntry } from '../../types/fleet'

/** Points sampled evenly along each path, used to window the trailing
 * line by index rather than re-walking arc length every frame. */
const PATH_RESOLUTION = 300

/** How much of the resampled path (as a fraction of PATH_RESOLUTION)
 * stays visible behind the aircraft as its trail. */
const TRAIL_FRACTION = 0.22

/** How often (ms) the trail's React state updates. The plane itself moves
 * every frame via a ref; only the trail redraw is throttled. */
const TRAIL_UPDATE_MS = 90

interface AircraftTrackProps {
  aircraft: Aircraft
  status: HealthStatus
  /** Predicted RUL, if it has arrived yet. Passed through to the popup. */
  predictedRUL: number | undefined
  /** This aircraft's position in the fleet array, for even loop spacing. */
  index: number
  /** Total fleet size, for even loop spacing. */
  total: number
  isHovered: boolean
  isSelected: boolean
  onHover: () => void
  onUnhover: () => void
  onClick: () => void
  onFullBreakdown: () => void
  /** Called (throttled to LIVE_DATA_UPDATE_MS) with the history entry the
   * marker is currently over. */
  onLiveUpdate: (entry: HistoryEntry) => void
}

/**
 * Owns one aircraft's animation: moves it along its flight path every
 * frame via a ref (no React re-render per frame) and periodically
 * republishes a trailing window of the path as a glowing trail. The same
 * progress value also determines which logged cycle the marker is over
 * (see onLiveUpdate), so what's drawn and what the popup and sidebar show
 * come from one clock.
 *
 * Aircraft are spaced evenly around the loop by index, with a small per-id
 * jitter, so the fleet doesn't clump together or move in lockstep.
 *
 * Args:
 *   aircraft: One fleet entry.
 *   status: Health status for this aircraft (drives the glow color).
 *   index: This aircraft's position in the fleet array.
 *   total: Total number of aircraft, for even spacing.
 *   isHovered, isSelected, onHover, onUnhover, onClick,
 *     onFullBreakdown: Forwarded to PlaneMarker.
 *   onLiveUpdate: Called with this aircraft's current history entry.
 *
 * Returns:
 *   The trail plus the marker, as a group.
 */
export function AircraftTrack({
  aircraft,
  status,
  predictedRUL,
  index,
  total,
  isHovered,
  isSelected,
  onHover,
  onUnhover,
  onClick,
  onFullBreakdown,
  onLiveUpdate,
}: AircraftTrackProps): JSX.Element {
  const groupRef = useRef<Group>(null)
  const elapsedSinceTrailUpdate = useRef(0)
  const elapsedSinceLiveUpdate = useRef(0)

  const resampled = useMemo(
    () => resamplePathEven(aircraft.flightPath, PATH_RESOLUTION),
    [aircraft.flightPath],
  )

  const offsetSeconds = useMemo(
    () => loopOffsetSeconds(aircraft.id, index, total),
    [aircraft.id, index, total],
  )

  const [trailPoints, setTrailPoints] = useState<Array<{ x: number; y: number; z: number }>>(() => [
    resampled[0],
  ])
  const [liveEntry, setLiveEntry] = useState<HistoryEntry>(() => aircraft.history[0])

  useFrame((state, delta) => {
    const t = loopProgress(state.clock.elapsedTime, offsetSeconds)
    const pos = pointAtProgress(aircraft.flightPath, t)
    const dir = directionAtProgress(aircraft.flightPath, t)
    if (groupRef.current) {
      groupRef.current.position.set(pos.x, pos.y, pos.z)
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z)
    }

    elapsedSinceTrailUpdate.current += delta * 1000
    if (elapsedSinceTrailUpdate.current >= TRAIL_UPDATE_MS) {
      elapsedSinceTrailUpdate.current = 0
      const headIndex = Math.floor(t * (PATH_RESOLUTION - 1))
      const trailLength = Math.round(PATH_RESOLUTION * TRAIL_FRACTION)
      const tailIndex = Math.max(0, headIndex - trailLength)
      setTrailPoints(resampled.slice(tailIndex, headIndex + 1))
    }

    elapsedSinceLiveUpdate.current += delta * 1000
    if (elapsedSinceLiveUpdate.current >= LIVE_DATA_UPDATE_MS) {
      elapsedSinceLiveUpdate.current = 0
      const cycle = cycleAtProgress(aircraft.flightPath, t)
      const entry = historyEntryAtCycle(aircraft.history, cycle)
      if (entry !== liveEntry) {
        setLiveEntry(entry)
        onLiveUpdate(entry)
      }
    }
  })

  return (
    <group>
      <FlightPath points={trailPoints} color={status.color} />
      <PlaneMarker
        ref={groupRef}
        aircraft={aircraft}
        status={status}
        predictedRUL={predictedRUL}
        entry={liveEntry}
        isHovered={isHovered}
        isSelected={isSelected}
        onHover={onHover}
        onUnhover={onUnhover}
        onClick={onClick}
        onFullBreakdown={onFullBreakdown}
      />
    </group>
  )
}
