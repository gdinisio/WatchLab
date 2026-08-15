import { useEffect, useState } from 'react'
import { buildMaterials, type MaterialLibrary } from './library'

let cached: MaterialLibrary | null = null

/** Builds the library once per session; every caller shares the same instances. */
export function getMaterials(): MaterialLibrary {
  if (!cached) cached = buildMaterials()
  return cached
}

/**
 * Generating every procedural texture takes a second or two of main-thread work, so
 * it is deferred one tick to let the loading UI paint first.
 */
export function useMaterials(): MaterialLibrary | null {
  const [lib, setLib] = useState<MaterialLibrary | null>(cached)

  useEffect(() => {
    if (cached) return
    const id = window.setTimeout(() => setLib(getMaterials()), 30)
    return () => window.clearTimeout(id)
  }, [])

  return lib
}
