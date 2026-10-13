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

/**
 * Parse a worker timestamp.
 *
 * `/status` returns ISO-8601 that already ends in `Z` (e.g.
 * `2026-10-13T21:20:42.638Z`), while some rows come from SQLite as
 * `YYYY-MM-DD HH:MM:SS` with no zone. Only append a zone when one is actually
 * missing, otherwise the value parses as an Invalid Date.
 */
export function parseTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tan "data as of" line, telling users exactly when the archive was updated. */
export function Freshness({ date }: { date?: string | null }) {
  if (!date) return null;
  const parsed = parseTimestamp(date);
  if (!parsed) return null;
  return (
    <p className="text-timestamp">
      Data as of {parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
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
