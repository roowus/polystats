import { useCallback, useRef, useState } from 'react';
import {
  fetchLeaderboard,
  fetchTrackOfTheWeek,
  fetchUserEntryLight,
  type LeaderboardEntry,
} from '@/lib/polytrack';
import { ALL_TRACKS, OFFICIAL_TRACKS } from '@/lib/tracks';
import { getTrackCatalog } from '@/lib/liveTracks';
import type { UserTrackEntry } from '@/lib/stats';

export type ScanStatus =
  | { phase: 'idle' }
  | { phase: 'scanning'; done: number; total: number }
  | { phase: 'enriching'; found: number }
  | { phase: 'done'; nickname: string | null; entries: UserTrackEntry[] }
  | { phase: 'no-entries' }
  | { phase: 'error'; message: string };

interface FoundLight {
  trackId: string;
  trackName: string;
  trackGroup: 'official' | 'community' | 'totw';
  light: { position: number; frames: number; id: number };
}

function groupFor(trackId: string, totwId?: string): 'official' | 'community' | 'totw' {
  if (totwId && trackId === totwId) return 'totw';
  return ALL_TRACKS.some((t) => t.id === trackId) ? 'official' : 'community';
}

/**
 * Fast user-scan pipeline:
 *  1. one light request per track (leaderboardUserEntry) — "does the user appear here?"
 *  2. full entry + WR fetch only for tracks where the user actually has a time.
 * Total requests ≈ tracks + 2×(number of tracks played) instead of 2×all tracks.
 */
export function useUserStats() {
  const [status, setStatus] = useState<ScanStatus>({ phase: 'idle' });
  const runId = useRef(0);

  const scan = useCallback(async (userId: string) => {
    const id = ++runId.current;
    const alive = () => runId.current === id;

    setStatus({ phase: 'scanning', done: 0, total: ALL_TRACKS.length + 1 });

    // Resolve the current Track of the Week (optional).
    let totwId: string | undefined;
    let totwName: string | undefined;
    try {
      const totw = await fetchTrackOfTheWeek();
      if (totw) {
        totwId = totw.trackId;
        totwName = totw.name;
      }
    } catch {
      // optional
    }
    if (!alive()) return;

    // Live catalog: includes tracks added in newer game versions automatically.
    let catalog = ALL_TRACKS;
    try {
      catalog = (await getTrackCatalog()).tracks;
    } catch {
      // embedded catalog is the fallback
    }

    const tracks = [
      ...(totwId ? [{ id: totwId, name: `Track of the Week: ${totwName}`, group: 'totw' as const }] : []),
      ...catalog.map((t) => ({
        id: t.id,
        name: t.name,
        group: (OFFICIAL_TRACKS.some((o) => o.id === t.id) ? 'official' : 'community') as 'official' | 'community',
      })),
    ];

    // Phase 1 — light presence check on every track.
    const found: FoundLight[] = [];
    let done = 0;
    const CONCURRENCY = 10;
    const queue = [...tracks];
    const worker = async () => {
      while (queue.length > 0) {
        if (!alive()) return;
        const track = queue.shift()!;
        try {
          const light = await fetchUserEntryLight(track.id, userId);
          if (light) {
            found.push({
              trackId: track.id,
              trackName: track.name,
              trackGroup: track.group === 'totw' ? 'totw' : groupFor(track.id, totwId),
              light,
            });
          }
        } catch {
          // single-track failure tolerated; retry logic lives in the UI layer
        }
        done += 1;
        setStatus({ phase: 'scanning', done, total: tracks.length });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (!alive()) return;

    if (found.length === 0) {
      setStatus({ phase: 'no-entries' });
      return;
    }

    // Phase 2 — enrich only the tracks the user appears on.
    setStatus({ phase: 'enriching', found: found.length });
    const entries: UserTrackEntry[] = [];
    let nickname: string | null = null;

    await Promise.all(
      found.map(async (f) => {
        if (!alive()) return;
        try {
          const skip = Math.max(0, f.light.position - 1);
          const [page, wr] = await Promise.all([
            fetchLeaderboard({ trackId: f.trackId, skip, amount: 1, onlyVerified: false }),
            fetchLeaderboard({ trackId: f.trackId, skip: 0, amount: 1, onlyVerified: true }).catch(() => null),
          ]);
          if (!alive()) return;
          const full: LeaderboardEntry | undefined =
            page.entries.find((e) => e.userId === userId) ?? page.entries[0];
          if (!full) return;
          const wrTime = wr?.entries[0]?.frames ?? null;
          const total = page.total || 1;
          const wrPercentGap =
            wrTime !== null && f.light.frames > 0
              ? ((f.light.frames - wrTime) / f.light.frames) * 100
              : undefined;
          entries.push({
            ...full,
            trackId: f.trackId,
            trackName: f.trackName,
            trackGroup: f.trackGroup,
            position: f.light.position,
            rank: f.light.position,
            percent: (f.light.position / total) * 100,
            wrTime: wrTime ?? undefined,
            wrTimeGap: wrTime !== null ? f.light.frames - wrTime : undefined,
            wrPercentGap,
          });
          if (!nickname && full.nickname) nickname = full.nickname;
        } catch {
          // skip this track's details
        }
      })
    );
    if (!alive()) return;

    if (entries.length === 0) {
      setStatus({ phase: 'no-entries' });
      return;
    }
    entries.sort((a, b) => a.trackName.localeCompare(b.trackName));
    setStatus({ phase: 'done', nickname, entries });
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setStatus({ phase: 'idle' });
  }, []);

  return { status, scan, reset };
}
