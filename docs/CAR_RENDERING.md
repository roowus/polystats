# Car rendering

How PolyStats draws a player's car, and why.

## The problem

PolyTrack draws cars with its own WebGL scene and exposes no image endpoint. The
first attempts here hand-drew an SVG silhouette from screenshots. It looked
wrong: the proportions were off, the wheels were hidden behind the body, and the
shape did not resemble the game's open-wheel car. Patterns could not be drawn at
all.

## What the game actually has

Extracted from the 0.6.3 bundle and its published assets:

| Asset | What it is |
| --- | --- |
| `models/car.glb` | The real car mesh: 58 meshes, ~6,900 vertices, Draco-compressed |
| `images/pattern_*.svg` | 16 paint patterns, as 1024x1024 UV texture atlases |
| `lib/draco/*` | The Draco decoder needed to read the mesh |

The mesh carries six named materials, which are what a style's colours apply to:
`Main` (body), `Metal` (frame), `Rim`, `Tire`, `AirIntake`, `BrakeLight`.

### Style byte layout

Taken from the game's own `serializeBinary`:

| Bytes | Meaning |
| --- | --- |
| 0 | version (0) |
| 1 | pattern index, 0-15 |
| 2 | wheel/rim variant, 0-11 |
| 3 | exhaust variant, 0-7 |
| 4-6 | primary (body) |
| 7-9 | secondary (pattern accent) |
| 10-12 | frame metal |
| 13-15 | rim |

Two details matter, and both were wrong in the first implementation:

- Styles are **base64url**, so `-` and `_` appear in real values. `atob` rejects
  those and throws, which silently produced default colours for most players.
- Each colour is stored **little-endian** as `[low, mid, high]`, i.e. B, G, R.
  Reading the bytes in order swaps red and blue, turning a cyan car olive.

The pattern SVGs paint in placeholder colours the game substitutes:
`#f00` -> primary, `#0f0` -> secondary, `#00f` -> frame.

## How rendering works

```
scripts/extract-car-mesh.mjs      (offline, once)
  car.glb --[Draco decode]--> src/lib/carGeometry.json   (~30 KB)

src/lib/carProject.ts             (runtime, per car)
  carGeometry.json --[project + sort]--> FlatPolygon[]

src/components/CarPic.tsx
  FlatPolygon[] --[paint per material]--> SVG
```

The decode runs offline because it needs three.js and the Draco WASM runtime,
about 600 KB, which would otherwise load in every visitor's browser to draw a
28px icon. Only the small JSON ships, so drawing is pure arithmetic.

### Camera

The game's thumbnail camera sits at `(1000.1, 1000.3, 1000)` looking at
`(0.1, 0.3, 0)`, with a frustum so wide (`-1,1,1,-1` at `near .1`) that it is
effectively **orthographic**. That is why native renders look flat rather than
perspective-distorted. `carProject.ts` projects orthographically for the same
reason.

### Ordering and shading

Polygons are sorted far-to-near and painted in that order (painter's algorithm),
which is correct here because no parts interleave. Brightness comes from screen
orientation and depth, standing in for the lighting the game gets from its scene.

### Wheel placement

The wheel nodes in the GLB carry their own translations (`[0,1,-N]`), which are
**storage slots for the 12 variants**, not car positions. Using them directly
makes the wheels float away from the body. The extraction step therefore drops
each part's root translation and records hub positions read from the body's wheel
arches, and the projector places the wheel mesh at each hub.

## Measured cost

| Step | Cost | Frequency |
| --- | --- | --- |
| Draco decode | ~80 ms | once, offline |
| Mesh extraction | seconds | once, after a game update |
| Project + sort one car | **~0.14 ms** | per car drawn |

For comparison, driving the real game headlessly to screenshot a car takes about
**8.6 seconds** per car. Local projection is roughly 60,000x faster and needs no
browser, no network and no GPU.

## Accuracy, and its limits

Correct:
- the real body, wheel and wing geometry
- per-player colours applied to the right materials

Approximate:
- **pattern placement.** The atlas artwork is known and used, but the panel
  coordinates inside those files are degenerate placeholders the game fills in
  from the mesh's UV attribute at runtime. Stripes therefore appear on the car,
  not necessarily in the game's exact positions.
- **wheel and exhaust variants.** The style selects one, and the mesh ships 12
  wheel and 8 exhaust variants. Variant 0 is currently drawn for all styles, so
  two players with different rims look the same.
- **lighting.** Face shading approximates the game's scene lighting.

Because of the first point, a native PNG render remains the exact answer. The
projected render is the fallback for styles that have no PNG, which is currently
almost all of them.

## Regenerating after a game update

```bash
# 1. fetch the new assets into public/
curl -o public/models/car.glb https://app-polytrack.kodub.com/<ver>/models/car.glb
# (and lib/draco/draco_decoder.wasm, draco_wasm_wrapper.js, images/pattern_*.svg)

# 2. re-extract
node scripts/extract-car-mesh.mjs

# 3. verify
npx vitest run src/lib/carProject.test.ts
```

The extraction script refuses to write output if fewer than 100 triangles decode,
so a broken Draco decode cannot silently replace good geometry.

## Appendix: how this was worked out

Findings that led here, recorded so they do not need rediscovering.

**The car is not drawn from an image endpoint.** An early investigation assumed a
per-player image URL, because DevTools showed a `data:image/png` on the car
element. That is the `img.src` the game assigns after rendering, not a fetch.

**Nor is `carStyle` fetched per player.** It arrives as a field on every
leaderboard entry, which is how the catalog stores it.

**Bundle module 3787** is the thumbnail generator: it builds a 200x200 canvas, a
`Scene`, a `PerspectiveCamera(-1,1,1,-1,.1,1e4)`, a `CarModel`, sets the camera
to `(1000.1,1000.3,1000)` looking at `(.1,.3,0)` with `zoom = .5`, calls
`setCarStyle`, and returns `canvas.toDataURL()`.

**Hooks on `webpackChunk` never fire.** The bundle assigns
`n.push = t.bind(null, n.push.bind(n))`, so a `push` override is replaced before
any chunk is pushed. The module map is consumed by an inline IIFE instead. Driving
the real page and reading the rendered `<img>` elements out of the DOM is the
approach that works, and it is what `scripts/render-cars.mjs` does.

**Porting three.js was estimated at ~320 KB** (car model 34 KB, camera 27 KB,
engine 255 KB). Projecting the extracted mesh avoids that entirely.
