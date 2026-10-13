import { Sun, Snowflake, Palmtree } from 'lucide-react';

export type Season = 'summer' | 'winter' | 'desert';

/** Season inference from a PolyStats track name. */
export function seasonOf(trackName: string): Season {
  if (/^Winter/i.test(trackName)) return 'winter';
  if (/^Desert/i.test(trackName)) return 'desert';
  return 'summer';
}

const ICONS = {
  summer: Sun,
  winter: Snowflake,
  desert: Palmtree,
};

const COLORS: Record<Season, string> = {
  summer: '#ffd166',
  winter: '#9bd1ff',
  desert: '#e8a866',
};

export function SeasonIcon({ trackName, size = 14, className }: { trackName: string; size?: number; className?: string }) {
  const season = seasonOf(trackName);
  const Icon = ICONS[season];
  return <Icon size={size} className={cn('shrink-0', className)} style={{ color: COLORS[season] }} aria-label={season} />;
}

import { cn } from '@/lib/utils';
