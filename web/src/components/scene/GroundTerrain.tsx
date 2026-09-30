import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Deterministic PRNG (mulberry32) so the terrain/water textures are
 * stable across reloads instead of re-randomizing on every mount.
 *
 * Args:
 *   seed: Any 32-bit integer seed.
 *
 * Returns:
 *   A () => number generator yielding values in [0, 1).
 */
function mulberry32(seed: number): () => number {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GREEN_SHADES = ['#33513a', '#3d5f42', '#2a4530', '#4a6b48', '#375641', '#547a52']

/**
 * Builds a mottled green terrain texture from soft overlapping color blobs,
 * so no external imagery is needed.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   A 1024x1024 CanvasTexture.
 */
function buildTerrainTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(1337)

  ctx.fillStyle = '#2f4d38'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 260; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 30 + rand() * 90
    const shade = GREEN_SHADES[Math.floor(rand() * GREEN_SHADES.length)]
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, shade)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.35
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  return new THREE.CanvasTexture(canvas)
}

/**
 * Builds a soft-edged, irregular "water body" texture: a randomly
 * perturbed circle (not a perfect ellipse) filled with a blue radial
 * gradient, so a lake/bay reads as natural rather than geometric.
 *
 * Args:
 *   seed: PRNG seed, so different water bodies get different outlines.
 *
 * Returns:
 *   A 512x512 CanvasTexture, transparent outside the water shape.
 */
function buildWaterTexture(seed: number): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(seed)
  const cx = size / 2
  const cy = size / 2
  const baseR = size * 0.36
  const points = 14

  ctx.beginPath()
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2
    const wobble = 0.72 + rand() * 0.55
    const r = baseR * wobble
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  const gradient = ctx.createRadialGradient(cx, cy, baseR * 0.15, cx, cy, baseR * 1.05)
  gradient.addColorStop(0, '#4a8fb5')
  gradient.addColorStop(0.7, '#2f6a90')
  gradient.addColorStop(1, 'rgba(47,106,144,0)')
  ctx.fillStyle = gradient
  ctx.fill()

  return new THREE.CanvasTexture(canvas)
}

interface WaterBodyProps {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: number
  seed: number
}

/** One water body: a textured plane laid flat just above the terrain. */
function WaterBody({ position, scale, rotation = 0, seed }: WaterBodyProps): JSX.Element {
  const texture = useMemo(() => buildWaterTexture(seed), [seed])
  return (
    <mesh rotation-x={-Math.PI / 2} rotation-z={rotation} position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} transparent roughness={0.25} metalness={0.15} />
    </mesh>
  )
}

/**
 * Renders the ground under the flight paths: a procedurally textured green
 * plane with two soft-edged water bodies.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   The ground group.
 */
export function GroundTerrain(): JSX.Element {
  const terrainTexture = useMemo(() => buildTerrainTexture(), [])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial map={terrainTexture} roughness={0.95} />
      </mesh>

      <WaterBody position={[150, -0.4, 120]} scale={[240, 120, 1]} rotation={0.5} seed={7} />
      <WaterBody position={[-95, -0.4, -170]} scale={[130, 85, 1]} rotation={-0.9} seed={19} />
    </group>
  )
}
