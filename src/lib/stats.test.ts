import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  computeAverages,
  getMedal,
  getRankMedal,
  getWrGapMedal,
  groupMedals,
  bestWorst,
  type UserTrackEntry,
} from '@/lib/stats';

function entry(over: Partial<UserTrackEntry>): UserTrackEntry {
  return {
    id: 1,
    userId: 'u',
    name: 'p',
    carColors: '',
    frames: 10000,
    trackId: 't1',
    trackName: 'Track',
    trackGroup: 'official',
    ...over,
  };
}

describe('medals', () => {
  it('assigns mineral medals by percentile', () => {
    expect(getMedal(0.001)?.label).toBe('Diamond');
    expect(getMedal(0.3)?.label).toBe('Emerald');
    expect(getMedal(4)?.label).toBe('Gold');
    expect(getMedal(10)?.label).toBe('Silver');
    expect(getMedal(20)?.label).toBe('Bronze');
    expect(getMedal(50)).toBeNull();
  });

  it('assigns rank medals', () => {
    expect(getRankMedal(1)?.label).toBe('WR');
    expect(getRankMedal(3)?.label).toBe('Podium');
    expect(getRankMedal(20)?.label).toBe('Top 25');
    expect(getRankMedal(80)?.label).toBe('Participant');
    expect(getRankMedal(0)).toBeNull();
  });

  it('assigns WR-gap medals', () => {
    expect(getWrGapMedal(0)?.label).toBe('Perfect');
    expect(getWrGapMedal(0.05)?.label).toBe('Legendary');
    expect(getWrGapMedal(40)).toBeNull();
  });
});

describe('computeAverages', () => {
  it('averages time, rank and gap', () => {
    const avg = computeAverages([
      entry({ frames: 10000, position: 1, wrPercentGap: 0 }),
      entry({ frames: 30000, position: 3, wrPercentGap: 10 }),
    ])!;
    expect(avg.tracks).toBe(2);
    expect(avg.avgTimeMs).toBe(20000);
    expect(avg.avgRank).toBe(2);
    expect(avg.avgWrGapPercent).toBe(5);
  });

  it('returns null for no entries', () => {
    expect(computeAverages([])).toBeNull();
  });
});

describe('groupMedals / bestWorst', () => {
  it('groups entries under their medals without duplicates', () => {
    const e = entry({ position: 1, wrPercentGap: 0 });
    const medals = groupMedals([e]);
    expect(medals['WR']).toHaveLength(1);
    expect(medals['Perfect']).toHaveLength(1);
  });

  it('finds best and worst by time', () => {
    const bw = bestWorst([
      entry({ frames: 5000, trackName: 'Fast' }),
      entry({ frames: 9000, trackName: 'Slow' }),
    ])!;
    expect(bw.time.best?.trackName).toBe('Fast');
    expect(bw.time.worst?.trackName).toBe('Slow');
  });
});

// sanity: formatTime re-export stays intact
import { formatTime } from '@/lib/stats';
describe('formatTime re-export', () => {
  it('formats ms', () => {
    expect(formatTime(22123)).toBe('00:22.123');
  });
});

afterEach(() => vi.restoreAllMocks());
