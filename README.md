# PolyStats

Statistics dashboard for [PolyTrack](https://www.kodub.com/apps/polytrack) — look up
user stats across every official and community track, browse leaderboards, and find
user IDs by rank.

Built with React 19, TypeScript, Vite and Tailwind CSS v4.

## How it works

PolyStats talks to the PolyTrack leaderboard API (`https://vps.kodub.com/v6/`,
game version **0.6.x**). That API only serves requests whose `Origin` header is the
game's own origin, so browser requests from this site must go through a small CORS
proxy that adds the correct `Origin` header (see [`worker/`](worker)).

### Key modules

| Module | Purpose |
| --- | --- |
| `src/lib/polytrack.ts` | API client: URL builders, typed fetchers, response normalisation, car-style decoding, time formatting |
| `src/lib/tracks.ts` | Track catalog (17 official + community tracks) with the current v6 track IDs |
| `src/components/` | UI: user stats viewer, leaderboard browser, utils (user-ID finder) |

The proxy URL is resolved in this order:

1. `localStorage["polystats_proxy_url"]` (runtime override)
2. `VITE_PROXY_URL` build-time environment variable
3. `DEFAULT_PROXY_URL` in `src/lib/polytrack.ts`

## Deploying the proxy

The bundled Cloudflare Worker is the easiest option:

```bash
cd worker
npx wrangler deploy
```

Then build the app with the resulting URL:

```bash
VITE_PROXY_URL="https://polystats-proxy.<your-subdomain>.workers.dev/?url=" npm run build
```

The worker only proxies `https://vps.kodub.com` — it is not an open proxy.

## Development

```bash
npm install
npm run dev        # start dev server
npm test           # run Vitest suite
npm run test:watch # watch mode
npm run lint       # ESLint
npm run build      # type-check + production build
```

## Tests

The Vitest suite covers the API client (URL building, response normalisation,
car-style decoding, time formatting, hashing), the track catalog, the proxy worker,
and component rendering. CI (`.github/workflows/ci.yml`) runs type-check, lint,
tests and build on every push and pull request.

## API notes (v6)

- Base: `https://vps.kodub.com/v6/`, every request includes `version=0.6.3`
- `GET leaderboard?trackId&skip&amount&onlyVerified[&userTokenHash]` →
  `{ total, entries, userEntry }`
- `GET user?userToken` → `{ nickname, countryCode, carStyle, isVerifier }`
- `GET leaderboardUserEntry?trackId&userTokenHash&onlyVerified`
- `GET recordings?ids=a,b,c`
- `GET trackOfTheWeek`
- Entry times are milliseconds (field `frames`); entries expose `nickname` and a
  serialized `carStyle` string, which this app normalises to `name` and four
  hex `carColors`
- Track IDs are 64-character hex hashes; track IDs from the old 0.5.x API no
  longer resolve
