/**
 * PolyTrack car image.
 *
 * Prefers the game's own native render, served from R2 by the worker at
 * `/car/<carStyle>.png`. Those images are produced offline by
 * `scripts/render-cars.mjs`, which drives the real PolyTrack client.
 *
 * A style with no render yet falls back to `CarSvg`, which draws from the same
 * data the game uses (see below).
 */
import { useEffect, useMemo, useState } from 'react';
import { decodeCarSpec, getProxyUrl } from '@/lib/polytrack';
import { projectCar, polygonShade, depthRange } from '@/lib/carProject';

/** Worker origin, derived from the configured proxy URL. */
function workerOrigin(): string {
  return getProxyUrl().split('?')[0].replace(/\/$/, '');
}

/** URL of a style's native render. Always returns a URL; a miss falls back. */
export function carImageUrl(carStyle?: string | null): string | null {
  if (!carStyle) return null;
  return `${workerOrigin()}/car/${encodeURIComponent(carStyle)}.png`;
}

/** Lighten or darken a hex colour, for face shading. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v * factor)))
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Pattern artwork shipped with the game, indexed by the style's `pattern` byte.
 * These are the game's own SVG texture maps.
 */
const PATTERN_FILES = [
  'stripe', 'stripe2', 'stripe3', 'double_stripe', 'edge', 'half', 'arrow',
  'circle', 'horseshoe', 'needle', 'triangle', 'diamonds', 'zigzag',
  'circles', 'gradient', 'outline',
] as const;

/**
 * Recolour a pattern atlas into the player's palette.
 *
 * The game's pattern SVGs are flat artwork painted in placeholder colours, which
 * the engine substitutes in its shader: `#f00` is the primary (body) colour,
 * `#0f0` the secondary, `#00f` the frame and `#141414` a neutral shade. Drawing
 * the file unchanged therefore shows red and green stripes rather than the
 * player's paint, which is what an earlier version did.
 *
 * The `gradient` atlas also carries a few opaque green and olive patches that are
 * not placeholders (`#14ec00`, `#5a0`, `#986700`). Left alone they painted raw
 * green wedges onto the car whatever the player's colours were. They are wheel
 * well and vent detail, so they belong to the secondary.
 *
 * Substitution happens on the source text rather than through an SVG filter so
 * the result is exact, and the recoloured atlas is returned as a data URI that
 * the per-triangle clipping can sample.
 */
