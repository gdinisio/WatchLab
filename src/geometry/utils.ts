import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const cache = new Map<string, THREE.BufferGeometry>()

/** Memoises generated geometry so repeated part builds are free. */
export function cached(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key)
  if (!g) {
    g = build()
    cache.set(key, g)
  }
  return g
}

export function disposeGeometryCache() {
  cache.forEach((g) => g.dispose())
  cache.clear()
}

export type P2 = readonly [number, number]

/**
 * Expands a polyline of (radius, height) points, inserting a chamfer of the given
 * size at every interior corner.
 *
 * EVERY EDGE ON A WATCH IS CHAMFERED. A true 90-degree edge never catches light and
 * instantly reads as CG; a 0.05-0.15mm chamfer creates the bright specular line that
 * sells the surface as machined metal. This is not a detail — it is the difference
 * between a render that works and one that does not.
 */
export function chamferProfile(points: P2[], size: number): P2[] {
  if (points.length < 3) return [...points]
  const out: P2[] = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [cx, cy] = points[i]
    const [nx, ny] = points[i + 1]

    const inDir = norm(cx - px, cy - py)
    const outDir = norm(nx - cx, ny - cy)
    // Collinear points need no chamfer.
    if (Math.abs(inDir[0] * outDir[1] - inDir[1] * outDir[0]) < 1e-6) {
      out.push(points[i])
      continue
    }
    const back = Math.min(size, len(cx - px, cy - py) * 0.45)
    const fwd = Math.min(size, len(nx - cx, ny - cy) * 0.45)
    out.push([cx - inDir[0] * back, cy - inDir[1] * back])
    out.push([cx + outDir[0] * fwd, cy + outDir[1] * fwd])
  }

  out.push(points[points.length - 1])
  return out
}

const len = (x: number, y: number) => Math.hypot(x, y) || 1
const norm = (x: number, y: number): P2 => {
  const l = len(x, y)
  return [x / l, y / l]
}

/**
 * Merges geometries after normalising their index state.
 *
 * `mergeGeometries` silently returns null if some inputs are indexed and others are
 * not — which is exactly what happens when lathes (de-indexed by `toCreasedNormals`)
 * meet `parametricSurface` output (indexed). De-indexing everything first makes the
 * merge total, and a thrown error beats a null that crashes the renderer later.
 */
export function mergeAll(parts: THREE.BufferGeometry[], label: string): THREE.BufferGeometry {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = mergeGeometries(flat, false)
  if (!merged) throw new Error(`mergeAll(${label}): incompatible geometry attributes`)
  return merged
}

/** Welds coincident vertices then recomputes normals. Use before creasing. */
export function weld(g: THREE.BufferGeometry, tolerance = 1e-4) {
  const merged = mergeVertices(g, tolerance)
  merged.computeVertexNormals()
  return merged
}

/** Builds a BufferGeometry from a parametric surface P(u, v). */
export function parametricSurface(
  uSegments: number,
  vSegments: number,
  fn: (u: number, v: number, target: THREE.Vector3) => void,
  options: { closeU?: boolean } = {},
): THREE.BufferGeometry {
  const { closeU = true } = options
  const uCount = uSegments + (closeU ? 0 : 1)
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const p = new THREE.Vector3()

  for (let vi = 0; vi <= vSegments; vi++) {
    for (let ui = 0; ui < uCount + (closeU ? 1 : 0); ui++) {
      const u = ui / uSegments
      const v = vi / vSegments
      fn(u, v, p)
      positions.push(p.x, p.y, p.z)
      uvs.push(u, v)
    }
  }

  const rowLength = uCount + (closeU ? 1 : 0)
  for (let vi = 0; vi < vSegments; vi++) {
    for (let ui = 0; ui < rowLength - 1; ui++) {
      const a = vi * rowLength + ui
      const b = a + 1
      const c = a + rowLength
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/**
 * Uniform 1-to-4 triangle subdivision, applied `levels` times.
 *
 * Needed before any per-vertex displacement of an extruded piece. `ExtrudeGeometry`
 * triangulates its caps from the outline alone, so the interior of a 20mm-wide face
 * may be spanned by two triangles; displacing those gives a faceted tent instead of
 * a smooth arc. Subdividing every triangle rather than only the large ones keeps the
 * mesh watertight — splitting selectively leaves T-junctions, which open into
 * hairline cracks the moment the surface is displaced.
 */
export function subdivide(g: THREE.BufferGeometry, levels = 1): THREE.BufferGeometry {
  let work = g.index ? g.toNonIndexed() : g

  for (let pass = 0; pass < levels; pass++) {
    const src = work.getAttribute('position') as THREE.BufferAttribute
    const srcUv = work.getAttribute('uv') as THREE.BufferAttribute | undefined
    const pos: number[] = []
    const uv: number[] = []

    interface Vertex { p: number[]; t: number[] }
    const vert = (n: number): Vertex => ({
      p: [src.getX(n), src.getY(n), src.getZ(n)],
      t: srcUv ? [srcUv.getX(n), srcUv.getY(n)] : [0, 0],
    })
    // Triangles are split independently, with no shared-edge bookkeeping: a shared
    // edge's midpoint is averaged from the same two endpoints on both sides, so the
    // two copies land on bit-identical coordinates and the seam stays closed.
    const mid = (a: Vertex, b: Vertex): Vertex => ({
      p: a.p.map((v, i) => (v + b.p[i]) / 2),
      t: a.t.map((v, i) => (v + b.t[i]) / 2),
    })
    const emit = (...tri: Vertex[]) => {
      for (const v of tri) {
        pos.push(v.p[0], v.p[1], v.p[2])
        if (srcUv) uv.push(v.t[0], v.t[1])
      }
    }

    for (let i = 0; i < src.count; i += 3) {
      const a = vert(i)
      const b = vert(i + 1)
      const c = vert(i + 2)
      const ab = mid(a, b)
      const bc = mid(b, c)
      const ca = mid(c, a)
      emit(a, ab, ca)
      emit(ab, b, bc)
      emit(ca, bc, c)
      emit(ab, bc, ca)
    }

    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    if (srcUv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    out.computeVertexNormals()
    work = out
  }

  return work
}
