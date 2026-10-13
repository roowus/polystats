# Car rendering: findings, experiments and decision

## What PolyTrack does (verified from main.bundle.js)

The game renders car thumbnails **client-side only**, with its own WebGL scene.
Generator lives in bundle module `3787`, exported as `carThumbnail(carStyle, game, opts)`:

```js
l = document.createElement("canvas"); l.width = 200; l.height = 200;
c = new Scene(l, null, false);          // WebGL renderer
h = new PerspectiveCamera(-1, 1, 1, -1, .1, 1e4);
c.scene.add(h); c.setCamera(h);
o = new CarModel(null, {position, quaternion}, ..., c, ...);
h.position.copy(opts.position ?? new Vector3(1000.1, 1000.3, 1000));
h.lookAt(opts.look ?? new Vector3(.1, .3, 0));
h.zoom = opts.zoom ?? .5;
o.setCarStyle(carStyle);
c.update(new Time());
return l.toDataURL();                   // the data:image/png;base64,… bytes
```

Its two call sites (leaderboard rows, replay list) both:
- key a cache on `carStyle.serialize()` (so identical styles render once),
- show `images/car_thumbnail_placeholder.png` until the render resolves,
- take the car style from the leaderboard entry.

**The input is the player's `carStyle` — the same 16-byte string PolyStats already
stores for every player. There is no user-ID lookup and no HTTP endpoint.**

## Why the `data:image/png` looked like a fetch

`img.src = dataUrl` shows up in DevTools as a request-like entry. It is the
*output* of `canvas.toDataURL()`, not a network call. Nothing to call server-side.

## Headless experiments (all run, results recorded)

| Experiment | Result |
| --- | --- |
| Boot `app-polytrack.kodub.com/0.6.3/` in headless Chromium | ✅ Works |
| Read module registry via `window.webpackChunk` after boot | ❌ Empty — webpack consumes/clears it, module `3787` unreachable |
| Hook `webpackChunk` via `addInitScript` before entry runs | ❌ Hook not triggered (chunk array created before the hook installs) |
| Harvest `data:image` car thumbnails from the booted page | ❌ Main menu renders only DOM icons; cars render later on canvas-driven screens |

## Dependency closure if porting instead

| Piece | Size |
| --- | --- |
| Car model (module 641) | 34 KB |
| Camera/controller (module 1507) | 27 KB |
| Core engine: Vector3, Quaternion, PerspectiveCamera, WebGL renderer, scene graph (module 4922) | **255 KB** |
| Car texture assets | n/a |

≈320 KB of engine, wired through the bundle's private-field helpers and needing a
live game instance. Only reasonable with automated extraction per game release.

## Decision

**Keep the SVG renderer (`CarPic`).** It decodes the real 16-byte `carStyle`
(pattern, rims, exhaust, four RGB colours) and draws the car in the player's
exact colours. It costs ~2 KB, renders instantly, and never breaks on game
updates.

Reproducing the pixel-exact render requires either driving the game's canvas UI
headlessly (needs a canvas-aware harness, and would need re-verification on every
game release) or porting ~320 KB of engine. Neither is justified for a 28px icon;
revisit only if a large, prominent car view becomes a core feature.
