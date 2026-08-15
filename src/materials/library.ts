import * as THREE from 'three'
import { DIAL } from '../config/datejust36'
import { DATE_DISC_RADIUS } from '../parts/dial'
import { makeStreakSurfaces } from './textures/brushed'
import { makeScratchSurface } from './textures/scratches'
import { makePerlageSurface } from './textures/perlage'
import { makeCotesSurface } from './textures/cotes'
import { composeMetalMaps, type MetalMaps } from './textures/composite'
import { makeDialMaps } from './textures/dialPrint'
import { makeDateDiscMap } from './textures/dateDisc'

export type MaterialKey =
  | 'steelPolished'
  | 'steelBrushed'
  | 'steelCircular'
  | 'whiteGold'
  | 'yellowGold'
  | 'yellowGoldSatin'
  | 'rhodiumPerlage'
  | 'rhodiumCotes'
  | 'rhodiumBrushed'
  | 'bluedSteel'
  | 'brassGilt'
  | 'ruby'
  | 'dial'
  | 'dateDisc'
  | 'lume'
  | 'gasket'
  | 'sapphire'

/**
 * Physically-derived F0 reflectances, given as sRGB hex (three converts on assignment).
 * For a metal, `color` IS the specular reflectance — these are not artistic choices.
 *
 * Steel, white gold and rhodium are three DISTINCT neutrals. Rendering them
 * identically is one of the fastest ways to make a watch look fake.
 */
const F0 = {
  /** 904L Oystersteel. Iron reflectance ~0.56-0.58 linear. */
  steel: '#c5c8cb',
  /** 18k white gold, rhodium-flashed: fractionally warmer and brighter than steel. */
  whiteGold: '#e8e6e4',
  /** 18k yellow gold. Pure Au is #ffe39d; 18k is diluted by Ag/Cu so it reads paler. */
  yellowGold: '#ffe0ae',
  /** Rhodium plating on movement plates. */
  rhodium: '#e3e1e0',
  /** Heat-blued steel / Parachrom bleu. */
  blued: '#2d4a7a',
  /** Gilt brass movement wheels. */
  brass: '#d8b878',
} as const

/** Metals are lifted slightly to compensate for the tone mapper's highlight rolloff. */
const ENV_METAL = 1.25

export interface MaterialLibrary {
  materials: Record<Exclude<MaterialKey, 'sapphire'>, THREE.Material>
  /** Props for drei's MeshTransmissionMaterial — sapphire is a component, not an instance. */
  sapphire: SapphireProps
  /** Every material carrying lume emission, so lume mode can drive them together. */
  lumeMaterials: THREE.MeshPhysicalMaterial[]
  dispose(): void
}

export interface SapphireProps {
  ior: number
  thickness: number
  chromaticAberration: number
  anisotropicBlur: number
  roughness: number
  samples: number
  resolution: number
  backsideResolution: number
  backside: boolean
  backsideThickness: number
  distortion: number
  temporalDistortion: number
  transmission: number
  attenuationColor: string
  attenuationDistance: number
  color: string
  /** Stands in for the AR coating: how much the surface reflects at all. */
  specularIntensity: number
  envMapIntensity: number
}

function setRepeat(maps: MetalMaps, u: number, v: number) {
  maps.roughnessMap.repeat.set(u, v)
  maps.normalMap.repeat.set(u, v)
  return maps
}

/**
 * Builds every material once. This is heavy (all procedural textures are generated
 * here) so it must be called behind a loading state, not during a render.
 */
