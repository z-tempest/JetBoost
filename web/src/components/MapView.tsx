import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GroundTerrain } from './scene/GroundTerrain'
import { AircraftTrack } from './scene/AircraftTrack'
import { getHealthStatus } from '../utils/status'
import type { Aircraft, HistoryEntry, PredictionMap } from '../types/fleet'

interface MapViewProps {
  fleet: Aircraft[]
  predictions: PredictionMap
  hoveredId: string | null
  selectedId: string | null
  onHoverAircraft: (id: string | null) => void
  onSelectAircraft: (id: string | null) => void
  onFullBreakdown: (id: string) => void
  /** Called (throttled) with an aircraft id and its current history entry,
   * so components outside the canvas can show the same "now". */
  onLiveUpdate: (id: string, entry: HistoryEntry) => void
}

/**
 * The full 3D scene: terrain, each aircraft's trail and marker, and orbit
 * controls clamped so the camera can't flip upside down.
 *
 * Args:
 *   fleet: The fleet to render.
 *   predictions: id -> predicted RUL, from usePredictions. Aircraft
 *     without an entry yet render in a neutral "pending" color.
 *   hoveredId: Currently hovered aircraft id, if any.
 *   selectedId: Currently selected aircraft id, if any.
 *   onHoverAircraft: Called with an id (or null) on hover change.
 *   onSelectAircraft: Called with an id (or null) on click.
 *   onFullBreakdown: Called with an id when a popup's button is clicked.
 *   onLiveUpdate: Called with an id and its current live history entry.
 *
 * Returns:
 *   The canvas.
 */
export function MapView({
  fleet,
  predictions,
  hoveredId,
  selectedId,
  onHoverAircraft,
  onSelectAircraft,
  onFullBreakdown,
  onLiveUpdate,
}: MapViewProps): JSX.Element {
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: [0, 200, 240], fov: 45 }}
      onPointerMissed={() => onSelectAircraft(null)}
    >
      <color attach="background" args={['#CFE3EE']} />
      <fog attach="fog" args={['#CFE3EE', 400, 900]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[120, 220, 100]} intensity={0.65} />

      <GroundTerrain />

      {fleet.map((aircraft, index) => (
        <AircraftTrack
          key={aircraft.id}
          aircraft={aircraft}
          predictedRUL={predictions[aircraft.id]}
          status={getHealthStatus(predictions[aircraft.id])}
          index={index}
          total={fleet.length}
          isHovered={hoveredId === aircraft.id}
          isSelected={selectedId === aircraft.id}
          onHover={() => onHoverAircraft(aircraft.id)}
          onUnhover={() => onHoverAircraft(null)}
          onClick={() => onSelectAircraft(aircraft.id)}
          onFullBreakdown={() => onFullBreakdown(aircraft.id)}
          onLiveUpdate={(entry) => onLiveUpdate(aircraft.id, entry)}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={120}
        maxDistance={420}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.3}
      />
    </Canvas>
  )
}
