/**
 * Stylized top-down car rendered from a decoded PolyTrack car style
 * (4 RGB colors). Approximates the in-game look with SVG shapes.
 */
import { decodeCarStyle } from '@/lib/polytrack';

export function CarPic({ carStyle, size = 28, className }: { carStyle?: string | null; size?: number; className?: string }) {
  const hex = decodeCarStyle(carStyle ?? '');
  const body = hex ? `#${hex.slice(0, 6)}` : '#8b7cf0';
  const accent = hex ? `#${hex.slice(6, 12)}` : '#ffffff';
  const detail = hex ? `#${hex.slice(12, 18)}` : '#1a1a1a';

  return (
    <svg
      width={size}
      height={size * 2}
      viewBox="0 0 30 60"
      className={className}
      aria-label="Player car"
      role="img"
    >
      {/* tires */}
      <rect x="2" y="8" width="6" height="12" rx="2" fill="#111" />
      <rect x="22" y="8" width="6" height="12" rx="2" fill="#111" />
      <rect x="2" y="38" width="6" height="12" rx="2" fill="#111" />
      <rect x="22" y="38" width="6" height="12" rx="2" fill="#111" />
      {/* body */}
      <rect x="4" y="4" width="22" height="52" rx="6" fill={body} stroke={detail} strokeWidth="1.5" />
      {/* cabin / windshield */}
      <rect x="7" y="20" width="16" height="14" rx="3" fill={accent} opacity="0.9" />
      {/* racing stripe */}
      <rect x="13" y="4" width="4" height="52" fill={accent} opacity="0.55" />
      {/* headlights */}
      <rect x="6" y="3" width="5" height="3" rx="1" fill="#fff8d6" />
      <rect x="19" y="3" width="5" height="3" rx="1" fill="#fff8d6" />
    </svg>
  );
}