export function buildMaterials(): MaterialLibrary {
  const disposables: (THREE.Material | THREE.Texture)[] = []
  const track = <T extends THREE.Material | THREE.Texture>(x: T) => {
    disposables.push(x)
    return x
  }

  // ---- shared micro-wear layers ------------------------------------------
  const wearFine = makeScratchSurface({ seed: 4242, count: 1400, length: 0.04 })
  const wearCoarse = makeScratchSurface({ seed: 8181, count: 700, length: 0.08 })
  // Brushed surfaces wear ALONG the grain, not across it.
  const wearAligned = makeScratchSurface({
    seed: 5150, count: 900, length: 0.09, alignment: 0.85, angle: 0,
  })

  // ---- grain layers -------------------------------------------------------
  const satinGrain = makeStreakSurfaces({
    seed: 1337, axis: 'v', frequency: 900, roughness: 0.32, variation: 0.1, wander: 0.004,
  })
  const circularGrain = makeStreakSurfaces({
    seed: 2211, axis: 'v', frequency: 1400, roughness: 0.3, variation: 0.09,
  })
  const fineSatin = makeStreakSurfaces({
    seed: 3312, axis: 'v', frequency: 1600, roughness: 0.26, variation: 0.08,
  })

  // ---- map sets -----------------------------------------------------------
  const polishedMaps = composeMetalMaps({
    scratches: wearFine, baseRoughness: 0.045, scratchRoughness: 0.028,
    scratchHeight: 1, normalStrength: 0.5,
  })
  const brushedMaps = setRepeat(composeMetalMaps({
    streak: satinGrain.height, streakRoughness: satinGrain.roughness,
    scratches: wearAligned, normalStrength: 1.5,
  }), 1, 1)
  const circularMaps = setRepeat(composeMetalMaps({
    streak: circularGrain.height, streakRoughness: circularGrain.roughness,
    scratches: wearAligned, normalStrength: 1.4,
  }), 1, 1)
  const satinGoldMaps = composeMetalMaps({
    streak: fineSatin.height, streakRoughness: fineSatin.roughness,
    scratches: wearFine, normalStrength: 1.2,
  })
  const perlageMaps = composeMetalMaps({
    streak: makePerlageSurface({ columns: 20 }),
    scratches: wearCoarse, baseRoughness: 0.4, scratchRoughness: 0.02,
    scratchHeight: 0.25, normalStrength: 1.6,
  })
  const cotesMaps = composeMetalMaps({
    streak: makeCotesSurface({ stripes: 12 }),
    scratches: wearFine, baseRoughness: 0.35, scratchRoughness: 0.02,
    scratchHeight: 0.25, normalStrength: 1.5,
  })
  ;[polishedMaps, brushedMaps, circularMaps, satinGoldMaps, perlageMaps, cotesMaps].forEach((m) => {
    track(m.roughnessMap)
    track(m.normalMap)
  })

  const metal = (
    color: string,
    maps: MetalMaps,
    extra: Partial<THREE.MeshPhysicalMaterialParameters> & {
      anisotropy?: number
      anisotropyRotation?: number
    } = {},
  ) =>
    track(new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1,
      roughness: 1, // fully driven by roughnessMap
      roughnessMap: maps.roughnessMap,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      envMapIntensity: ENV_METAL,
      ...extra,
    }))

  // ---- dial ---------------------------------------------------------------
  const dialMaps = makeDialMaps(DIAL.colour)
  Object.values(dialMaps).forEach(track)

  const dial = track(new THREE.MeshPhysicalMaterial({
    map: dialMaps.map,
    roughnessMap: dialMaps.roughnessMap,
    normalMap: dialMaps.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    anisotropyMap: dialMaps.anisotropyMap,
    // A sunray dial is a COLOURED lacquer over brushed metal, so most of what you
    // see is diffuse pigment; the metal underneath only supplies the sweeping
    // highlight. Held near 0.5 the dial mirrors the white tent from every direction
    // at once and washes out to pale lavender no matter how blue the base is.
    metalness: 0.28,
    roughness: 1,
    anisotropy: 1,
    // Radial grain: the direction comes from the map, so no extra rotation.
    anisotropyRotation: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    // Pushed higher the sunray blows out to lavender instead of staying blue.
    envMapIntensity: 0.78,
  }))

  const dateDiscMap = track(makeDateDiscMap(DATE_DISC_RADIUS, DIAL.date.distanceFromCentre))
  const dateDisc = track(new THREE.MeshPhysicalMaterial({
    map: dateDiscMap,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1,
  }))

  // ---- luminous material --------------------------------------------------
  const lume = track(new THREE.MeshPhysicalMaterial({
    color: '#e8f4f2',
    roughness: 0.62,
    metalness: 0,
    emissive: new THREE.Color('#7fe7ff'),
    emissiveIntensity: 0,
    envMapIntensity: 0.8,
  }))

  const materials = {
    steelPolished: metal(F0.steel, polishedMaps),
    steelBrushed: metal(F0.steel, brushedMaps, { anisotropy: 0.9, anisotropyRotation: 0 }),
    steelCircular: metal(F0.steel, circularMaps, { anisotropy: 0.95, anisotropyRotation: 0 }),
    whiteGold: metal(F0.whiteGold, polishedMaps),
    yellowGold: metal(F0.yellowGold, polishedMaps, { envMapIntensity: 1.3 }),
    yellowGoldSatin: metal(F0.yellowGold, satinGoldMaps, {
      anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 1.3,
    }),
    rhodiumPerlage: metal(F0.rhodium, perlageMaps),
    rhodiumCotes: metal(F0.rhodium, cotesMaps, { anisotropy: 0.7, anisotropyRotation: 0 }),
    rhodiumBrushed: metal(F0.rhodium, circularMaps, { anisotropy: 0.9, anisotropyRotation: 0 }),
    bluedSteel: metal(F0.blued, polishedMaps, { roughness: 1, envMapIntensity: 1.1 }),
    brassGilt: metal(F0.brass, circularMaps, { anisotropy: 0.85, anisotropyRotation: 0 }),

    // Synthetic ruby. A short attenuation distance is what makes a 0.3mm jewel
    // glow a saturated red instead of looking like pink glass.
    ruby: track(new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      ior: 1.77,
      thickness: 0.35,
      attenuationColor: new THREE.Color('#8b0012'),
      attenuationDistance: 0.4,
      specularIntensity: 1,
      envMapIntensity: 1.4,
    })),

    gasket: track(new THREE.MeshPhysicalMaterial({
      color: '#15171a',
      roughness: 0.72,
      metalness: 0,
      sheen: 0.3,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#2a2d33'),
      envMapIntensity: 0.6,
    })),

    dial,
    dateDisc,
    lume,
  } satisfies Record<Exclude<MaterialKey, 'sapphire'>, THREE.Material>

  /**
   * Sapphire crystal. ior 1.77 is the real figure for corundum — NOT 1.5 glass.
   * Chromatic aberration stays low because sapphire's Abbe number is high; overdo
   * it and it reads as cut glass or diamond.
   */
  const sapphire: SapphireProps = {
    color: '#ffffff',
    ior: 1.77,
    thickness: 1.25,
    // Sapphire is optically flat and its Abbe number is high. ANY blur or colour
    // fringing here reads as fogged plastic rather than a watch crystal, and it is
    // the dial — the most detailed surface in the scene — that pays the price.
    chromaticAberration: 0.004,
    anisotropicBlur: 0,
    roughness: 0,
    // The transmission buffer is what the dial is actually SEEN THROUGH, so its
    // resolution caps how sharp the dial can ever look. 1024 visibly softened the
    // printing; this is the single biggest clarity win available.
    samples: 16,
    resolution: 2048,
    backsideResolution: 1024,
    backside: true,
    backsideThickness: 0.35,
    distortion: 0,
    temporalDistortion: 0,
    transmission: 1,
    attenuationColor: '#ffffff',
    attenuationDistance: 400,
    /**
     * Anti-reflective coating, modelled honestly.
     *
     * Rolex coats the underside of the crystal, cutting surface reflectance from
     * roughly 4% to well under 1%. `specularIntensity` is exactly that dial in the
     * PBR model. Left at 1.0 the crystal mirrors a whole softbox across the dial as
     * a broad white band — which is what an UNCOATED piece of sapphire really would
     * do, and precisely what the coating exists to prevent.
     */
    specularIntensity: 0.22,
    envMapIntensity: 0.5,
  }

  return {
    materials,
    sapphire,
    lumeMaterials: [lume],
    dispose() {
      disposables.forEach((d) => d.dispose())
    },
  }
}
