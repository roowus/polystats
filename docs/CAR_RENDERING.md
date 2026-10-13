# Car rendering: findings and options

## What PolyTrack actually does

The game renders car thumbnails **entirely client-side**, with its own WebGL
scene. The generator lives in the game bundle (module `3787`, exported as a
function taking `(carStyle, game, opts)`):

```js
// reconstructed from main.bundle.js
l = document.createElement("canvas"); l.width = 200; l.height = 200;
c = new Scene(l, null, false);                 // WebGL renderer
h = new PerspectiveCamera(-1, 1, 1, -1, .1, 1e4);
c.scene.add(h); c.setCamera(h);
o = new CarModel(null, {position, quaternion}, ..., c, ...);
h.position.copy(opts.position ?? new Vector3(1000.1, 1000.3, 1000));
h.lookAt(opts.look ?? new Vector3(.1, .3, 0));
h.zoom = opts.zoom ?? .5;
o.setCarStyle(carStyle);
c.update(new Time());
return l.toDataURL();          // <- the data:image/png;base64,… you saw
```

Key points:
- It is **not an HTTP API**. There is no URL that returns a car PNG; every car
  image you have seen was produced in a browser by this code.
- It needs a live game instance (`game.addCancelCallback`).

## Why we did not bundle it

Measured dependency closure from the minified bundle:

| Piece | Size |
| --- | --- |
| Car model class (module 641) | 34 KB |
| Camera/controller (module 1507) | 27 KB |
| Core engine: Vector3, Quaternion, PerspectiveCamera, WebGL renderer, scene graph, meshes (module 4922) | **255 KB** |
| Plus car texture assets referenced by the material | n/a |

**~320 KB of engine code**, wired through the bundle's internal private-field
helpers (`R.gn`, `l.GG`), `WeakMap` state, and a game-instance argument. It is
extractable in principle, but it is effectively porting the game engine, and it
would break on every PolyTrack update.

## Options

1. **SVG approximation (current).** `CarPic` decodes the 16-byte `carStyle`
   (pattern, rims, exhaust, four RGB colours) and draws a stylised top-down
   open-wheel car in those exact colours. Instant, no dependency, never breaks.
2. **Hidden game iframe.** Load `app-polytrack.kodub.com` offscreen and call the
   real generator per player, caching the PNGs in D1/R2. Pixel-exact, but pulls
   ~1.8 MB into the page and needs fragile wiring into the game's internals.
3. **Bundled car-only renderer.** Extract the car mesh + materials + engine math
   (~320 KB) and ship it. Exact body shapes, but days of reverse-engineering and
   ongoing maintenance against game updates.

Rail-relative costs and the fact that the car is a *28px icon* in our UI are why
option 1 remains the default. Option 2 is the best exactness/effort tradeoff if
pixel-accurate cars become a requirement.
