import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Copy, Check, Swords } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { PlayerSearchInput } from '@/components/PlayerSearchInput';
import { CarPic } from '@/components/CarPic';
import { Chip, SortButton } from '@/components/ui-system';
import { PageShell, PageTitle, Panel, StatTile, MedalBadge, Spinner, ErrorNote } from '@/components/shell';
import { useUserStats } from '@/hooks/useUserStats';
import { formatTime } from '@/lib/polytrack';
import {
  computeAverages,
  groupMedals,
  bestWorst,
  MEDAL_ORDER,
  getRankMedal,
  type UserTrackEntry,
} from '@/lib/stats';
import { cn } from '@/lib/utils';
import { SeasonIcon } from '@/components/SeasonIcon';
import {
  getRecentUsers,
  getSavedUsers,
  isSaved,
  pushRecentUser,
  toggleSavedUser,
  type StoredUser,
} from '@/lib/userStore';
import { fetchCatalog, fetchUserProfile, searchUsers, shareToCatalog, upsertUserProfile, type UserSearchResult } from '@/lib/catalog';

type SortKey = 'name' | 'time' | 'rank' | 'gap';

const SORTERS: Record<SortKey, (a: UserTrackEntry, b: UserTrackEntry) => number> = {
  name: (a, b) => a.trackName.localeCompare(b.trackName),
  time: (a, b) => a.frames - b.frames,
  rank: (a, b) => (a.position ?? 1e9) - (b.position ?? 1e9),
  gap: (a, b) => (a.wrPercentGap ?? 1e9) - (b.wrPercentGap ?? 1e9),
};

