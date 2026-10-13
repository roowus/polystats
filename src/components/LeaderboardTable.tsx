import { formatTime } from '@/lib/polytrack';
import { medalFor, type Medal } from '@/lib/stats';
import { MedalBadge } from './shell';
import { cn } from '@/lib/utils';
import { SeasonIcon } from '@/components/SeasonIcon';

export interface RowEntry {
  trackId?: string;
  nickname?: string;
  subtitle?: string;
  subtitleSeason?: boolean;
  frames: number;
  position?: number;
  verifiedState?: number;
  countryCode?: string | null;
  isSelf?: boolean;
}

export function VerifiedDot({ state }: { state: number | undefined }) {
  if (state === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400" title="Verified">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-zinc-400" title="Unverified">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> unverified
    </span>
  );
}

/**
 * Unified leaderboard table used by the TOTW page, WR browser and user page.
 */
export function LeaderboardTable({
  rows,
  highlightUserId,
  showMedal,
  startIndex = 0,
  emptyLabel = 'No entries.',
}: {
  rows: RowEntry[];
  highlightUserId?: string;
  showMedal?: boolean;
  startIndex?: number;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-5 text-center text-base text-zinc-400">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="border-b border-white/8 text-left text-[13px] uppercase tracking-wider text-zinc-400">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 text-right font-medium">Time</th>
            {showMedal && <th className="px-4 py-3 font-medium">Medal</th>}
            <th className="px-4 py-3 text-right font-medium">Verified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const medal: Medal | null =
              showMedal && row.position !== undefined
                ? medalFor({ position: row.position })
                : null;
            const isSelf = highlightUserId && (row as { userId?: string }).userId === highlightUserId;
            return (
              <tr
                key={row.trackId ?? `${startIndex + i}-${row.nickname ?? 'Unknown'}`}
                className={cn(
                  'border-b border-white/5 transition-colors hover:bg-white/[0.04]',
                  isSelf && 'bg-purple-500/10 hover:bg-purple-500/15'
                )}
              >
                <td className="px-4 py-3 tabular-nums text-zinc-400">{row.position ?? startIndex + i + 1}</td>
                <td className="max-w-[240px] truncate px-4 py-3 font-medium">
                  {row.nickname ?? 'Unknown'}
                  {row.subtitle && (
                    <span className="flex items-center gap-1 text-[13px] font-normal text-zinc-400">
                      {row.subtitleSeason && <SeasonIcon trackName={row.subtitle} size={11} />}
                      {row.subtitle}
                    </span>
                  )}
                  {row.countryCode && (
                    <span className="ml-2 text-[13px] uppercase text-zinc-400">{row.countryCode}</span>
                  )}
                  {isSelf && <span className="ml-2 rounded bg-purple-500/25 px-1.5 py-0.5 text-[13px] font-semibold text-purple-300">YOU</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-violet-200">
                  {formatTime(row.frames)}
                </td>
                {showMedal && (
                  <td className="px-4 py-3">
                    {medal && <MedalBadge {...medal} size="sm" />}
                  </td>
                )}
                <td className="px-4 py-3 text-right text-[15px]">
                  <VerifiedDot state={row.verifiedState} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
