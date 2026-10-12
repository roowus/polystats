# PolyTrack API — Reverse-Engineered Reference (v6, game 0.6.3)

Everything below was extracted from the official game client
(`https://app-polytrack.kodub.com/0.6.3/main.bundle.js`) and verified with live
requests. Last updated: 2026-10-12.

## 1. Basics

| | |
|---|---|
| **Base URL** | `https://vps.kodub.com/v6/` |
| **Version param** | every endpoint requires `version=0.6.3` (must match a game version the server knows) |
| **Origin lock** | the server returns **403** unless the request carries `Origin: https://app-polytrack.kodub.com`. Any other origin → 403, no `Origin` → 403. CORS is `Vary: Origin` and only echoes the game origin. |
| **CORS preflight** | `OPTIONS` → 204 with `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE` |
| **Timeouts** | the game uses 20 s for leaderboard/user calls, 60 s for uploads, 10 s for admin lists |
| **Format** | request/response bodies are JSON (GET query params; POST is `application/x-www-form-urlencoded`) |

Consequence for third-party sites: you **must** proxy through a server that sets
the `Origin` header — see `worker/` in this repo.

## 2. Endpoints

### 2.1 `GET /v6/leaderboard`

```
?version=0.6.3
&trackId=<64-char hex>      required
&skip=<int>                 pagination offset (default 0)
&amount=<int>               page size
&onlyVerified=<true|false>
&userTokenHash=<hex>        optional — SHA-256 of a user token; adds `userEntry` to the response
```

Response:

```jsonc
{
  "total": 6737173,                       // total entries for the track
  "entries": [ { ...Entry } ],            // page of entries, sorted best time first
  "userEntry": {                          // only when userTokenHash was given
    "position": 1, "frames": 22123, "verifiedState": 1, "id": 59372564
  }
}
```

Notes:
- With `userTokenHash`, `entries` still comes back (currently appears to return
  the page at `skip`, *not* centered on the user) and `userEntry` is `null` when
  the user has no entry on the track.
- The classic two-step "find position, then fetch exact page" flow works:
  1. `amount=1&userTokenHash=<hash>` → `userEntry.position`
  2. `skip=position-1&amount=1` → full entry with `nickname`/`carStyle`.

### 2.2 `GET /v6/leaderboardUserEntry`

```
?version=0.6.3&trackId=<hex>&userTokenHash=<hex>&onlyVerified=<bool>
```

Response: a single object (not wrapped) with the user's best entry:

```jsonc
{ "position": 4, "frames": 25245, "id": 12345678 }
```

`null` when the user has no entry. Lighter than the two-step leaderboard flow if
you only need rank + time.

### 2.3 `GET /v6/user`

```
?version=0.6.3&userToken=<token>
```

The `userToken` is the secret token stored in the player's browser
(localStorage `polytrack_v4_prod_user_…`). The client hashes it with SHA-256 to
derive the public `userId` used everywhere else.

Response:

```jsonc
{
  "nickname": "Monstrosity",
  "countryCode": "de",          // string or null
  "carStyle": "AAQAAAAAAI4AU44AUwAAAA",  // serialized car style (see §4)
  "isVerifier": true            // boolean
}
```

Unknown token → `null` body. Validation in the client: nickname length
1–50 after UTF-8 trimming; countryCode must be a 2-letter code or null.

### 2.4 `POST /v6/leaderboard` (submit a record)

Form body:

```
version=0.6.3
userToken=<token>
nickname=<nickname>
countryCode=<code>            optional
carStyle=<serialized>
trackId=<hex>
frames=<int>                  final time in ms
recording=<serialized input recording>
onlyVerified=<bool>           optional
```

Server validates the recording against the deterministic physics; timings that
don't replay correctly are rejected.

### 2.5 `POST /v6/user` (update profile)

```
version=0.6.3&userToken=<token>&nickname=<nickname>[&countryCode=<code>]&carStyle=<serialized>
```

200 on success.

### 2.6 `GET /v6/recordings`

```
?version=0.6.3&ids=<id1>,<id2>,...      entry ids from the leaderboard
```

Response: array aligned with the requested ids; `null` items where a recording
isn't available:

```jsonc
[ { "recording": "<serialized>", "verifiedState": 1, "carStyle": "…", "frames": 22123 }, null ]
```

The game only requests recordings after its determinism check passes.

### 2.7 `POST /v6/verifyRecordings` (verifiers only)

`version`, `userToken`, optional `trackId`, plus recording verdicts. Requires
`isVerifier: true` on the account.

