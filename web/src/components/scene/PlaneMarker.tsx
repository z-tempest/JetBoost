import { forwardRef, useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { DoubleSide } from 'three'
import { createAircraftSilhouette, createGlowTexture } from '../../utils/aircraftSilhouette'
import { AircraftPopup } from '../AircraftPopup'
import type { Aircraft, HealthStatus, HistoryEntry } from '../../types/fleet'

interface PlaneMarkerProps {
  aircraft: Aircraft
  status: HealthStatus
  predictedRUL: number | undefined
  /** Current history entry (see utils/liveCycle.ts), shown in the popup. */
  entry: HistoryEntry
  isHovered: boolean
  isSelected: boolean
  onHover: () => void
  onUnhover: () => void
  onClick: () => void
  onFullBreakdown: () => void
}

/**
 * One aircraft's marker: a flat silhouette and glow halo in its health
 * color, a nickname tooltip on hover, and an AircraftPopup on click. Purely
 * presentational -- AircraftTrack owns the animation and moves this group
 * through the forwarded ref.
 *
 * Popups render without `distanceFactor`, so they keep a fixed screen size
 * at any zoom level.
 *
 * Args:
 *   aircraft: One fleet entry.
 *   status: Health status for this aircraft (from getHealthStatus,
 *     driven by usePredictions -- may be the neutral "pending" status).
 *   entry: This aircraft's current live history entry, for the popup.
 *   isHovered: Whether this aircraft is currently hovered.
 *   isSelected: Whether this aircraft's popup should be shown.
 *   onHover: Called on pointer over.
 *   onUnhover: Called on pointer out.
 *   onClick: Called when the marker is clicked.
 *   onFullBreakdown: Called when the popup's button is clicked.
 *
 * Returns:
 *   The marker group (forwardRef'd so AircraftTrack can move it).
 */
export const PlaneMarker = forwardRef<Group, PlaneMarkerProps>(function PlaneMarker(
  { aircraft, status, predictedRUL, entry, isHovered, isSelected, onHover, onUnhover, onClick, onFullBreakdown },
  ref,
) {
  const silhouette = useMemo(() => createAircraftSilhouette(), [])
  const glowTexture = useMemo(() => createGlowTexture(), [])

  return (
    <group
      ref={ref}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover()
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onUnhover()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Soft glow halo, billboarded toward the camera. */}
      <sprite scale={[16, 16, 1]} position={[0, 0.2, 0]}>
        <spriteMaterial
          map={glowTexture}
          color={status.color}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </sprite>

      {/* The aircraft silhouette itself, laid flat and glowing. */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI}>
        <shapeGeometry args={[silhouette]} />
        <meshBasicMaterial color={status.color} side={DoubleSide} toneMapped={false} />
      </mesh>

      {isHovered && !isSelected && (
        <Html center position={[0, 6, 0]} zIndexRange={[10, 10]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-xs font-medium text-white shadow-floaty">
            {aircraft.nickname}
          </div>
        </Html>
      )}

      {isSelected && (
        <Html center position={[0, 10, 0]} zIndexRange={[20, 20]}>
          <AircraftPopup
            aircraft={aircraft}
            status={status}
            predictedRUL={predictedRUL}
            entry={entry}
            onFullBreakdown={onFullBreakdown}
          />
        </Html>
      )}
    </group>
  )
})
