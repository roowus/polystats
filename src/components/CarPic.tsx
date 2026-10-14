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
 * Build a pattern tile as a data URI, recoloured to the car's palette.
 *
 * The game's pattern SVGs are plain artwork painted in placeholder colours
 * (red = primary, green = secondary) plus neutral #141414 shading. Substituting
 * those two keys reproduces the paint scheme without a shader: the artwork
 * itself supplies the stripes, chevrons and gradients.
 */
export function patternDataUri(pattern: number, primary: string, secondary: string): string {
  const name = PATTERN_FILES[pattern];
  if (!name) return '';
  // Placeholders in the source art, per the game's own files.
  const recoloured = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
<linearGradient id="p" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${shade(primary, 0.72)}"/>
</linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${secondary}"/><stop offset="1" stop-color="${shade(secondary, 0.7)}"/>
</linearGradient>
</defs>
<rect width="1024" height="1024" fill="url(#p)"/>
<image href="/patterns/pattern_${name}.svg" width="1024" height="1024" opacity="0.9"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(recoloured)}`;
}


/**
 * Affine transform mapping a pattern atlas onto a projected triangle.
 *
 * Solved from the three UV/texture coordinate pairs and their matching screen
 * positions: an affine map is exactly determined by three correspondences, which
 * is why the pattern is applied per triangle. UVs are treated as a unit square,
 * so they are scaled to the atlas size first.
 *
 * Returns the six values of an SVG `matrix(a b c d e f)`.
 */
export function uvTransform(
  uv: [number, number][],
  pts: [number, number][],
  atlas: number
): number[] {
  const [u0, v0] = uv[0];
  const [u1, v1] = uv[1];
  const [u2, v2] = uv[2];
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[1];
  const [x2, y2] = pts[2];

  // Scale UVs into atlas pixels.
  const U0 = u0 * atlas, V0 = v0 * atlas;
  const U1 = u1 * atlas, V1 = v1 * atlas;
  const U2 = u2 * atlas, V2 = v2 * atlas;

  const det = (U1 - U0) * (V2 - V0) - (U2 - U0) * (V1 - V0);
  // Degenerate UV triangle: fall back to a translation so nothing disappears.
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return [1, 0, 0, 1, x0 - U0, y0 - V0];

  const a = ((x1 - x0) * (V2 - V0) - (x2 - x0) * (V1 - V0)) / det;
  const b = ((y1 - y0) * (V2 - V0) - (y2 - y0) * (V1 - V0)) / det;
  const c = ((x2 - x0) * (U1 - U0) - (x1 - x0) * (U2 - U0)) / det;
  const d = ((y2 - y0) * (U1 - U0) - (y1 - y0) * (U2 - U0)) / det;
  const e = x0 - a * U0 - c * V0;
  const f = y0 - b * U0 - d * V0;
  return [a, b, c, d, e, f];
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
  const polys = useMemo(() => projectCar(size), [size]);
  const [minD, maxD] = useMemo(() => depthRange(polys), [polys]);

  const body = spec?.primary ?? MATERIAL_FALLBACK.Main;
  const accent = spec?.secondary ?? '#f4f4ff';
  const frame = spec?.frame ?? MATERIAL_FALLBACK.Metal;
  const rimColour = spec?.rimsColor ?? MATERIAL_FALLBACK.Rim;
  const pattern = spec ? patternDataUri(spec.pattern, body, accent) : '';
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
      {pattern && (
        <defs>
          {/*
            One clip per paint triangle. The polygon cannot carry a texture fill
            directly, because an SVG fill is addressed in the element's own
            coordinate space, not by per-vertex UVs. So each triangle is drawn as
            a solid shape and then used to clip the pattern image, with the image
            transformed per-vertex by the affine map implied by the triangle's
            three UVs. That is what puts the stripes on the panels rather than
            across the whole car.
          */}
          <image id={`${patternId}-tex`} href={pattern} width="1024" height="1024" />
        </defs>
      )}
      {polys.map((p, i) => {
        const tint = polygonShade(p, minD, maxD);
        const base = colourFor(p.material);
        // Only the painted panels carry UVs; everything else is flat colour.
        if (!pattern || !p.uv || p.material !== 'Main') {
          return (
            <polygon
              key={i}
              points={p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}
              fill={shadeHex(base, tint)}
            />
          );
        }
        // Affine map from atlas space (1024) to screen, implied by the 3 UVs.
        const t = uvTransform(p.uv, p.points, 1024);
        const points = p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
        return (
          <g key={i}>
            <clipPath id={`${patternId}-c${i}`}>
              <polygon points={points} />
            </clipPath>
            <g clipPath={`url(#${patternId}-c${i})`}>
              <image
                href={pattern}
                width="1024"
                height="1024"
                transform={`matrix(${t.join(' ')})`}
                opacity="1"
              />
            </g>
            {/*
              Lighting overlay. Kept light: the atlas already carries the panel
              art, and a heavy overlay washed the stripes out to flat grey. Only
              the amount needed to keep patterned panels consistent with the
              flat-coloured ones is applied.
            */}
            <polygon points={points} fill="#000" opacity={Math.max(0, 0.34 - tint * 0.24).toFixed(3)} />
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
