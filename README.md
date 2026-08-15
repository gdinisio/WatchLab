# WatchLab

A photoreal, interactive **exploded-view viewer** for a Rolex Datejust 36
(ref. 126234 configuration: Oystersteel case, 18k white gold fluted bezel, blue
sunburst dial, Oyster bracelet, calibre 3235).

Every part is a discrete, selectable object with its own material and spec card. A
single slider drives the assembly apart in a staggered cascade; a second slider opens
the calibre independently.

```bash
npm install
npm run dev      # http://localhost:5173
```

## No assets required

There are **no model files, texture files, HDRIs or fonts** in this repository, and
none need to be added. Everything is generated in code:

- **Geometry** — lathes, parametric surfaces, involute gear maths and extruded
  outlines. A watch is overwhelmingly rotationally symmetric, which makes this
  tractable.
- **Textures** — brushed grain, sunburst, perlage, Côtes de Genève, micro-scratches,
  the full dial artwork and the date disc are all drawn to canvas at runtime.
- **Lighting** — a studio light tent built from `<Lightformer>` primitives rather
  than an HDRI, so the app makes zero external requests.

Reference photographs would let the proportions and flute pitch be matched more
precisely, but nothing is blocked without them.

## Controls

| | |
|---|---|
| **Assembly** | Master explode, 0 → 1, staggered cascade |
| **Calibre 3235** | Opens the movement independently |
| **Presets** | Assembled · Case · Calibre · Full |
| **Groups** | Isolate case / dial / movement / bracelet |
| **Light rotation** | Spin the studio rig — the fastest way to make any part look its best |
| **Lume** | Kills the lights and charges the Chromalight, which then decays |
| Click a part | Flies the camera to it and opens its spec card |

### Query parameters

| Parameter | Effect |
|---|---|
| `?view=materials` | Material checkpoint board — every material on a sphere and a chamfered puck |
| `?explode=0..1`, `?movement=0..1` | Initial assembly state |
| `?cam=x,y,z` | Camera placement |
| `?glass=simple` | Cheaper physical transmission instead of the multi-sample pass |
| `?fx=off`, `?dpr=n` | Disable post-processing / pin pixel ratio (used by the headless screenshot harness) |

## How the realism works

Five things carry most of the weight. They are documented in detail at the top of the
files that implement them.

1. **The environment is the material** (`scene/StudioEnvironment.tsx`). Polished metal
   is a mirror: it shows the *room*, not the light. The rig is a bright tent — large
   panels carrying base brightness, narrow hot strips for the specular streaks down
   the case flank, and low fill cards below the horizon, because a vertical case band
   reflects *downward* and otherwise mirrors a black floor.
2. **Anisotropy** (`materials/library.ts`, `geometry/lathe.ts`). `LatheGeometry` lays
   out `u` around the circumference, so for any lathed part `anisotropyRotation = 0`
   gives circular grain and `π/2` gives radial — with no direction map at all. The
   dial needs planar UVs for its printing, so it carries an explicit radial
   anisotropy map instead; that is what produces the sunburst wing that sweeps as the
   watch tilts.
3. **Chamfers and anglage** (`geometry/utils.ts`, `parts/movement.ts`). A true 90°
   edge never catches light. Every profile is chamfered, and every bridge is extruded
   with a generous bevel — the bright polished line tracing a bridge outline is the
   single strongest signal of hand finishing.
4. **Micro-wear** (`materials/textures/scratches.ts`). A perfectly clean surface is
   the most common tell of a CG render. Every metal carries a scratch layer composited
   into its roughness at ±0.03 — tiny enough that you would not name it, large enough
   that its absence is obvious.
5. **HDR post order** (`scene/Effects.tsx`). Bloom runs on a half-float buffer
   *before* tone mapping. Applied afterwards it sees a polished case as a solid field
   of ~1.0 and haloes the entire watch.

## Architecture

```
src/
├── config/datejust36.ts   Reference dimensions. 1 world unit === 1 millimetre.
├── geometry/              Lathe + creased normals, flutes, involute gears, screws,
│                          coronet, bracelet links, shape helpers
├── materials/             PBR library + procedural texture generators
├── parts/                 Geometry builders, the part registry, explode maths
├── scene/                 Canvas, light rig, shadows, post stack, annotations
├── ui/                    Control panel and inspector
└── state/store.ts         Viewer state
```

`parts/registry.ts` is the single source of truth. The scene, the explode cascade, the
group filter and the inspector all read from it — adding a part means adding one
entry. `PartDef.geometry` is a thunk, which is also the seam where a GLB node could be
swapped in per-part without touching materials, explode logic or UI.

## Note on trademarks

The Rolex name, the coronet and the dial typography are trademarks of Rolex SA. This
is a personal study project and is not affiliated with or endorsed by Rolex. Dial text
is driven by `config/datejust36.ts` and can be changed in one place.
