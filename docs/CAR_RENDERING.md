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

## Solved: drive the real client and harvest the renders

The blocker was never that the renderer is unreachable. It is that PolyTrack only
calls `carThumbnail()` while building **leaderboard player rows**, and a fresh
headless session has no such rows on screen.

Two corrections to earlier assumptions in this document:

- **`carStyle` is not served per player by an image endpoint.** It arrives as a
  field on every leaderboard entry from
  `https://vps.kodub.com/v6/leaderboard?version=0.6.3&trackId=…`, alongside
  `nickname` and `frames`. The endpoint is public and needs no token.
- **Drive the UI instead of reimplementing it.** A headless Chromium running the
  real game opens a leaderboard, the game renders each row's car with its own
  WebGL scene, and the resulting PNGs are read straight out of the DOM.

The rendered `<img>` carries a `data:image/png;base64,…` URL at the native
200x200. DOM order matches leaderboard entry order, so entry *N*'s `carStyle`
pairs with the *N*th rendered image — that mapping is what lets the output be
cached by style rather than by player.

`scripts/gen-car-pngs.mjs` implements this:

```bash
node scripts/gen-car-pngs.mjs --tracks 4 --limit 10
```

It writes `public/cars/<carStyle>.png`, regenerates
`src/lib/nativeCarStyles.ts`, and takes roughly three minutes for 22 unique cars
at about 12 KB each.

## Performance characteristics

Rendering happens **offline, as a build step**, never per request. Nothing about
serving the site starts a browser.

| Metric | Value |
| --- | --- |
| Generator wall time | ~190 s for 4 tracks / 22 unique cars |
| Cost per car | ~12 KB PNG, 200x200 RGBA |
| Runtime cost to serve | one static file request, cached `immutable` for a year |
| Client cost | none, a plain `<img>` |

The reason this must stay offline: a headless Chromium with WebGL costs hundreds
of MB of RAM and seconds of CPU. Doing that on demand would be far more
expensive than rendering the car in the browser ever was.

Two deliberate limits: the harvest only covers styles that actually appear on the
scanned leaderboards, so coverage grows as more tracks and pages are scanned; and
a style with no PNG falls back to the SVG below rather than requesting a missing
file.

## Decision

Native PolyTrack renders, keyed by `carStyle`, generated offline into
`public/cars/` and served as static files. `CarPic` prefers the native PNG and
falls back to the SVG schematic for styles not yet harvested, so the UI never
shows a broken image.

The earlier "keep the SVG only" conclusion is superseded: harvesting avoids the
~320 KB engine port entirely and produces the game's real output. The tradeoff is
a regeneration step when the catalog should expand, which is why the fallback
stays in place.
