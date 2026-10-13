import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote, StatTile } from '@/components/shell';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await fetchTrackOfTheWeek();
        if (!t) throw new Error('No Track of the Week available right now.');
        if (cancelled) return;
        setTotw(t);
        const data = await fetchLeaderboard({ trackId: t.trackId, skip: 0, amount: 50, onlyVerified: false });
        if (cancelled) return;
        setEntries(data.entries);
        setTotal(data.total);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load Track of the Week.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="Track of the Week"
          subtitle="The current community spotlight track — its leaderboard resets when the week ends."
        />

        {loading && (
          <Panel className="p-10 text-center">
            <Spinner className="h-6 w-6" />
            <p className="mt-3 text-sm text-zinc-400">Loading…</p>
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
              <div className="relative bg-gradient-to-r from-[#102052]/95 to-[#102052]/70 p-6 sm:p-8">
                <p className="text-[11px] font-medium uppercase tracking-widest text-fuchsia-300">
                  {ENV_NAMES[totw.environment] ?? 'Unknown'} environment
                </p>
                <h2 className="mt-1 text-3xl font-bold">{totw.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">by {totw.author}</p>
                {totw.endTime && (
                  <p className="mt-4 text-sm text-zinc-400">
                    Rotates in <Countdown endTime={totw.endTime} />
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Entries" value={total.toLocaleString()} />
              <StatTile label="WR" value={entries[0] ? `${entries[0].nickname}` : '—'} hint={entries[0] ? undefined : 'no verified times'} />
              <StatTile label="Track ID" value={<span className="font-mono text-sm">{totw.trackId.slice(0, 12)}…</span>} />
            </div>

            <Panel className="overflow-hidden">
              <div className="border-b border-white/8 px-4 py-3 text-sm font-semibold text-zinc-300">
                Leaderboard — top {entries.length}
                <span className="ml-2 text-xs font-normal text-zinc-500">of {total.toLocaleString()}</span>
              </div>
              <LeaderboardTable rows={entries} showMedal />
            </Panel>

            <p className="mt-3 text-xs text-zinc-600">
              Also known in PolyStats scans as “{trackName(totw.trackId) !== totw.trackId ? trackName(totw.trackId) : `Track of the Week: ${totw.name}`}”.
            </p>
          </>
        )}
      </PageShell>
    </div>
  );
};

export default TotwPage;