export function recolourPattern(atlasText: string, primary: string, secondary: string, frame: string): string {
  const recoloured = atlasText
    .replace(/<\?xml[^>]*\?>/, '')
    // Placeholders first: `#f00` before `#f0` style prefixes could match.
    .replace(/#f00(?![0-9a-fA-F])/g, primary)
    .replace(/#0f0(?![0-9a-fA-F])/g, secondary)
    .replace(/#00f(?![0-9a-fA-F])/g, frame)
    // Stray detail colours that ship in the gradient atlas.
    .replace(/#14ec00(?![0-9a-fA-F])/gi, secondary)
    .replace(/#986700(?![0-9a-fA-F])/gi, secondary)
    .replace(/#5a0(?![0-9a-fA-F])/gi, secondary);
  return `data:image/svg+xml;utf8,${encodeURIComponent(recoloured)}`;
}

/** Path of a pattern's atlas, by its index in the style byte. */
export function patternPath(pattern: number): string | null {
  const name = PATTERN_FILES[pattern];
  return name ? `/patterns/pattern_${name}.svg` : null;
}

/** Build a pattern tile as a data URI, recoloured to the car's palette. */
export function patternDataUri(pattern: number, primary: string, secondary: string): string {
  const name = PATTERN_FILES[pattern];
  if (!name) return '';
  // Fallback used before the atlas file has loaded: a plain two-tone gradient in
  // the player's colours, so the car is never left unpainted.
  const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
<linearGradient id="p" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${shade(primary, 0.72)}"/>
</linearGradient>
</defs>
<rect width="1024" height="1024" fill="url(#p)"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(fallback)}`;
}


/**
 * Affine transform mapping a pattern atlas onto a projected triangle.
 *
 * Solved from three UV/screen correspondences, which an affine map is exactly
 * determined by, and why the pattern is applied per triangle. UVs are a unit
 * square, so they are scaled to the atlas size first.
 *
 * Returns the six values of an SVG `matrix(a b c d e f)`.
 */
export function uvTransform(
  uv: [number, number][],
  pts: [number, number][],
  atlas: number
): number[] {
  const [U0, V0] = [uv[0][0] * atlas, uv[0][1] * atlas];
  const [U1, V1] = [uv[1][0] * atlas, uv[1][1] * atlas];
  const [U2, V2] = [uv[2][0] * atlas, uv[2][1] * atlas];
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[1];
  const [x2, y2] = pts[2];

  const det = (U1 - U0) * (V2 - V0) - (U2 - U0) * (V1 - V0);
  // Degenerate UV triangle: translate instead, so nothing vanishes.
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return [1, 0, 0, 1, x0 - U0, y0 - V0];

  const a = ((x1 - x0) * (V2 - V0) - (x2 - x0) * (V1 - V0)) / det;
  const b = ((y1 - y0) * (V2 - V0) - (y2 - y0) * (V1 - V0)) / det;
  const c = ((x2 - x0) * (U1 - U0) - (x1 - x0) * (U2 - U0)) / det;
  const d = ((y2 - y0) * (U1 - U0) - (y1 - y0) * (U2 - U0)) / det;
  return [a, b, c, d, x0 - a * U0 - c * V0, y0 - b * U0 - d * V0];
}

/** Paint colours per material, matching the game's named materials. */
const MATERIAL_FALLBACK: Record<string, string> = {
  Main: '#8b7cf0',
  Metal: '#8a8a96',
  Rim: '#d8d8e0',
  Tire: '#16161c',
  AirIntake: '#26262e',
  BrakeLight: '#c02020',
};

function shadeHex(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v * factor)))
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Car drawn from the game's real mesh.
 *
 * The geometry comes from `scripts/extract-car-mesh.mjs`, which decodes the
 * game's Draco-compressed model once, offline. Drawing is then pure arithmetic:
 * the mesh is projected to 2D and painted per material, with the body taking the
 * player's pattern and colours.
 *
 * This replaces an earlier hand-drawn silhouette, which did not resemble the
 * car. Using the actual mesh gives the real shape, wheel design and proportions.
 */
function CarSvg({ carStyle, size, className }: { carStyle?: string | null; size: number; className?: string }) {
  const spec = decodeCarSpec(carStyle ?? '');
  // The style's rims and exhaust bytes pick which art the car wears, so the
  // rendered car matches the one the player actually drives.
  const polys = useMemo(
    () => projectCar(size, spec?.rims ?? 0, spec?.exhaust ?? 0),
    [size, spec?.rims, spec?.exhaust]
  );
  const [minD, maxD] = useMemo(() => depthRange(polys), [polys]);

  const body = spec?.primary ?? MATERIAL_FALLBACK.Main;
  const accent = spec?.secondary ?? '#f4f4ff';
  const frame = spec?.frame ?? MATERIAL_FALLBACK.Metal;
  const rimColour = spec?.rimsColor ?? MATERIAL_FALLBACK.Rim;
  // The recoloured atlas is fetched and substituted at runtime, because the
  // placeholder colours live inside the SVG file and cannot be replaced from
  // outside when it is referenced by <image href>.
  const [atlas, setAtlas] = useState<string>('');
  const atlasPath = spec ? patternPath(spec.pattern) : null;
  useEffect(() => {
    if (!atlasPath || !spec) {
      setAtlas('');
      return;
    }
    let cancelled = false;
    fetch(atlasPath)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (cancelled) return;
        setAtlas(text ? recolourPattern(text, spec.primary, spec.secondary, spec.frame) : '');
      })
      .catch(() => {
        if (!cancelled) setAtlas('');
      });
    return () => {
      cancelled = true;
    };
  }, [atlasPath, spec?.primary, spec?.secondary, spec?.frame]);

  // Until the atlas arrives the body uses a flat gradient in the player's
  // colours, so the car is never left unpainted.
  const pattern = atlas || (spec ? patternDataUri(spec.pattern, body, accent) : '');
  const usingAtlas = Boolean(atlas);
  const patternId = `carpat-${spec?.pattern ?? 0}-${body.slice(1)}`;

  const colourFor = (material: string) =>
    material === 'Main'
      ? body
      : material === 'Rim'
        ? rimColour
        : material === 'Metal'
          ? frame
          : MATERIAL_FALLBACK[material] ?? '#707080';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label="Player car"
      role="img"
    >
      <defs>
        {/*
          The pattern atlas, tinted to the player's palette. Applied per triangle
          below: an SVG fill is addressed in the element's own coordinate space,
          not by per-vertex UVs, so each painted triangle clips this image and
          the image is transformed by the affine map implied by its three UVs.
        */}
        {pattern && <image id={`${patternId}-tex`} href={pattern} width="1024" height="1024" />}
      </defs>

      {polys.map((p, i) => {
        const tint = polygonShade(p, minD, maxD);
        const base = colourFor(p.material);
        const painted = Boolean(usingAtlas && pattern && p.uv && p.material === 'Main');

        if (!painted) {
          return (
            <polygon
              key={i}
              points={p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}
              fill={shadeHex(base, tint)}
            />
          );
        }

        const t = uvTransform(p.uv!, p.points, 1024);
        const points = p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
        return (
          <g key={i}>
            <clipPath id={`${patternId}-c${i}`}>
              <polygon points={points} />
            </clipPath>
            <g clipPath={`url(#${patternId}-c${i})`}>
              <image href={pattern} width="1024" height="1024" transform={`matrix(${t.join(' ')})`} />
              {/*
                Lighting is applied with a white/black wash INSIDE the clip, so
                it shades the paint without covering it. An opaque overlay drawn
                over the triangle previously hid the pattern entirely.
              */}
              <rect
                x="0"
                y="0"
                width={size}
                height={size}
                fill={tint >= 1 ? '#ffffff' : '#000000'}
                opacity={Math.min(0.3, Math.abs(tint - 1) * 0.6).toFixed(3)}
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function CarPic({
  carStyle,
  size = 28,
  className,
}: {
  carStyle?: string | null;
  size?: number;
  className?: string;
}) {
  const url = carImageUrl(carStyle);
  const [failed, setFailed] = useState(false);

  // A style change should retry the native image rather than stay on the fallback.
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) return <CarSvg carStyle={carStyle} size={size} className={className} />;

  return (
    <img
      src={url}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
      alt="Player car"
      onError={() => setFailed(true)}
    />
  );
}
