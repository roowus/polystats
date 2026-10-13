import { Sun, Snowflake, Palmtree } from 'lucide-react';

export type Season = 'summer' | 'winter' | 'desert';

/** Season from an explicit environment value or inferred from the track name. */
export function seasonOf(trackName: string, environment?: string): Season {
  if (environment === 'winter') return 'winter';
  if (environment === 'desert') return 'desert';
  if (environment === 'summer') return 'summer';
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

export function SeasonIcon({
  trackName,
  environment,
  size = 14,
  className,
}: {
  trackName: string;
  environment?: string;
  size?: number;
  className?: string;
}) {
  const season = seasonOf(trackName, environment);
  const Icon = ICONS[season];
  return <Icon size={size} className={cn('shrink-0', className)} style={{ color: COLORS[season] }} aria-label={season} />;
}

import { cn } from '@/lib/utils';
