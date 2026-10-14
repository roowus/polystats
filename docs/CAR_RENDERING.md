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

### Orientation

Earlier versions picked the camera and the up vector separately and adjusted one
to cancel the other. That worked on the silhouette, which looks car-shaped either
way, and hid a mirrored, upside-down car: the nose pointed the wrong way and the
paint was reflected.

Both are now derived from the game's own camera instead of chosen. The engine
places the eye at `(1000.1, 1000.3, 1000)` looking at `(0.1, 0.3, 0)`, so:

- the look direction is an even `(-1, -1, -1)`
- the eye offset — car back to viewer — is `(+1, +1, +1)`
- `right = cross(lookDirection, worldUp)` and `up = cross(right, lookDirection)`,
  the ordinary right-handed basis, with no screen-Y flip

The nose is at `+Z` (it is the narrow, low end; the tail carries the wide rear
wing), so an eye on the `+Z` side looks at the front of the car, which is what the
game's thumbnails show.

Tests pin the end that faces the viewer by measuring the mesh's cross-section at
each end rather than asserting the sign of a component, which is what let two
wrong values through.

### Camera

The game's thumbnail camera uses a frustum so wide (`-1,1,1,-1` at `near .1`) that
it is effectively **orthographic**. `carProject.ts` adds a mild perspective divide
on top, because a flat projection draws the near and far wheels the same size and
the car reads as deformed without it. `CAMERA_DISTANCE` sets how strong that is.

### Ordering and shading

Polygons are sorted far-to-near and painted in that order (painter's algorithm),
which is correct here because no parts interleave. Brightness comes from screen
orientation and depth, standing in for the lighting the game gets from its scene.

### Wheel placement

The wheel nodes in the GLB carry their own translations (`[0,1,-N]`), which are
**storage slots for the 12 variants**, not car positions: the whole wheel library
is parked one unit apart along `-Z`, with `Wheel0` a full unit *above* the body.
Using those transforms directly makes the wheels float away from the car, so the
extraction step ignores them, re-centres each variant on the origin, and records
hub positions measured from the model:

- **Axle stations** come from the `Suspension` mesh, which is modelled as four
  axle ends at `z = +/-1.5`. Deriving them from a body-width heuristic put the
  wheels at the wrong stations.
- **Track width** comes from the same mesh's X extent, `+/-0.584`, tucked just
  inside the widest bodywork. A car has one track; deriving it per axle made the
  front wheels wider than the rear and read as a car facing backwards.
- **Hub height** is the body's floor line, `y = -0.3444`, which puts the contact
  patch one radius below it and rests the car on its tyres. Putting the hub at
  `bodyMin.y + radius` sank the wheels into the shell; reading the suspension
  box's own minimum pushed them clear of the car, because its arms hang below the
  contact patch.

### Wheel and exhaust variants

The style's `rims` byte selects one of twelve wheel designs and `exhaust` one of
eight tail pipes. `projectCar(size, rims, exhaust)` takes both. The tyre is
byte-identical across all twelve wheel variants, so it is stored once in
`sharedTyre` and the variants carry only rim and hub art, which keeps the
geometry file at 193 KB instead of 263 KB.

### Undrawn geometry

The model ships a zero-thickness plane (`Body_3`) lying exactly on the body's
floor and spanning the whole car. The game composites it as a shadow catcher;
projected flat it becomes a slab covering the entire car, so it is excluded. It
has to be measured by hand: Draco decodes to an interleaved attribute, for which
`Box3.setFromBufferAttribute` returns an empty box.

`Collision` is likewise never drawn.

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
