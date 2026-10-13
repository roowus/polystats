import { useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote } from '@/components/shell';
import { Freshness, useDataStatus } from '@/components/Freshness';
import { formatTime, getProxyUrl } from '@/lib/polytrack';
import { OFFICIAL_TRACKS } from '@/lib/tracks';
import { getTrackCatalog, mergeCatalog } from '@/lib/liveTracks';
import { SeasonIcon } from '@/components/SeasonIcon';
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


/** Lightweight SVG line chart of the record progression (best-so-far). */
function ProgressionChart({ rows }: { rows: HistoryRow[] }) {
  const W = 720;
  const H = 220;
  const PAD = { l: 56, r: 16, t: 14, b: 26 };

  const series = useMemo(() => {
    let best = Infinity;
    const out: { t: number; ms: number; player: string }[] = [];
    for (const r of rows) {
      const t = Date.parse(r.set_at.includes('T') ? r.set_at : r.set_at.replace(' ', 'T') + 'Z');
      if (!Number.isFinite(t)) continue;
      if (r.time_ms < best) {
        best = r.time_ms;
        out.push({ t, ms: r.time_ms, player: r.player });
      }
    }
    return out;
  }, [rows]);

  if (series.length < 2) return null;

  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const msMin = series[series.length - 1].ms;
  const msMax = series[0].ms;
  const msPad = Math.max(200, (msMax - msMin) * 0.1);
  const lo = msMin - msPad;
  const hi = msMax + msPad;

  const x = (t: number) => PAD.l + ((t - t0) / span) * (W - PAD.l - PAD.r);
  const y = (ms: number) => PAD.t + (1 - (ms - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const points = series.map((p) => `${x(p.t)},${y(p.ms)}`).join(' ');
  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const sec = ((ms % 60000) / 1000).toFixed(2);
    return `${String(m).padStart(2, '0')}:${sec.padStart(5, '0')}`;
  };

  return (
    <Panel className="mb-6 p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        Record progression (best time over time)
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="World record progression chart">
        {/* gridlines */}
        {[hi, lo + (hi - lo) / 2, lo].map((ms, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(ms)} y2={y(ms)} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(ms) + 3} textAnchor="end" fontSize="9" fill="#cfcfe4">
              {fmt(ms)}
            </text>
          </g>
        ))}
        <polyline points={points} fill="none" stroke="#7f9cf5" strokeWidth="2" />
        {series.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.t)} cy={y(p.ms)} r="3" fill="#fff" />
            <title>{`${p.player} — ${fmt(p.ms)}`}</title>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize="9" fill="#cfcfe4">
          {new Date(t0).toLocaleDateString()}
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="#cfcfe4">
          {new Date(t1).toLocaleDateString()}
        </text>
      </svg>
    </Panel>
  );
}

export default function HistoryPage() {
  const [catalog, setCatalog] = useState(mergeCatalog([]));
  const [track, setTrack] = useState(OFFICIAL_TRACKS[0]);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataStatus = useDataStatus();

  useEffect(() => {
    getTrackCatalog().then((c) => setCatalog(c.tracks)).catch(() => {});
  }, []);

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
        <Freshness date={dataStatus?.last_backfill_run ?? dataStatus?.last_fresh_run} />

        {/* Track selector */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {catalog.filter((t) => /^(Summer|Winter|Desert) \d+$/.test(t.name)).map((t) => (
            <button
              key={t.id}
              onClick={() => setTrack(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                track.id === t.id
                  ? 'bg-[#212b58] text-white ring-2 ring-white/30'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <span className="flex items-center gap-1.5">
                <SeasonIcon trackName={t.name} size={12} />
                {t.name}
              </span>
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

            {rows && <ProgressionChart rows={rows} />}

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
