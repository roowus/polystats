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
import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeCarSpec, getProxyUrl } from '@/lib/polytrack';
import { rasteriseCar, type RasterOptions } from '@/lib/carRaster';

/** Edge length of the pattern atlases, which are authored at this size. */
const ATLAS_SIZE = 1024;

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
 * Car drawn from the game's real mesh, rasterised with a depth buffer.
 *
 * The geometry comes from `scripts/extract-car-mesh.mjs`, which decodes the
 * game's Draco-compressed model once, offline. Drawing is then arithmetic: the
 * mesh is transformed, clipped and shaded into an `ImageData` at the target size.
 *
 * An earlier version projected the mesh to SVG polygons and painted them
 * back-to-front. That is painter's algorithm, and this model's parts interpenetrate
 * rather than sitting one behind another, so no draw order could be right: the
 * intake box inside the shell, each rim nested inside its tyre, and the four
 * overlapping wheels each needed their own special case, and each fix left the
 * next. A depth buffer settles all of them from first principles. See
 * `carRaster.ts`.
 */
function CarSvg({ carStyle, size, className }: { carStyle?: string | null; size: number; className?: string }) {
  const spec = decodeCarSpec(carStyle ?? '');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const body = spec?.primary ?? MATERIAL_FALLBACK.Main;
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

  const colours = useMemo(
    () => ({
      ...MATERIAL_FALLBACK,
      Main: body,
      Rim: rimColour,
      Metal: frame,
    }),
    [body, rimColour, frame]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    const paint = (sampler: RasterOptions['sample']) => {
      if (cancelled) return;
      const { data, width, height } = rasteriseCar({
        size,
        rimsVariant: spec?.rims ?? 0,
        exhaustVariant: spec?.exhaust ?? 0,
        colours,
        sample: sampler,
      });
      canvas.width = width;
      canvas.height = height;
      ctx.putImageData(new ImageData(data, width, height), 0, 0);
    };

    // Until the atlas is decoded the car is drawn in flat colour rather than
    // left blank; the pattern appears as soon as the image loads.
    if (!atlas) {
      paint(undefined);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // The recoloured atlas is read once into a pixel buffer, so sampling per
      // triangle is an array lookup rather than a canvas draw.
      const off = document.createElement('canvas');
      off.width = ATLAS_SIZE;
      off.height = ATLAS_SIZE;
      const octx = off.getContext('2d');
      if (!octx) {
        paint(undefined);
        return;
      }
      octx.drawImage(img, 0, 0, ATLAS_SIZE, ATLAS_SIZE);
      const tex = octx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE).data;
      // Bilinear sampling.
      //
      // Nearest-neighbour reads a 1024px atlas at one texel per pixel. Across a
      // single output pixel the UVs can move several texels, so neighbouring
      // pixels landed on unrelated texels and the paint came out speckled. The
      // gradient atlas is smooth, so interpolating between the four surrounding
      // texels is both more accurate and cheaper than supersampling the lookup.
      const sampler: RasterOptions['sample'] = (material, u, v) => {
        if (material !== 'Main') return null;
        // UVs are stored with V measured from the bottom, matching how the
        // atlases are authored.
        const fx = Math.min(1, Math.max(0, u)) * (ATLAS_SIZE - 1);
        const fy = Math.min(1, Math.max(0, 1 - v)) * (ATLAS_SIZE - 1);
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(ATLAS_SIZE - 1, x0 + 1);
        const y1 = Math.min(ATLAS_SIZE - 1, y0 + 1);
        const dx = fx - x0, dy = fy - y0;
        let r = 0, g = 0, b = 0, a = 0;
        const corners: [number, number, number][] = [
          [x0, y0, (1 - dx) * (1 - dy)],
          [x1, y0, dx * (1 - dy)],
          [x0, y1, (1 - dx) * dy],
          [x1, y1, dx * dy],
        ];
        for (const [cx, cy, w] of corners) {
          if (w <= 0) continue;
          const o = (cy * ATLAS_SIZE + cx) * 4;
          const ca = tex[o + 3] / 255;
          r += tex[o] * w * ca;
          g += tex[o + 1] * w * ca;
          b += tex[o + 2] * w * ca;
          a += w * ca;
        }
        if (a < 0.05) return null;
        // Un-premultiply, so transparent texels do not darken the result.
        return [r / a, g / a, b / a];
      };
      paint(sampler);
    };
    img.onerror = () => paint(undefined);
    img.src = atlas;
    return () => {
      cancelled = true;
    };
  }, [size, spec?.rims, spec?.exhaust, colours, atlas]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
      aria-label="Player car"
      role="img"
    />
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
