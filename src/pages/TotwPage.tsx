import { useCallback, useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote, StatTile } from '@/components/shell';
import { Freshness, useDataStatus } from '@/components/Freshness';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { fetchLeaderboard, fetchTrackOfTheWeek, type LeaderboardEntry, type TrackOfTheWeek } from '@/lib/polytrack';
import { trackName } from '@/lib/tracks';

function Countdown({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(endTime).getTime() - now;
  if (ms <= 0) return <span className="text-fuchsia-300">rotating now…</span>;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-mono tabular-nums">
      {d > 0 && `${d}d `}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

const ENV_NAMES = ['Summer', 'Winter', 'Desert'];

const TotwPage = () => {
  const [totw, setTotw] = useState<TrackOfTheWeek | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const dataStatus = useDataStatus();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await fetchTrackOfTheWeek();
      if (!t) throw new Error('No Track of the Week available right now.');
      setTotw(t);
      const data = await fetchLeaderboard({ trackId: t.trackId, skip: 0, amount: 50, onlyVerified: false });
      setEntries(data.entries);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Track of the Week.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-rotate: refetch when the week ends (checked every 30s).
  useEffect(() => {
    if (!totw?.endTime) return;
    const t = setInterval(() => {
      if (Date.now() >= new Date(totw.endTime!).getTime()) {
        load();
      }
    }, 30000);
    return () => clearInterval(t);
  }, [totw, load]);

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="Track of the Week"
          subtitle="The current community spotlight track. Its leaderboard resets when the week ends."
        />
        <Freshness date={dataStatus?.last_fresh_run} />

        {loading && (
          <Panel className="px-6 py-6 text-center">
            <Spinner className="h-6 w-6" />
            <p className="mt-3 text-base text-zinc-400">Loading…</p>
          </Panel>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}

        {totw && (
          <>
            <div className="relative mb-6 pt-panel overflow-hidden">
              {totw.coverUrl && (
                <img
                  src={totw.coverUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-25"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}
              <div className="relative bg-gradient-to-r from-[#1a2450]/95 to-[#1a2450]/70 p-6 sm:p-8">
                <p className="text-[13px] font-medium uppercase tracking-widest text-fuchsia-300">
                  {ENV_NAMES[totw.environment] ?? 'Unknown'} environment
                </p>
                <h2 className="mt-1 text-3xl font-bold">{totw.name}</h2>
                <p className="mt-1 text-base text-zinc-400">by {totw.author}</p>
                {totw.endTime && (
                  <p className="mt-4 text-base text-zinc-400">
                    Rotates in <Countdown endTime={totw.endTime} />
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Entries" value={total.toLocaleString()} />
              <StatTile label="WR" value={entries[0] ? entries[0].nickname : 'n/a'} hint={entries[0] ? undefined : 'no verified times'} />
              <StatTile label="Track ID" value={<span className="font-mono text-base">{totw.trackId.slice(0, 12)}…</span>} />
            </div>

            <Panel className="overflow-hidden">
              <div className="border-b border-white/8 px-4 py-3 text-base font-semibold text-zinc-300">
                Leaderboard — top {entries.length}
                <span className="ml-2 text-[15px] font-normal text-zinc-400">of {total.toLocaleString()}</span>
              </div>
              <LeaderboardTable rows={entries} showMedal />
            </Panel>

            <p className="mt-3 text-[15px] text-zinc-400">
              Also known in PolyStats scans as “{trackName(totw.trackId) !== totw.trackId ? trackName(totw.trackId) : `Track of the Week: ${totw.name}`}”.
            </p>
          </>
        )}
      </PageShell>
    </div>
  );
};

export default TotwPage;
