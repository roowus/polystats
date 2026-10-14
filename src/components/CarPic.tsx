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
import { useEffect, useState } from 'react';
import { decodeCarStyle, decodeCarSpec, getProxyUrl } from '@/lib/polytrack';

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
 * Car drawn from the decoded PolyTrack style.
 *
 * Framing matches the game's thumbnail: a 3/4 view, nose to the lower left,
 * four exposed wheels, front and rear wings. The game shades its model so the
 * top face reads lighter than the sides; the body is split into lit top and
 * darker flank planes for the same effect.
 *
 * Colours, pattern and rim choice all come from the style bytes, so two players
 * with the same car still differ in paint, exactly as in game.
 */
function CarSvg({ carStyle, size, className }: { carStyle?: string | null; size: number; className?: string }) {
  const spec = decodeCarSpec(carStyle ?? '');

  const body = spec?.primary ?? '#8b7cf0';
  const accent = spec?.secondary ?? '#f4f4ff';
  const frame = spec?.frame ?? '#2a2a3a';
  const rim = spec?.rimsColor ?? '#c8c8d0';
  const patternIndex = spec?.pattern ?? 0;
  const pattern = patternDataUri(patternIndex, body, accent);
  const patternId = `car-pat-${patternIndex}-${body.slice(1)}-${accent.slice(1)}`;

  const tire = '#16161c';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="Player car"
      role="img"
    >
      {pattern && (
        <defs>
          {/* Clip the painted texture to the body silhouette. */}
          <clipPath id={`${patternId}-body`}>
            <path d="M25 57 L36 44 L52 36 L69 33 L78 39 L78 53 L62 58 L41 63 L29 66 Z" />
          </clipPath>
          <pattern id={patternId} width="100" height="100" patternUnits="userSpaceOnUse">
            <image href={pattern} width="100" height="100" preserveAspectRatio="none" />
          </pattern>
        </defs>
      )}

      {/* Rear wing */}
      <path d="M64 30 L87 21 L89 27 L66 36 Z" fill={accent} stroke="#0d0d12" strokeWidth="0.7" />
      <path d="M67 34 L69 30 L70 45 L68 48 Z" fill={shade(accent, 0.6)} />

      {/* Rear wheels */}
      <g>
        <ellipse cx="73" cy="50" rx="11.5" ry="11.5" fill={tire} />
        <ellipse cx="73" cy="50" rx="5.6" ry="5.6" fill={rim} />
        <ellipse cx="73" cy="50" rx="2.2" ry="2.2" fill={shade(rim, 0.55)} />
      </g>
      <g>
        <ellipse cx="34" cy="62" rx="10.5" ry="10.5" fill={tire} />
        <ellipse cx="34" cy="62" rx="5" ry="5" fill={rim} />
        <ellipse cx="34" cy="62" rx="2" ry="2" fill={shade(rim, 0.55)} />
      </g>

      {/* Body: painted with the style's pattern, clipped to the silhouette */}
      <path
        d="M25 57 L36 44 L52 36 L69 33 L78 39 L78 53 L62 58 L41 63 L29 66 Z"
        fill={pattern ? `url(#${patternId})` : body}
        stroke="#0d0d12"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Lit top plane: same paint, brightened, so the shape reads as 3D */}
      <path
        d="M36 44 L52 36 L69 33 L76 38 L59 44 L41 50 L34 49 Z"
        fill={pattern ? `url(#${patternId})` : body}
        opacity="0.55"
        stroke="#0d0d12"
        strokeWidth="0.5"
      />
      <path
        d="M36 44 L52 36 L69 33 L76 38 L59 44 L41 50 L34 49 Z"
        fill="#ffffff"
        opacity="0.16"
      />

      {/* Cockpit */}
      <path d="M49 41 L61 37 L65 41 L53 46 Z" fill="#0d0d12" opacity="0.88" />

      {/* Front wing */}
      <path d="M18 60 L33 54 L35 58 L20 65 Z" fill={frame} stroke="#0d0d12" strokeWidth="0.7" />

      {/* Front wheels */}
      <g>
        <ellipse cx="24" cy="75" rx="10" ry="10" fill={tire} />
        <ellipse cx="24" cy="75" rx="4.8" ry="4.8" fill={rim} />
        <ellipse cx="24" cy="75" rx="1.9" ry="1.9" fill={shade(rim, 0.55)} />
      </g>
      <g>
        <ellipse cx="65" cy="69" rx="10.5" ry="10.5" fill={tire} />
        <ellipse cx="65" cy="69" rx="5" ry="5" fill={rim} />
        <ellipse cx="65" cy="69" rx="2" ry="2" fill={shade(rim, 0.55)} />
      </g>
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
