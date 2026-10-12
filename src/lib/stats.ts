import type { LeaderboardEntry } from './polytrack';
import { formatTime } from './polytrack';

// ---------------------------------------------------------------------------
// Medals (thresholds carried over from the original PolyStats)
// ---------------------------------------------------------------------------

export interface Medal {
  icon: string;
  label: string;
  color: string;
  type: 'mineral' | 'rank' | 'wr_percent_gap';
}

export const getMedal = (percent: number | undefined): Medal | null => {
  if (percent === undefined || isNaN(percent)) return null;
  if (percent <= 0.005) return { icon: '♦', label: 'Diamond', color: '#67E8F9', type: 'mineral' };
  if (percent <= 0.5) return { icon: '♦', label: 'Emerald', color: '#22C55E', type: 'mineral' };
  if (percent <= 5) return { icon: '♦', label: 'Gold', color: '#FACC15', type: 'mineral' };
  if (percent <= 15) return { icon: '♦', label: 'Silver', color: '#9CA3AF', type: 'mineral' };
  if (percent <= 25) return { icon: '♦', label: 'Bronze', color: '#CD7F32', type: 'mineral' };
  return null;
};

export const getRankMedal = (rank: number | undefined): Medal | null => {
  if (rank === undefined || isNaN(rank) || rank <= 0) return null;
  if (rank === 1) return { icon: '✦', label: 'WR', color: '#FFD700', type: 'rank' };
  if (rank <= 5) return { icon: '✦', label: 'Podium', color: '#5A32A3', type: 'rank' };
  if (rank <= 10) return { icon: '✦', label: 'Top 10', color: '#9370DB', type: 'rank' };
  if (rank <= 25) return { icon: '✦', label: 'Top 25', color: '#4169E1', type: 'rank' };
  if (rank <= 50) return { icon: '✦', label: 'Top 50', color: '#87CEEB', type: 'rank' };
  return { icon: '✦', label: 'Participant', color: '#A0A0A0', type: 'rank' };
};

export const getWrGapMedal = (percentGap: number | undefined): Medal | null => {
  if (percentGap === undefined || isNaN(percentGap) || percentGap < 0) return null;
  if (percentGap === 0) return { icon: '★', label: 'Perfect', color: '#FFD700', type: 'wr_percent_gap' };
  if (percentGap < 0.1) return { icon: '★', label: 'Legendary', color: '#9400D3', type: 'wr_percent_gap' };
  if (percentGap < 0.5) return { icon: '★', label: 'Mythic', color: '#800080', type: 'wr_percent_gap' };
  if (percentGap < 2) return { icon: '★', label: 'Epic', color: '#FF1493', type: 'wr_percent_gap' };
  if (percentGap < 7) return { icon: '★', label: 'Great', color: '#00BFFF', type: 'wr_percent_gap' };
  if (percentGap < 15) return { icon: '★', label: 'Good', color: '#32CD32', type: 'wr_percent_gap' };
  if (percentGap < 30) return { icon: '★', label: 'Decent', color: '#FFA500', type: 'wr_percent_gap' };
  return null;
};

export function medalFor(entry: {
  percent?: number;
  position?: number;
  wrPercentGap?: number;
}): Medal | null {
  return (
    getWrGapMedal(entry.wrPercentGap) ??
    getRankMedal(entry.position) ??
    getMedal(entry.percent)
  );
}

export const MEDAL_ORDER = [
  'WR', 'Podium', 'Top 10', 'Top 25', 'Top 50', 'Participant',
  'Diamond', 'Emerald', 'Gold', 'Silver', 'Bronze',
  'Perfect', 'Legendary', 'Mythic', 'Epic', 'Great', 'Good', 'Decent',
];

// ---------------------------------------------------------------------------
// User summary — averages, medals, best/worst
// ---------------------------------------------------------------------------

export interface UserTrackEntry extends LeaderboardEntry {
  trackId: string;
  trackName: string;
  trackGroup: 'official' | 'community' | 'totw';
  percent?: number;     // rank / total * 100
  wrTimeGap?: number;
  wrPercentGap?: number;
}

export interface Averages {
  tracks: number;
  avgTimeMs: number;
  avgRank: number;
  avgWrGapPercent: number;
}

export function computeAverages(entries: UserTrackEntry[]): Averages | null {
  if (entries.length === 0) return null;
  const sum = entries.reduce(
    (acc, e) => ({
      time: acc.time + e.frames,
      rank: acc.rank + (e.position ?? 0),
      gap: acc.gap + (e.wrPercentGap ?? 0),
      gapN: acc.gapN + (e.wrPercentGap !== undefined ? 1 : 0),
    }),
    { time: 0, rank: 0, gap: 0, gapN: 0 }
  );
  return {
    tracks: entries.length,
    avgTimeMs: sum.time / entries.length,
    avgRank: sum.rank / entries.length,
    avgWrGapPercent: sum.gapN > 0 ? sum.gap / sum.gapN : 0,
  };
}

export function groupMedals(entries: UserTrackEntry[]): Record<string, UserTrackEntry[]> {
  const map: Record<string, UserTrackEntry[]> = {};
  for (const entry of entries) {
    for (const medal of [getMedal(entry.percent), getRankMedal(entry.position), getWrGapMedal(entry.wrPercentGap)]) {
      if (!medal) continue;
      const list = (map[medal.label] ??= []);
      if (!list.some((e) => e.trackId === entry.trackId)) list.push(entry);
    }
  }
  return map;
}

export function bestWorst(entries: UserTrackEntry[]) {
  if (entries.length === 0) return null;
  const pick = (key: (e: UserTrackEntry) => number | undefined) => {
    const valid = entries.filter((e) => key(e) !== undefined);
    if (valid.length === 0) return {};
    const sorted = [...valid].sort((a, b) => (key(a) as number) - (key(b) as number));
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  };
  return {
    time: pick((e) => e.frames),
    rank: pick((e) => e.position),
    wrGap: pick((e) => e.wrPercentGap),
  };
}

export { formatTime };
