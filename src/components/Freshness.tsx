import { useEffect, useState } from 'react';
import { getProxyUrl } from '@/lib/polytrack';

export interface DataStatus {
  last_fresh_run: string | null;
  last_backfill_run: string | null;
  last_wr_watch?: string | null;
  users?: number;
  results?: number;
  wr_history?: number;
  snapshots?: number;
  totw_archive?: number;
}

/** Tan "data as of" line, telling users exactly when the archive was updated. */
export function Freshness({ date }: { date?: string | null }) {
  if (!date) return null;
  return (
    <p className="text-timestamp">
      Data as of {new Date(date.replace(' ', 'T') + 'Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </p>
  );
}

/** Fetches the worker's run metadata once per page load. */
export function useDataStatus(): DataStatus | null {
  const [status, setStatus] = useState<DataStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${getProxyUrl().split('?')[0].replace(/\/$/, '')}/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setStatus(d as DataStatus);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}
