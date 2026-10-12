import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote } from '@/components/shell';
import { formatTime } from '@/lib/polytrack';
import { useUserStats } from '@/hooks/useUserStats';
import { computeAverages, type UserTrackEntry } from '@/lib/stats';
import { cn } from '@/lib/utils';

const HEX64 = /^[a-f0-9]{64}$/i;

function Side({
  label,
  data,
  onRemove,
}: {
  label: string;
  data: ReturnType<typeof useUserStats>['status'];
  onRemove?: () => void;
}) {
  if (data.phase === 'done') {
    const avg = computeAverages(data.entries);
    return (
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="truncate text-lg font-bold text-violet-200">{data.nickname ?? label}</h3>
          {onRemove && (
            <button onClick={onRemove} className="text-zinc-500 hover:text-zinc-200" title="Remove">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Tracks</p>
            <p className="font-semibold tabular-nums">{avg?.tracks ?? 0}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Avg rank</p>
            <p className="font-semibold tabular-nums">{avg ? Math.round(avg.avgRank) : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Avg WR gap</p>
            <p className="font-semibold tabular-nums">{avg ? `${avg.avgWrGapPercent.toFixed(1)}%` : '—'}</p>
          </div>
        </div>
      </Panel>
    );
  }
  if (data.phase === 'scanning' || data.phase === 'enriching') {
    return (
      <Panel className="p-5 text-center">
        <Spinner className="h-5 w-5" />
        <p className="mt-2 text-xs text-zinc-400">{label}</p>
      </Panel>
    );
  }
  if (data.phase === 'no-entries') {
    return (
      <Panel className="p-5 text-center text-sm text-zinc-500">
        {label}: no entries found
      </Panel>
    );
  }
  return (
    <Panel className="p-5 text-center text-sm text-zinc-600">{label}: waiting…</Panel>
  );
}

const ComparePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter((s) => HEX64.test(s));
  const [a, setA] = useState<string>(ids[0] ?? '');
  const [b, setB] = useState<string>(ids[1] ?? '');
  const [inputA, setInputA] = useState(ids[0] ?? '');
  const [inputB, setInputB] = useState(ids[1] ?? '');
  const left = useUserStats();
  const right = useUserStats();

  const start = useCallback(() => {
    const na = HEX64.test(a) ? a : '';
    const nb = HEX64.test(b) ? b : '';
    if (!na && !nb) return;
    navigate(`/compare?ids=${[na, nb].filter(Boolean).join(',')}`);
    left.reset();
    right.reset();
    if (na) left.scan(na);
    if (nb) right.scan(nb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, navigate]);

  useEffect(() => {
    if (ids[0] && ids[0] !== a) setA(ids[0]);
    if (ids[1] && ids[1] !== b) setB(ids[1]);
    if (ids[0]) left.scan(ids[0]);
    if (ids[1]) right.scan(ids[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const leftEntries = left.status.phase === 'done' ? left.status.entries : [];
  const rightEntries = right.status.phase === 'done' ? right.status.entries : [];
  const rightById = new Map(rightEntries.map((e) => [e.trackId, e]));
  const common = leftEntries.filter((e) => rightById.has(e.trackId));

  const deltaCell = (l: UserTrackEntry, r: UserTrackEntry) => {
    const diff = l.frames - r.frames;
    const color = diff < 0 ? 'text-emerald-400' : diff > 0 ? 'text-red-400' : 'text-zinc-500';
    return (
      <span className={cn('font-mono text-xs tabular-nums', color)}>
        {diff === 0 ? '=' : `${diff < 0 ? '−' : '+'}${formatTime(Math.abs(diff))}`}
      </span>
    );
  };

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="Compare Players"
          subtitle="Head-to-head across every track both players have set a time on."
        />

        <Panel className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              placeholder="Player A — User ID"
              className="rounded-md border border-white/15 bg-[rgba(20,20,45,0.6)] px-4 py-2.5 font-mono text-sm outline-none focus:border-purple-500/60"
            />
            <input
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              placeholder="Player B — User ID (optional)"
              className="rounded-md border border-white/15 bg-[rgba(20,20,45,0.6)] px-4 py-2.5 font-mono text-sm outline-none focus:border-purple-500/60"
            />
            <button
              onClick={start}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#112052] border border-white/20 hover:bg-[#1a2d6e] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Search className="h-4 w-4" /> Compare
            </button>
          </div>
        </Panel>

        {(a || b) && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <Side label={a ? `${a.slice(0, 10)}…` : 'Player A'} data={left.status} />
            <Side label={b ? `${b.slice(0, 10)}…` : 'Player B'} data={right.status} />
          </div>
        )}

        {common.length > 0 && (
          <Panel className="overflow-hidden">
            <div className="border-b border-white/8 px-4 py-3 text-sm font-semibold text-zinc-300">
              Head-to-head — {common.length} shared track{common.length === 1 ? '' : 's'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-2.5 font-medium">Track</th>
                    <th className="px-4 py-2.5 text-right font-medium">A time</th>
                    <th className="px-4 py-2.5 text-right font-medium">B time</th>
                    <th className="px-4 py-2.5 text-right font-medium">Δ</th>
                    <th className="px-4 py-2.5 text-right font-medium">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {common.map((l) => {
                    const r = rightById.get(l.trackId)!;
                    const aWins = l.frames < r.frames;
                    return (
                      <tr key={l.trackId} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="max-w-[220px] truncate px-4 py-2.5">{l.trackName}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatTime(l.frames)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatTime(r.frames)}</td>
                        <td className="px-4 py-2.5 text-right">{deltaCell(l, r)}</td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <span className={aWins ? 'text-violet-300' : 'text-fuchsia-300'}>
                            {aWins ? 'A' : 'B'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {left.status.phase === 'done' && right.status.phase === 'done' && common.length === 0 && (
          <ErrorNote>These two players have no tracks in common.</ErrorNote>
        )}
      </PageShell>
    </div>
  );
};

export default ComparePage;
