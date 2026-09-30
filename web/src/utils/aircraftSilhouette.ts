import { Shape, CanvasTexture } from 'three'

/**
 * Builds a simple top-down aircraft silhouette (swept wings, tailplane,
 * fuselage narrowing to a nose) as a flat three.js Shape in the local XY
 * plane. PlaneMarker rotates it flat (-90° about X), so +Y becomes "nose
 * forward" on the map, matching directionAtProgress()'s heading.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   A closed Shape describing the silhouette outline, roughly 9 units
 *   nose-to-tail and 7.2 units across the wingtips.
 */
export function createAircraftSilhouette(): Shape {
  const shape = new Shape()
  // Right half, nose to tail, then mirrored back up the left half.
  const pts: Array<[number, number]> = [
    [0, 4.5], // nose tip
    [0.5, 3.0],
    [0.6, 1.0], // wing root, leading edge
    [3.6, -0.4], // wingtip, leading edge
    [3.6, -1.1], // wingtip, trailing edge
    [0.9, -0.6], // wing root, trailing edge
    [0.7, -2.6], // fuselage, ahead of tailplane
    [1.8, -3.3], // tailplane tip, leading edge
    [1.8, -3.9], // tailplane tip, trailing edge
    [0.5, -3.7], // tail root, trailing edge
    [0, -4.2], // tail cone
  ]
  shape.moveTo(pts[0][0], pts[0][1])
  pts.slice(1).forEach(([x, y]) => shape.lineTo(x, y))
  // Mirror back up the left side to close the outline.
  pts
    .slice(0, -1)
    .reverse()
    .forEach(([x, y]) => shape.lineTo(-x, y))
  shape.closePath()
  return shape
}

/**
 * Builds a soft radial-gradient sprite texture used behind each plane
 * marker as a glow halo (cheap stand-in for real bloom post-processing).
 *
 * Args:
 *   None.
 *
 * Returns:
 *   A CanvasTexture: white in the center, fading to transparent at the
 *   edge. Tint it via the sprite material's `color`.
 */
export function createGlowTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  return texture
}