const UserPage = () => {
  const { userId: routeId } = useParams();
  const navigate = useNavigate();
  const { status, scan, reset } = useUserStats();
  const userId = routeId; // hex id when present

  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState<SortKey>('rank');
  const [filter, setFilter] = useState<'all' | 'official' | 'community' | 'totw'>('all');
  const [nameResults, setNameResults] = useState<UserSearchResult[] | null>(null);
  const [cachedProfile, setCachedProfile] = useState<Awaited<ReturnType<typeof fetchUserProfile>> | null>(null);
  const [recents, setRecents] = useState<StoredUser[]>([]);
  const [saved, setSaved] = useState<StoredUser[]>([]);
  const [community, setCommunity] = useState<StoredUser[]>([]);
  const [savedFlag, setSavedFlag] = useState(false);

  const refreshLists = useCallback(() => {
    setRecents(getRecentUsers());
    setSaved(getSavedUsers());
    if (userId) setSavedFlag(isSaved(userId));
  }, [userId]);

  useEffect(() => {
    refreshLists();
    fetchCatalog(12).then((users) => {
      if (users) setCommunity(users.map((u) => ({ id: u.user_id, nickname: u.nickname ?? undefined, at: Date.now() })));
    });
  }, [refreshLists]);

  useEffect(() => {
    if (userId && /^[a-f0-9]{64}$/i.test(userId)) {
      // DB-first: show what we already know instantly, then refresh live.
      fetchUserProfile(userId)
        .then((p) => {
          if (p && (p.user || p.names.length > 0)) setCachedProfile(p);
        })
        .catch(() => {});
      scan(userId);
    }
    return () => reset();
  }, [userId, scan, reset]);

  const search = useCallback(async () => {
    const value = input.trim();
    if (!value) return;
    if (/^[a-f0-9]{64}$/i.test(value)) {
      navigate(`/user/${value}`);
    } else {
      // username search across the community catalog
      const results = await searchUsers(value);
      setNameResults(results);
    }
  }, [input, navigate]);

  const copy = () => {
    if (!userId) return;
    navigator.clipboard?.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const entries = status.phase === 'done' ? status.entries : [];
  const nickname = status.phase === 'done' ? status.nickname : null;

  /**
   * Car style for the header image.
   *
   * The catalog profile is preferred because it covers every known player, while
   * a leaderboard entry only exists for someone who has actually set a time. The
   * styles history is the last resort: it is written whenever a player is seen,
   * so it still identifies the car for a player with no records.
   */
  const headerCarStyle =
    (cachedProfile?.user?.car_style as string | undefined) ??
    entries[0]?.carStyle ??
    cachedProfile?.styles?.at(-1)?.car_style ??
    null;
  const averages = computeAverages(entries);
  const medals = groupMedals(entries);
  const extremes = bestWorst(entries);
  const visible = entries
    .filter((e) => filter === 'all' || e.trackGroup === filter)
    .sort(SORTERS[sort]);

  const showSearch = !userId || status.phase === 'idle' || status.phase === 'error';

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="User Stats"
          subtitle="Paste a User ID or User Token. Every official, community and Track of the Week leaderboard is scanned."
        />

        {nameResults && (
          <Panel className="mb-6 p-4">
            <p className="mb-2 text-[15px] uppercase tracking-wider text-zinc-400">
              {nameResults.length} player{safeLen(nameResults)} found. Click one to open:
            </p>
            {nameResults.length === 0 ? (
              <p className="text-base text-zinc-400">No players with that name in the catalog yet.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {nameResults.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => {
                      setNameResults(null);
                      navigate(`/user/${u.user_id}`);
                    }}
                    className="flex w-full items-center justify-between px-2 py-2 text-left hover:bg-white/10"
                  >
                    <span className="font-semibold text-white">{u.nickname ?? 'Unknown'}</span>
                    <span className="font-mono text-[15px] text-zinc-400">{u.user_id.slice(0, 12)}…</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}

        {showSearch && (
          <Panel className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <PlayerSearchInput
                className="w-full flex-1"
                value={input}
                onChange={setInput}
                onPick={(id: string) => {
                  setInput(id);
                  navigate(`/user/${id}`);
                }}
                placeholder="Player name, User ID (64-char hex) or User Token"
              />
              <button
                onClick={search}
                disabled={!input.trim()}
                className="flex items-center justify-center gap-2 bg-[#212b58] border border-white/20 hover:bg-[#1c2f70] px-5 py-2.5 text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                <Search className="h-4 w-4" /> Search
              </button>
            </div>
            <UserChips label="Saved" users={saved} onPick={(id) => navigate(`/user/${id}`)} onEmpty={
              <span className="text-zinc-400">No saved players yet. Hit the star on a player page.</span>
            } />
            <UserChips label="Recent" users={recents} onPick={(id) => navigate(`/user/${id}`)} onEmpty={
              <span className="text-zinc-400">Your recent lookups will appear here.</span>
            } />
            <UserChips label="Community favorites" users={community} onPick={(id) => navigate(`/user/${id}`)} onEmpty={
              <span className="text-zinc-400">The most-saved players will appear here.</span>
            } />
          </Panel>
        )}

        {status.phase === 'scanning' && (
          <Panel className="p-6 text-center" data-fresh="refreshing">
            <Spinner className="h-6 w-6" />
            <p className="mt-3 text-base text-zinc-300">
              Scanning leaderboards… {status.done}/{status.total}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden bg-white/10">
              <div
                className="h-full bg-[#7f9cf5] transition-all"
                style={{ width: `${(status.done / status.total) * 100}%` }}
              />
            </div>
          </Panel>
        )}

        {status.phase === 'enriching' && (
          <Panel className="p-6 text-center">
            <Spinner className="h-6 w-6" />
            <p className="mt-3 text-base text-zinc-300">
              Found {status.found} track{status.found === 1 ? '' : 's'}, loading details...
            </p>
          </Panel>
        )}

        {cachedProfile && status.phase !== 'done' && (
          <Panel className="mb-6 p-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-white">
                From database: {String((cachedProfile.user as { nickname?: string } | null)?.nickname ?? 'unknown player')}
              </p>
              <span className="flex items-center gap-2 text-[15px] text-zinc-300">
                <Spinner className="h-3 w-3" /> refreshing from PolyTrack…
              </span>
            </div>
            {cachedProfile.names.length > 0 && (
              <p className="mt-1 text-timestamp">
                Known as: {cachedProfile.names.map((n) => n.nickname).join(' → ')}
              </p>
            )}
            {cachedProfile.styles.length > 0 && (
              <p className="mt-1 text-timestamp">
                {cachedProfile.styles.length} car style{cachedProfile.styles.length === 1 ? '' : 's'} on record
              </p>
            )}
          </Panel>
        )}

        {status.phase === 'no-entries' && (
          <div className="w-full">
            <ErrorNote>
              <p className="font-medium">No leaderboard entries found.</p>
              <p className="mt-1 text-red-200/80">
                Every official, community and Track of the Week leaderboard was checked. This
                player exists but hasn&apos;t set a time yet, or the ID is wrong.
              </p>
            </ErrorNote>
          </div>
        )}

        {status.phase === 'error' && <ErrorNote>{status.message}</ErrorNote>}

        {status.phase === 'done' && (
          <RecentRecorder
            userId={userId!}
            nickname={status.nickname}
            onChange={refreshLists}
          />
        )}

        {status.phase === 'done' && (
          <>
            {/* Player header */}
            <Panel className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <CarPic carStyle={headerCarStyle} size={56} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 truncate text-xl font-bold">
                  {nickname ?? 'Unknown player'}
                  <button
                    onClick={() => {
                      const nowSaved = toggleSavedUser(userId!, nickname ?? undefined);
                      setSavedFlag(nowSaved);
                      refreshLists();
                      if (nowSaved) shareToCatalog(userId!, nickname ?? undefined);
                    }}
                    className={cn('text-lg transition', savedFlag ? 'text-amber-300' : 'text-zinc-400 hover:text-zinc-300')}
                    title={savedFlag ? 'Remove from saved players' : 'Save player'}
                  >
                    {savedFlag ? '★' : '☆'}
                  </button>
                </h2>
                <div className="mt-1 flex items-center gap-2 text-[15px] text-zinc-400">
                  <span className="max-w-[280px] truncate font-mono sm:max-w-[420px]">{userId}</span>
                  <button onClick={copy} className="text-zinc-400 hover:text-purple-300" title="Copy User ID">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => navigate(`/compare?ids=${userId}`)}
                className="flex items-center gap-2 self-start border border-purple-500/40 px-4 py-3 text-base font-medium text-purple-300 transition hover:bg-purple-500/10"
              >
                <Swords className="h-4 w-4" /> Compare
              </button>
            </Panel>

            {/* Summary tiles */}
            {averages && (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Tracks played" value={averages.tracks} />
                <StatTile label="Avg time" value={formatTime(averages.avgTimeMs)} />
                <StatTile
                  label="Avg rank"
                  value={Math.round(averages.avgRank)}
                  hint={getRankMedal(averages.avgRank) ? getRankMedal(averages.avgRank)!.label : undefined}
                />
                <StatTile
                  label="Avg WR gap"
                  value={`${averages.avgWrGapPercent.toFixed(2)}%`}
                  accent={averages.avgWrGapPercent < 5 ? '#32CD32' : averages.avgWrGapPercent < 15 ? '#FFA500' : '#FF6B6B'}
                />
              </div>
            )}

            {/* Medals */}
            {Object.keys(medals).length > 0 && (
              <Panel className="mb-6 p-5">
                <h3 className="mb-3 text-base font-semibold text-zinc-300">Medals</h3>
                <div className="flex flex-wrap gap-2">
                  {MEDAL_ORDER.filter((m) => medals[m]?.length).map((label) => {
                    const medalEntry = medals[label][0];
                    const medal =
                      (medalEntry && getRankMedal(medalEntry.position)) ??
                      { icon: '♦', label, color: '#A78BFA', type: 'mineral' as const };
                    return (
                      <span key={label} className="group relative">
                        <MedalBadge icon={medal.icon} label={`${label} ×${medals[label].length}`} color={medal.color} />
                        <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap border border-white/10 bg-[#212b58] px-2 py-1 text-[13px] text-zinc-300 shadow-xl group-hover:block">
                          {medals[label].map((e) => e.trackName).join(', ')}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </Panel>
            )}

            {/* Best / worst */}
            {extremes && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                {(['best', 'worst'] as const).map((kind) => {
                  const e = (kind === 'best' ? extremes.time!.best : extremes.time!.worst)!;
                  return (
                    <Panel key={kind} className="p-4">
                      <p className="text-[13px] font-medium uppercase tracking-wider text-zinc-400">{kind} time</p>
                      <p className="mt-1 font-mono text-lg text-violet-200">{formatTime(e.frames)}</p>
                      <p className="truncate text-[15px] text-zinc-400">{e.trackName}</p>
                    </Panel>
                  );
                })}
              </div>
            )}

            {/* Track table */}
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
                {(['all', 'official', 'community', 'totw'] as const).map((f) => (
                  <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                    {f === 'totw' ? 'Track of the Week' : f}
                  </Chip>
                ))}
                <div className="ml-auto flex items-center gap-1 text-[15px] text-zinc-400">
                  sort:
                  {(['rank', 'time', 'gap', 'name'] as const).map((k) => (
                    <SortButton key={k} active={sort === k} onClick={() => setSort(k)}>
                      {k}
                    </SortButton>
                  ))}
                </div>
              </div>
              {visible.length === 0 ? (
                <p className="px-4 py-5 text-center text-base text-zinc-400">No entries in this category.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {visible.map((e) => (
                    <div key={e.trackId} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                      <div className="w-10 shrink-0 text-center">
                        <span className="text-lg font-bold tabular-nums text-zinc-300">#{e.position}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-base font-medium">
                          <SeasonIcon trackName={e.trackName} />
                          {e.trackName}
                        </p>
                        <p className="text-[13px] text-zinc-400">
                          {formatTime(e.frames)}
                          {e.wrTime !== undefined && ` · WR ${formatTime(e.wrTime)}`}
                          {` · ${(100 - (e.percent ?? 0)).toFixed(1)}th percentile`}
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        {e.wrPercentGap !== undefined && (
                          <span
                            className="text-[15px] font-medium tabular-nums"
                            style={{ color: e.wrPercentGap < 5 ? '#32CD32' : e.wrPercentGap < 15 ? '#FFA500' : '#FF6B6B' }}
                          >
                            +{e.wrPercentGap.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </PageShell>
    </div>
  );
};


function safeLen(arr: unknown[]): string {
  return arr.length === 1 ? '' : 's';
}

export default UserPage;

/** Writes a finished scan into local recents; renders nothing. */
function RecentRecorder({
  userId,
  nickname,
  onChange,
}: {
  userId: string;
  nickname: string | null;
  onChange: () => void;
}) {
  useEffect(() => {
    pushRecentUser(userId, nickname ?? undefined);
    // Ask the backend to refresh this player from the PolyTrack API. It sends only
    // the user id; the worker decides what to store.
    upsertUserProfile(userId);
    onChange();
    // run once per finished scan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, nickname]);
  return null;
}

function UserChips({
  label,
  users,
  onPick,
  onEmpty,
}: {
  label: string;
  users: StoredUser[];
  onPick: (id: string) => void;
  onEmpty: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[13px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      {users.length === 0 ? (
        onEmpty
      ) : (
        <div className="flex flex-wrap gap-2">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u.id)}
              className="bg-[#212b58] px-3 py-1 text-[15px] font-medium text-white ring-1 ring-white/25 transition hover:bg-[#1c2f70] hover:ring-white/50"
              title={u.id}
            >
              <span className="flex items-center gap-1.5">
                {u.nickname ?? `${u.id.slice(0, 8)}…`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
