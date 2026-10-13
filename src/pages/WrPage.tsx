import { useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import { PageShell, PageTitle, Panel, Spinner, ErrorNote } from '@/components/shell';
import { Freshness, useDataStatus } from '@/components/Freshness';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Chip } from '@/components/ui-system';
import { fetchWorldRecord, type LeaderboardEntry } from '@/lib/polytrack';
import { OFFICIAL_TRACKS, COMMUNITY_TRACKS, type TrackInfo } from '@/lib/tracks';
import { getTrackCatalog } from '@/lib/liveTracks';
import { fetchTrackOfTheWeek } from '@/lib/polytrack';

interface WrRow extends LeaderboardEntry {
  trackName: string;
  trackGroup: 'official' | 'community' | 'totw';
}

const WrPage = () => {
  const [rows, setRows] = useState<WrRow[]>([]);
  const [missing, setMissing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataStatus = useDataStatus();
  const [filter, setFilter] = useState<'all' | 'official' | 'community' | 'totw'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let tracks: (TrackInfo & { group: 'official' | 'community' | 'totw' })[] = [
          ...OFFICIAL_TRACKS.map((t) => ({ ...t, group: 'official' as const })),
          ...COMMUNITY_TRACKS.map((t) => ({ ...t, group: 'community' as const })),
        ];
        // live catalog may contain newer tracks than the embedded list
        try {
          const { tracks: live } = await getTrackCatalog();
          const known = new Set(tracks.map((t) => t.id));
          for (const t of live) {
            if (!known.has(t.id)) tracks.push({ ...t, group: 'community' });
          }
        } catch {
          // embedded list still works
        }
        try {
          const totw = await fetchTrackOfTheWeek();
          if (totw) tracks = [{ name: `Track of the Week: ${totw.name}`, id: totw.trackId, group: 'totw' }, ...tracks];
        } catch { /* optional */ }

        let missed = 0;
        const results: WrRow[] = [];
        const CONCURRENCY = 10;
        const queue = [...tracks];
        const worker = async () => {
          while (queue.length > 0) {
            if (cancelled) return;
            const track = queue.shift()!;
            try {
              const wr = await fetchWorldRecord(track.id);
              if (wr) {
                results.push({ ...wr, trackName: track.name, trackGroup: track.group });
              } else {
                missed += 1;
              }
            } catch {
              missed += 1;
            }
          }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        if (cancelled) return;
        results.sort((a, b) => a.trackName.localeCompare(b.trackName));
        setRows(results);
        setMissing(missed);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load world records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => rows.filter((r) => filter === 'all' || r.trackGroup === filter), [rows, filter]);

  return (
    <div>
      <Navigation />
      <PageShell>
        <PageTitle
          title="World Records"
          subtitle="The verified world record on every track: official, community, and the current Track of the Week."
        />
        <Freshness date={dataStatus?.last_fresh_run} />

        {loading && (
          <Panel className="p-10 text-center">
            <Spinner className="h-6 w-6" />
            <p className="mt-3 text-sm text-zinc-400">Fetching records across all tracks…</p>
          </Panel>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && (
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
              {(['all', 'official', 'community', 'totw'] as const).map((f) => (
                <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                  {f === 'totw' ? 'Track of the Week' : f}
                </Chip>
              ))}
              <span className="ml-auto text-xs text-zinc-600">
                {visible.length} tracks{missing > 0 ? ` · ${missing} with no verified time` : ''}
              </span>
            </div>
            <LeaderboardTable rows={visible.map((r) => ({ ...r, subtitle: r.trackName, subtitleSeason: true }))} showMedal emptyLabel="No records loaded." />
          </Panel>
        )}
      </PageShell>
    </div>
  );
};

export default WrPage;