### 2.8 `GET /v6/trackOfTheWeek`

```
?version=0.6.3
```

Response:

```jsonc
{
  "serverTime": "2026-10-12T19:11:18.478Z",
  "current": {
    "trackId": "bcc7ad7c…",                  // 64-hex, usable with /leaderboard
    "name": "Velvoire",
    "author": "Jurre",
    "lastModified": "2026-10-09T22:42:56.000Z",
    "environment": 0,                        // 0 summer, 1 winter, 2 desert
    "thumbnailUrl": "https://vps.kodub.com/v6/trackOfTheWeek/image/<hex>",
    "coverUrl": "https://vps.kodub.com/v6/trackOfTheWeek/image/<hex>",
    "trackUrl": "https://vps.kodub.com/v6/trackOfTheWeek/track/<hex>",  // .track binary
    "endTime": "2026-10-18T20:00:00.000Z"    // weekly rotation
  }
}
```

`GET /v6/trackOfTheWeek/image/<hex>` → PNG thumbnail/cover.
`GET /v6/trackOfTheWeek/track/<hex>` → track file (binary, gzipped container).

### 2.9 Verifier/admin

- `GET /v6/admin/trackOfTheWeekList?version&userToken`
- `POST /v6/admin/trackOfTheWeek` (`version`, `userToken`, `epoch`, …)

Require a verifier token; not usable for read-only stats.

### 2.10 Realtime (documented for completeness)

- `wss://vps.kodub.com/v6/multiplayer/host`
- `wss://vps.kodub.com/v6/multiplayer/join`
- `GET /v6/ice` — TURN/STUN credentials for WebRTC

The game refuses all multiplayer/recording features unless its **determinism
check** passes (pure-JS physics replay must match native). Not relevant for
read-only stats use.

## 3. Data types

### Entry object (leaderboard `entries[]`)

```jsonc
{
  "id": 59372564,                 // record id (int) — used with /recordings
  "userId": "645dae…<64 hex>",    // SHA-256 of the user's token (public id)
  "nickname": "Monstrosity",
  "countryCode": null,            // ISO-3166 alpha-2 or null
  "carStyle": "AAQAAAAA…",        // base64, 16 bytes (see §4)
  "frames": 22123,                // ⚠ misleading name: this is MILLISECONDS
  "time": "2026-10-09T08:22:09.000Z",  // submission timestamp (ISO-8601)
  "verifiedState": 1
}
```

- **`frames` is the race time in ms** (the client formats it `mm:ss.mmm`).
- **`verifiedState`**: `0` = unverified, `1` = verified, ≥2 = other/pending
  (client only special-cases 1; `onlyVerified=true` returns state-1 entries).
- Ranks are **not** in the response — position = array index + `skip + 1`.
  "Percentile" (e.g. top X%) must be computed as `position / total`.

### Track id

64-char lowercase hex — a content hash of the track file. IDs from the 0.5.x
era are invalid; every game update re-issued the official tracks' ids.
Custom/community tracks uploaded in-game also use this scheme.

### Environment enum

`0` Summer · `1` Winter · `2` Desert (used in track metadata and
`trackOfTheWeek`). (Separate internal enum for car livery environments:
0 Default, 1 Summer, 2 Winter, 3 Desert, 32+ Custom.)

### Car style (`carStyle`)

Base64 of 16 bytes:

| bytes | meaning |
|---|---|
| 0 | version, must be `0` |
| 1 | pattern id |
| 2 | rims id |
| 3 | exhaust id |
| 4–6, 7–9, 10–12, 13–15 | four RGB colors (R,G,B), little-endian 24-bit |

Decode (legacy 24-hex `carColors` = `RRGGBB`×4):
`atob(style)` → bytes → for c in 0..3: `hex(b[4+3c]) + hex(b[5+3c]) + hex(b[6+3c])`.

Example `AAQAAAAAAI4AU44AUwAAAA` → pattern 4, colors `000000 8e0053 8e0053 000000`.

### User id

`userId = SHA-256(userToken)` as lowercase hex — computed client-side, so you
can derive it from a token without any API call (`sha256Hex` in
`src/lib/polytrack.ts`).

## 4. Track catalog (game 0.6.3)

Both lists ship inside the game bundle; ids verified live against the
leaderboard API. Canonical source: `src/lib/tracks.ts`.

### Official (career) — 17 tracks, author Kodub

