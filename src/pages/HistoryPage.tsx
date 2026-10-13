import { useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote } from '@/components/shell';
import { formatTime, getProxyUrl } from '@/lib/polytrack';
import { OFFICIAL_TRACKS } from '@/lib/tracks';
import { cn } from '@/lib/utils';

interface HistoryRow {
  track_id: string;
  player: string;
  time_ms: number;
  set_at: string;
}

/** WR history for a track via the proxy worker's D1-backed /history API. */
async function fetchHistory(trackId: string): Promise<HistoryRow[]> {
  const base = getProxyUrl().split('?')[0].replace(/\/$/, '');
  const response = await fetch(`${base}/history?trackId=${trackId}`);
  if (!response.ok) throw new Error(`History request failed: ${response.status}`);
  const data = (await response.json()) as { history?: HistoryRow[] };
  return (data.history ?? []).sort((a, b) => a.set_at.localeCompare(b.set_at));
}

export default function HistoryPage() {
  const [track, setTrack] = useState(OFFICIAL_TRACKS[0]);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHistory(track.id)
      .then((h) => {
        if (!cancelled) setRows(h);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track]);

  // Progression stats computed from the chronological record chain
  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const best = rows.reduce((a, b) => (b.time_ms < a.time_ms ? b : a));
    const first = rows[0];
    const holders = new Set(rows.map((r) => r.player));
    const improvements = rows.slice(1).filter((r, i) => r.time_ms < rows[i].time_ms).length;
    return {
      first,
      best,
      holders: holders.size,
      total: rows.length,
      improvements,
      spanDays: Math.max(
        1,
        Math.round(
          (new Date(rows[rows.length - 1].set_at).getTime() - new Date(first.set_at).getTime()) / 86400000
        )
      ),
    };
  }, [rows]);

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="Record History"
          subtitle="Every world-record progression on the official tracks — who held it, when, and how fast."
        />

        {/* Track selector */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {OFFICIAL_TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTrack(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                track.id === t.id
                  ? 'bg-[#112052] text-white ring-2 ring-white/30'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        {loading && (
          <Panel className="p-10 text-center">
            <Spinner className="h-6 w-6" />
            <p className="mt-3 text-sm text-zinc-400">Loading history…</p>
          </Panel>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && (
          <>
            {stats && (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Panel className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400">Current WR</p>
                  <p className="mt-1 font-mono text-lg text-white">{formatTime(stats.best.time_ms)}</p>
                  <p className="text-xs text-zinc-300">{stats.best.player}</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400">First record</p>
                  <p className="mt-1 font-mono text-lg text-white">{formatTime(stats.first.time_ms)}</p>
                  <p className="text-xs text-zinc-300">{stats.first.player}</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400">Time saved since launch</p>
                  <p className="mt-1 font-mono text-lg text-emerald-300">
                    −{formatTime(stats.first.time_ms - stats.best.time_ms)}
                  </p>
                  <p className="text-xs text-zinc-300">over {stats.spanDays} days</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400">Record holders</p>
                  <p className="mt-1 text-lg font-semibold text-white">{stats.holders}</p>
                  <p className="text-xs text-zinc-300">{stats.total} records total</p>
                </Panel>
              </div>
            )}

            <Panel className="overflow-hidden">
              <div className="border-b-2 border-white/12 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white">
                Progression — {track.name}
              </div>
              {!rows || rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-300">No history recorded for this track yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Player</th>
                        <th className="px-4 py-2.5 text-right font-medium">Time</th>
                        <th className="px-4 py-2.5 text-right font-medium">Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const prev = i > 0 ? rows[i - 1] : null;
                        const isRecord = !prev || r.time_ms < prev.time_ms;
                        const diff = prev ? prev.time_ms - r.time_ms : 0;
                        return (
                          <tr key={`${r.set_at}-${r.player}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-300">
                              {r.set_at.slice(0, 16).replace('T', ' ')}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-white">{r.player}</td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-white">
                              {formatTime(r.time_ms)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs">
                              {i === 0 ? (
                                <span className="text-zinc-400">first record</span>
                              ) : isRecord ? (
                                <span className="font-mono text-emerald-300">−{formatTime(diff)}</span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </PageShell>
    </div>
  );
}
