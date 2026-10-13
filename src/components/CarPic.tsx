/**
 * Stylized top-down open-wheel car drawn from a decoded PolyTrack car style.
 * PolyTrack renders cars procedurally (no API for PNGs), so this SVG
 * approximates the look: main body color, accent stripes, dark details.
 */
import { decodeCarStyle } from '@/lib/polytrack';

export function CarPic({ carStyle, size = 28, className }: { carStyle?: string | null; size?: number; className?: string }) {
  const hex = decodeCarStyle(carStyle ?? '');
  const body = hex ? `#${hex.slice(0, 6)}` : '#8b7cf0';
  const accent = hex ? `#${hex.slice(6, 12)}` : '#f4f4ff';
  const pods = hex ? `#${hex.slice(12, 18)}` : '#2a2a3a';
  const dark = '#14141e';

  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 40 64"
      className={className}
      aria-label="Player car"
      role="img"
    >
      {/* exposed wheels */}
      <rect x="1" y="10" width="8" height="13" rx="2" fill={dark} />
      <rect x="31" y="10" width="8" height="13" rx="2" fill={dark} />
      <rect x="1" y="38" width="8" height="14" rx="2" fill={dark} />
      <rect x="31" y="38" width="8" height="14" rx="2" fill={dark} />
      {/* front wing */}
      <path d="M6 4h28l-3 5H9z" fill={pods} />
      {/* main body: pointed nose to rear */}
      <path
        d="M20 2 L26 10 L27 26 L30 34 L30 54 L10 54 L10 34 L13 26 L14 10 Z"
        fill={body}
        stroke={dark}
        strokeWidth="1.2"
      />
      {/* sidepods */}
      <path d="M8 30 L13 28 L13 48 L8 46 Z" fill={pods} />
      <path d="M32 30 L27 28 L27 48 L32 46 Z" fill={pods} />
      {/* accent stripe down the center */}
      <path d="M19 4 L21 10 L21 52 L17 52 L17 10 Z" fill={accent} opacity="0.85" />
      {/* cockpit */}
      <path d="M15 30 h10 l-1.5 9 h-7 z" fill={dark} />
      {/* rear wing */}
      <rect x="8" y="52" width="24" height="5" fill={pods} stroke={dark} strokeWidth="1" />
      {/* headlights */}
      <rect x="16" y="2.5" width="8" height="2.5" fill="#fff8d6" />
    </svg>
  );
}
