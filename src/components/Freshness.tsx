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

/** Human-readable form of a worker timestamp, or an empty string if unparseable. */
export function formatTimestamp(value?: string | null): string {
  if (!value) return '';
  const parsed = parseTimestamp(value);
  if (!parsed) return '';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Tan "data as of" line, telling users exactly when the archive was updated. */
export function Freshness({ date }: { date?: string | null }) {
  const formatted = formatTimestamp(date);
  if (!formatted) return null;
  return <p className="text-timestamp">Data as of {formatted}</p>;
}

/** Fetches the worker's run metadata once per page load. */
/**
 * Cached data status.
 *
 * Every page shows a freshness line, so an uncached fetch means one worker call
 * per navigation. The worker's read budget is shared with the scrapers, so the
 * result is held for a few minutes and shared across mounts: within that window
 * navigating the site costs no worker calls at all.
 */
const STATUS_TTL_MS = 5 * 60 * 1000;
let statusCache: { at: number; value: DataStatus } | null = null;
let statusInFlight: Promise<DataStatus | null> | null = null;

function loadDataStatus(): Promise<DataStatus | null> {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) {
    return Promise.resolve(statusCache.value);
  }
  if (statusInFlight) return statusInFlight;

  const url = `${getProxyUrl().split('?')[0].replace(/\/$/, '')}/status`;
  statusInFlight = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d) statusCache = { at: Date.now(), value: d as DataStatus };
      return (d as DataStatus) ?? null;
    })
    .catch(() => null)
    .finally(() => {
      statusInFlight = null;
    });
  return statusInFlight;
}

export function useDataStatus(): DataStatus | null {
  const [status, setStatus] = useState<DataStatus | null>(statusCache?.value ?? null);
  useEffect(() => {
    let cancelled = false;
    loadDataStatus().then((d) => {
      if (!cancelled && d) setStatus(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

/** Drop the cached status. Exported for tests, which must not share module state. */
export function resetDataStatusCache(): void {
  statusCache = null;
  statusInFlight = null;
}
