/**
 * Client for the community player catalog served by the polystats-proxy
 * worker (GET/POST /catalog, backed by D1). Saving a player shares it with
 * everyone; the worker allow-lists which origins may write.
 */

import { getProxyUrl } from './polytrack';

/** The worker's origin, derived from the configured proxy URL. */
function workerOrigin(): string {
  return getProxyUrl().split('?')[0].replace(/\/$/, '');
}

export interface CatalogUser {
  user_id: string;
  nickname: string | null;
  saved_count: number;
  last_seen: string;
}

/** Share a saved player with the community catalog. Fire-and-forget safe. */
export function shareToCatalog(userId: string, nickname?: string): void {
  const body = JSON.stringify({ userId, nickname });
  fetch(`${workerOrigin()}/catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {
    // offline / binding missing — local save still stands
  });
}

/** Upsert a player profile (nickname/car style) into the community database. */
export function upsertUserProfile(userId: string, nickname?: string, carStyle?: string): void {
  fetch(`${workerOrigin()}/users`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, nickname, carStyle }),
  }).catch(() => {
    // local-only context; ignore
  });
}

/** Most-saved players across the community; null when unavailable. */
export async function fetchCatalog(limit = 50): Promise<CatalogUser[] | null> {
  try {
    const response = await fetch(`${workerOrigin()}/catalog?limit=${limit}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { users?: CatalogUser[] };
    return data.users ?? null;
  } catch {
    return null;
  }
}