| Track | ID |
|---|---|
| Summer 1 | `5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038` |
| Summer 2 | `7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0` |
| Summer 3 | `148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a` |
| Summer 4 | `93c7363dfea7fb09ca1d23b72cad5df43a30841d41c8ff25fb544c85bb03c7ae` |
| Summer 5 | `7603aaeffa1989a649dfaa8e1804bed4481b49df233e377687d0669899566e52` |
| Summer 6 | `c117823cf6788e3247b9ee63a0c091c07352bbe352c650a7790dc6718148c2fa` |
| Summer 7 | `e4bcaca3a583bb0eb62a700a69d14e89c852f0c5bf740fca76e0519ebdfc9ab1` |
| Winter 1 | `7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7` |
| Winter 2 | `99864b635d1891d22e17eb9267527a07a92c49c0f02893729fa2ded90e3ca0f9` |
| Winter 3 | `a5341fe706097cff2a3812a3fc0d87399254557328351ae8e5c882700fc1a196` |
| Winter 4 | `7d134c939df80c676a258266201beedd3b93572d5603f3ff4339ff8679803715` |
| Winter 5 | `2fe4bd46b0075cc25fc770ce50adbb68447cf493c999635bb272d231811dd264` |
| Desert 1 | `c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34` |
| Desert 2 | `88647ea04145fbbbb19b55f1590e038fb0378acb2571110f02cb545cc46b0d57` |
| Desert 3 | `2806030c503abb41a1a26fa9a570888be14296172bb273798ef0ad87a108a2ec` |
| Desert 4 | `4697ea67b18c3f49b30a3d8884602115536650bc5435c88e3732e64d21a72d33` |
| Desert 5 | `e5d084e06db4ab71196fea44efeceb23c8561266a78669c324a38f92581fe2db` |

Official tracks are grouped in-game by career section; the bundle tags each
with the game version it debuted in (e.g. Summer 1–7 = "0.6.0" era; Desert 5 /
Winter 5 are the newest pair).

### Community (featured) — 46 tracks

Shipped in `tracks/community/*.track` with thumbnails, tagged with the version
that added them:

- **0.6.1**: Amberbound (summer), Star Bound (desert)
- **0.6.0**: Arx Lucida, Koselig, Sky Bound, ShardMir, 𝔖𝔱𝔢𝔦𝔫𝔴𝔞𝔩𝔩𝔟𝔲𝔯𝔤,
  𝕻𝖆𝖗𝖆𝖉𝖎𝖘𝖊 𝕻𝖆𝖑𝖆𝖈𝖊, Sunken Glyphs, Grimspyre, Magenta Mines, Cruising Altitude,
  Termite Terror, Lost at sea, Frosted Fjords 寒い, 〜✧〜Ḽevitation〜✧〜,
  Frozen Ramparts, Tangled Cliffs, Sludge Pipe Circuit
- **0.5.2**: Zealot, Shrouded Oasis, ⚙︎Cogware⚙︎, Land of the Rising Sun,
  Midas Metropolis, Frozen In Time, Winterfell, Launch Control
- **0.5.1**: Ghost City, MOS ESPA, Joenail Jones, Anubis, Natsujō
- **0.5.0**: Arabica, Hyperion's Sanctuary, Winter Hollow, Clay temples,
  Las Calles, DESERT STALLION, Last Remnant, lu muvimento, 90*RESET,
  Opal Palace - Repolished, Sandline Ultimatum, Malformations, Snow Park,
  concrete jungle

Full ids in `src/lib/tracks.ts` (all verified live).

### Dynamic track sources

- **Track of the Week** — `GET /v6/trackOfTheWeek` (§2.8), rotates weekly
  (`endTime`), has its own leaderboard via the normal endpoint.
- **Custom tracks** — uploaded in-game; their ids only become known via
  user-generated content (no public listing endpoint).

## 5. Historical / other endpoints (pre-v6, for reference)

`https://vps.kodub.com/leaderboard` (no `v6/`) — 0.5.x era API, now 403 for
every request shape we tried. If you find cached 0.5.x track ids anywhere,
they're dead; the ids rotated with 0.6.0.

## 6. gotchas checklist for third-party use

1. Proxy with `Origin: https://app-polytrack.kodub.com` (see `worker/`).
2. `frames` = milliseconds. `formatTime` = `mm:ss.mmm` (hours spill to minutes).
3. Rank math is yours: `position = skip + index + 1`; percentile = `position/total`.
4. `userTokenHash` ≠ `userToken`: hash SHA-256 client-side; never send the raw
   token to anything but `/v6/user` and the POST endpoints.
5. `onlyVerified` expects the literal `true`/`false`.
6. Track ids are version-sensitive — re-extract on every game update
   (the extraction regex in this doc's history works against any bundle).
