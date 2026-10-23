# Diagram: database schema, queries and data flow

`database-flow.svg` (and a 2x `database-flow.png`) model the D1 schema, every
worker route, and which job writes which table. Generated from the live worker
source in `roowus/polystats-proxy`, not from memory.

Reading it top to bottom:

1. **External sources** - the PolyTrack API and game client, the schedulers
   (Cloudflare crons, cron-job.org, UptimeRobot), the browser, and the offline
   car-render job.
2. **Worker routes** - read routes used by the SPA, write routes used by the
   schedulers, and the static `/car/<style>.png` route served from R2.
3. **D1 schema** - every table with its columns, marking primary keys in gold
   and cross-table references in blue.
4. **Background writes** - what each job does and which tables it touches.
5. **Read budget** - the Oct-23 outage: cause and fix.

## Keeping it accurate

The schema is the source of truth in `worker/index.ts` (`ensureSchema`). If you
add a table, column or route, update this diagram in the same change. The
`meta` table drives cursor and migration flags, so changes there are worth
checking against the diagram too.

## Regenerating the PNG

The PNG is a rendered raster. To refresh it after editing the SVG, open the SVG
in a browser at 2x scale and screenshot it. Any converter works, for example:

```bash
npx svgexport docs/diagrams/database-flow.svg docs/diagrams/database-flow.png 2x
```

## Note on embedding

Keep `<style>` as a direct child of `<svg>`, not inside `<defs>`. Chromium can
stall when rendering an SVG where a class-selector stylesheet sits inside
`<defs>` next to `<marker>` elements, which hangs headless screenshot tools.
