import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Color } from 'three'

interface FlightPathProps {
  /** Trailing window of points, oldest first, current position last. */
  points: Array<{ x: number; y: number; z: number }>
  /** Hex color driven by the engine's health status. */
  color: string
}

/**
 * Renders a trailing flight path as a glowing trail: a wide translucent line
 * plus a thin bright core, fading from dim (tail) to bright (head).
 *
 * Args:
 *   points: The trailing window of points (see FlightPathProps).
 *   color: Hex color driven by the engine's health status.
 *
 * Returns:
 *   The trail, as two overlaid drei Line elements, or null once there
 *   are fewer than two points to draw (right at the start of a loop).
 */
export function FlightPath({ points, color }: FlightPathProps): JSX.Element | null {
  const vecs = useMemo<Array<[number, number, number]>>(
    () => points.map((p) => [p.x, p.y, p.z]),
    [points],
  )

  const vertexColors = useMemo<Array<[number, number, number]>>(() => {
    const base = new Color(color)
    const n = points.length
    return points.map((_, i) => {
      const t = n <= 1 ? 1 : i / (n - 1)
      // Fade from dim at the tail up to full brightness at the head.
      const fade = 0.12 + 0.88 * t
      return [base.r * fade, base.g * fade, base.b * fade]
    })
  }, [points, color])

  if (points.length < 2) return null

  return (
    <group>
      <Line points={vecs} vertexColors={vertexColors} lineWidth={6} transparent opacity={0.22} />
      <Line points={vecs} vertexColors={vertexColors} lineWidth={2} transparent opacity={0.95} />
    </group>
  )
}
