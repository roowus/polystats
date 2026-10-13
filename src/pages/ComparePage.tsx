import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Plus } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote } from '@/components/shell';
import { PlayerSearchInput } from '@/components/PlayerSearchInput';
import { formatTime } from '@/lib/polytrack';
import { useUserStats } from '@/hooks/useUserStats';
import { computeAverages, type UserTrackEntry } from '@/lib/stats';
import { cn } from '@/lib/utils';

const HEX64 = /^[a-f0-9]{64}$/i;
const MAX_PLAYERS = 6;

interface DoneStatus {
  phase: 'done';
  nickname: string | null;
  entries: UserTrackEntry[];
}

/** One player column: runs its own scan and reports results upward. */
function PlayerPanel({
  id,
  onDone,
  onRemove,
}: {
  id: string;
  onDone: (id: string, nickname: string | null, entries: UserTrackEntry[]) => void;
  onRemove?: () => void;
}) {
  const { status, scan, reset } = useUserStats();

  useEffect(() => {
    scan(id);
    return () => reset();
  }, [id, scan, reset]);

  useEffect(() => {
    if (status.phase === 'done') onDone(id, status.nickname, status.entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const avg = status.phase === 'done' ? computeAverages(status.entries) : null;

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-bold text-white" title={id}>
          {status.phase === 'done' ? (status.nickname ?? `${id.slice(0, 10)}…`) : `${id.slice(0, 10)}…`}
        </h3>
        {onRemove && (
          <button onClick={onRemove} className="text-zinc-400 hover:text-white" title="Remove player">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {status.phase === 'done' ? (
        avg ? (
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Tracks</p>
              <p className="font-semibold tabular-nums text-white">{avg.tracks}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Avg rank</p>
              <p className="font-semibold tabular-nums text-white">{Math.round(avg.avgRank)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Avg gap</p>
              <p className="font-semibold tabular-nums text-white">{avg.avgWrGapPercent.toFixed(1)}%</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-400">No entries found</p>
        )
      ) : status.phase === 'error' ? (
        <p className="mt-2 text-xs text-red-300">{status.message}</p>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
          <Spinner className="h-3.5 w-3.5" /> scanning…
        </div>
      )}
    </Panel>
  );
}

const ComparePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ids = useMemo(
    () => (params.get('ids') ?? '').split(',').filter((s) => HEX64.test(s)).slice(0, MAX_PLAYERS),
    [params]
  );

  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, { nickname: string | null; entries: UserTrackEntry[] }>>({});

  const handleDone = useCallback((id: string, nickname: string | null, entries: UserTrackEntry[]) => {
    setResults((prev) => ({ ...prev, [id]: { nickname, entries } }));
  }, []);

  const addPlayer = useCallback(() => {
    const value = input.trim();
    const id = HEX64.test(value) ? value : '';
    if (!id) return;
    const next = [...new Set([...ids, id])].slice(0, MAX_PLAYERS);
    setInput('');
    navigate(`/compare?ids=${next.join(',')}`);
  }, [input, ids, navigate]);

  const removePlayer = useCallback(
    (id: string) => {
      const next = ids.filter((x) => x !== id);
      navigate(next.length ? `/compare?ids=${next.join(',')}` : '/compare');
    },
    [ids, navigate]
  );

  // Union of tracks where at least two scanned players have entries
  const doneIds = ids.filter((id) => results[id]);
  const trackMap = useMemo(() => {
    const map = new Map<string, { trackName: string; times: Record<string, number> }>();
    for (const id of doneIds) {
      for (const e of results[id].entries) {
        const slot = map.get(e.trackId) ?? { trackName: e.trackName, times: {} };
        slot.times[id] = e.frames;
        map.set(e.trackId, slot);
      }
    }
    return [...map.entries()].filter(([, v]) => Object.keys(v.times).length >= 2);
  }, [doneIds, results]);

  const playerColors = ['#bed8f7', '#ffd9a0', '#b8f2c9', '#f2b8d9', '#d9c1f7', '#f7e6b8'];

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="Compare Players"
          subtitle={`Head-to-head across shared tracks — up to ${MAX_PLAYERS} players at once.`}
        />

        <Panel className="mb-6 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <PlayerSearchInput
              value={input}
              onChange={setInput}
              onPick={(id) => {
                const next = [...new Set([...ids, id])].slice(0, MAX_PLAYERS);
                setInput('');
                navigate(`/compare?ids=${next.join(',')}`);
              }}
              placeholder="Add a player by name or User ID"
            />
            <button
              onClick={addPlayer}
              disabled={!HEX64.test(input.trim()) || ids.length >= MAX_PLAYERS}
              className="pt-btn"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {ids.length > 0 && (
            <p className="mt-2 text-xs text-zinc-400">
              {ids.length}/{MAX_PLAYERS} players loaded
            </p>
          )}
        </Panel>

        {ids.length > 0 && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ids.map((id) => (
              <PlayerPanel
                key={id}
                id={id}
                onDone={handleDone}
                onRemove={ids.length > 1 ? () => removePlayer(id) : undefined}
              />
            ))}
          </div>
        )}

        {trackMap.length > 0 && (
          <Panel className="overflow-hidden">
            <div className="border-b-2 border-white/12 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white">
              Head-to-head — {trackMap.length} shared track{trackMap.length === 1 ? '' : 's'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                    <th className="px-4 py-2.5 font-medium">Track</th>
                    {doneIds.map((id, i) => (
                      <th
                        key={id}
                        className="px-4 py-2.5 text-right font-medium"
                        style={{ color: playerColors[i % playerColors.length] }}
                      >
                        {results[id]?.nickname ?? `${id.slice(0, 8)}…`}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right font-medium">Best</th>
                  </tr>
                </thead>
                <tbody>
                  {trackMap.map(([trackId, { trackName, times }]) => {
                    const best = Math.min(...Object.values(times));
                    return (
                      <tr key={trackId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="max-w-[220px] truncate px-4 py-2.5">{trackName}</td>
                        {doneIds.map((id) => (
                          <td key={id} className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {times[id] !== undefined ? (
                              <span className={times[id] === best ? 'font-semibold text-emerald-300' : 'text-zinc-200'}>
                                {formatTime(times[id])}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-400">
                          {formatTime(best)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {doneIds.length >= 2 && trackMap.length === 0 && (
          <ErrorNote>No shared tracks between these players yet.</ErrorNote>
        )}
      </PageShell>
    </div>
  );
};

export default ComparePage;
