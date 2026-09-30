import type { PathPoint } from '../types/fleet'

/**
 * Computes the cumulative arc-length at each point of a polyline.
 *
 * Args:
 *   points: Ordered path points.
 *
 * Returns:
 *   Cumulative distance from the first point, one entry per input
 *   point (same length as points).
 */
function cumulativeLengths(points: PathPoint[]): number[] {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    lengths.push(lengths[i - 1] + d)
  }
  return lengths
}

/**
 * Locates the path segment a fraction t of the way along a path by arc
 * length. Shared by pointAtProgress and cycleAtProgress, so a position and a
 * cycle computed at the same t always describe the same point.
 *
 * Args:
 *   points: Ordered path points (at least 2).
 *   t: Progress along the path, from 0 to 1.
 *
 * Returns:
 *   The segment's endpoints and the fractional position (0-1) within it.
 */
function findSegment(points: PathPoint[], t: number): { a: PathPoint; b: PathPoint; segT: number } {
  const lengths = cumulativeLengths(points)
  const total = lengths[lengths.length - 1]
  const target = Math.max(0, Math.min(1, t)) * total

  let i = 1
  while (i < lengths.length - 1 && lengths[i] < target) i++

  const segStart = lengths[i - 1]
  const segEnd = lengths[i]
  const segT = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0

  return { a: points[i - 1], b: points[i], segT }
}

/**
 * Finds the 3D position a fraction t of the way along a path, moving at
 * constant speed (interpolated by arc length, not by point index).
 *
 * Args:
 *   points: Ordered path points.
 *   t: Progress along the path, from 0 to 1.
 *
 * Returns:
 *   The interpolated { x, y, z } position.
 */
export function pointAtProgress(points: PathPoint[], t: number): { x: number; y: number; z: number } {
  if (points.length === 0) return { x: 0, y: 0, z: 0 }
  if (points.length === 1) return points[0]

  const { a, b, segT } = findSegment(points, t)
  return {
    x: a.x + (b.x - a.x) * segT,
    y: a.y + (b.y - a.y) * segT,
    z: a.z + (b.z - a.z) * segT,
  }
}

/**
 * Finds the logged cycle a fraction t of the way along a path, using the same
 * segment as pointAtProgress -- i.e. which cycle the marker is currently
 * passing over. This links the animation to the aircraft's data (see
 * utils/liveCycle.ts).
 *
 * Args:
 *   points: Ordered flight-path points, each carrying the real cycle it
 *     was logged at.
 *   t: Progress along the path, from 0 to 1.
 *
 * Returns:
 *   The interpolated cycle number (not necessarily a whole number --
 *   round or floor it before indexing into history).
 */
export function cycleAtProgress(points: PathPoint[], t: number): number {
  if (points.length === 0) return 0
  if (points.length === 1) return points[0].cycle

  const { a, b, segT } = findSegment(points, t)
  return a.cycle + (b.cycle - a.cycle) * segT
}

/**
 * Estimates the direction of travel at progress t, for orienting the
 * plane marker to face the way it's moving.
 *
 * Args:
 *   points: Ordered path points.
 *   t: Progress along the path, from 0 to 1.
 *
 * Returns:
 *   A (non-normalized) direction vector { x, y, z }.
 */
export function directionAtProgress(points: PathPoint[], t: number): { x: number; y: number; z: number } {
  const dt = 0.01
  const a = pointAtProgress(points, Math.max(0, t - dt))
  const b = pointAtProgress(points, Math.min(1, t + dt))
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
}

/**
 * Resamples a path to `resolution` points evenly spaced by arc length. Raw
 * points bunch up during slow (low-Mach) stretches; a fixed-size, evenly
 * spaced path lets AircraftTrack slice a trailing window by index.
 *
 * Args:
 *   points: Ordered path points.
 *   resolution: Number of evenly-spaced output points.
 *
 * Returns:
 *   `resolution` points, each { x, y, z }, evenly spaced along the
 *   original path's arc length.
 */
export function resamplePathEven(
  points: PathPoint[],
  resolution: number,
): Array<{ x: number; y: number; z: number }> {
  const out: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i < resolution; i++) {
    out.push(pointAtProgress(points, resolution === 1 ? 0 : i / (resolution - 1)))
  }
  return out
}
