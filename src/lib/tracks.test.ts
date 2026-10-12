import { describe, expect, it } from 'vitest';
import { ALL_TRACKS, COMMUNITY_TRACKS, OFFICIAL_TRACKS, findTrack, trackName } from '@/lib/tracks';

const HEX64 = /^[a-f0-9]{64}$/;

describe('track catalog', () => {
  it('contains the expected numbers of tracks', () => {
    expect(OFFICIAL_TRACKS).toHaveLength(17); // 7 summer + 5 winter + 5 desert
    expect(COMMUNITY_TRACKS.length).toBeGreaterThanOrEqual(40);
    expect(ALL_TRACKS).toHaveLength(OFFICIAL_TRACKS.length + COMMUNITY_TRACKS.length);
  });

  it('has unique, well-formed track IDs', () => {
    const ids = ALL_TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(HEX64);
    }
  });

  it('names every track uniquely', () => {
    const names = ALL_TRACKS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('finds tracks by id and falls back for unknown ids', () => {
    const first = OFFICIAL_TRACKS[0];
    expect(findTrack(first.id)?.name).toBe(first.name);
    expect(findTrack('deadbeef')).toBeUndefined();
    expect(trackName('deadbeef')).toBe('deadbeef');
  });
});
