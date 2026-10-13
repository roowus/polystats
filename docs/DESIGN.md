# PolyStats design language

The single source of truth for UI in this repo. Every component must follow
these rules; new pages should reuse the primitives in
[`src/components/ui-system.tsx`](../src/components/ui-system.tsx) and
[`src/components/shell.tsx`](../src/components/shell.tsx) rather than
hand-rolling styles.

## 1. Shape

- **Square corners everywhere.** No `rounded-*` classes on app components.
  (Shadcn primitives have had their radii stripped to match.)
- **Parallelograms are navigation-only.** `pt-skew` is used in the top bar
  tabs and nowhere else.
- Cards, tables and panels are plain flat rectangles with a 2px border.

## 2. Colour

Only three PolyTrack shades plus white text:

| Token | Value | Used for |
| --- | --- | --- |
| base | `#212b58` | page background, nav bar |
| panel | `#102052` | panels, cards, **and input/select fields** |
| accent | `#1a2450` | selected chip / nav tab fill |
| timestamp | `#d9b878` | "data as of" lines |

Borders: `border-white/10` by default, `border-white/25` for the **selected**
state. Never pure white, never bright or neon rings, never purple/blue accents.

Text: white primary; `#e2e2f0` secondary; `#cfcfe4` tertiary. No gray-on-gray.

## 3. Type

- Body font is **ForcedSquare** (self-hosted, see `public/forced_square.woff2`),
  applied to body text, inputs, and numeric/time values.
- Page titles: `font-game`, uppercase, 4xl-5xl.
- Panel section headers: `SectionHeader` (2xl, uppercase, tracking-wide, 2px
  underline border).
- Numbers and times keep `tabular-nums` for column alignment.

### Scale

Use the `TEXT` tokens in `src/components/shell.tsx`. Do not hand-write sizes.

| Token | Size | Used for |
| --- | --- | --- |
| `TEXT.title` | 36-48px | page title |
| `TEXT.heading` | 24px | panel / section heading |
| `TEXT.value` | 24px | stat and metric values |
| `TEXT.body` | 16px | default body copy |
| `TEXT.muted` | 15px | secondary copy |
| `TEXT.label` | 13px | stat labels, table headers, small caps |
| `.text-timestamp` | 14px | "Data as of" lines |

**13px is the floor.** Nothing on the site renders smaller. Earlier revisions
used 10-11px labels next to 16-40px panel padding, which read as mostly empty
boxes; sizes are deliberately paired with tight padding now.

### Padding

Panels are dense on purpose. A single line of text gets a compact strip
(`px-4 py-5`), not a tall box. Reserve `p-4`/`p-5` for panels with several rows
of content, and avoid `p-8`+ entirely.

## 4. Components

| Primitive | Purpose |
| --- | --- |
| `PageShell` / `PageTitle` | page chrome: background, max-width container, title block |
| `Panel` | flat panel (2px border, panel shade) |
| `StatTile` | label + value metric tile |
| `Chip` | filter/selector chip; identical active state on every page |
| `SortButton` | small sort switcher used beside chips |
| `SectionHeader` | header row inside a panel |
| `TextField` | standard text input (panel shade) |
| `Freshness` | tan "Data as of …" timestamp line |
| `MedalBadge` | medal pill |
| `Spinner` / `ErrorNote` | loading and error states |

## 5. Layout

- Every page renders `<Navigation />` then `<PageShell>` with a `PageTitle`.
- Content container: `mx-auto max-w-6xl px-4 py-10 sm:px-6` (inside `PageShell`).
- Tables live in a `Panel` with `SectionHeader`; row hover is `hover:bg-white/5`.

## 6. Motion

- One entrance animation: the `pt-enter` class (fade + 10px rise).
- Respect `prefers-reduced-motion` (handled globally in `index.css`).
- No layout-thrashing animations, no springy scale effects on page content.

## 7. Known platform limitation: car images

PolyTrack has **no API that returns a car PNG**. The game renders car
thumbnails client-side: the renderer takes a `carStyle`, draws it with WebGL,
and calls `canvas.toDataURL()` (verified in `main.bundle.js`). Anything you see
as a `data:image/png;base64,…` car image was produced in-browser by that
renderer.

PolyStats therefore draws an approximation: `CarPic` decodes the 16-byte
`carStyle` (pattern, rims, exhaust, four RGB colours) and renders a stylised
top-down open-wheel car in SVG using those colours. Replacing this with the
exact game render would require porting the game's WebGL car renderer.
