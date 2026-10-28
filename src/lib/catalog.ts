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

/**
 * Ask the backend to refresh a player's stored profile.
 *
 * Sends only the user id, never the nickname or car style. The worker resolves the
 * player from the public PolyTrack leaderboards and writes what the API returns, so
 * a forged request can name a player but cannot choose what is stored about them.
 */
export function upsertUserProfile(userId: string): void {
  fetch(`${workerOrigin()}/users`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
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

export interface UserSearchResult {
  user_id: string;
  nickname: string | null;
  car_style?: string | null;
  last_seen?: string;
}

/** Search players by username (substring match on the community catalog). */
export async function searchUsers(q: string, limit = 10): Promise<UserSearchResult[]> {
  try {
    const response = await fetch(`${workerOrigin()}/users?q=${encodeURIComponent(q)}&limit=${limit}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { users?: UserSearchResult[] };
    return data.users ?? [];
  } catch {
    return [];
  }
}

/** Full archived profile: current info + name/style histories + personal bests. */
export async function fetchUserProfile(userId: string): Promise<{
  user: Record<string, unknown> | null;
  names: { nickname: string; first_seen: string; last_seen: string }[];
  styles: { car_style: string; first_seen: string; last_seen: string }[];
  personal_bests: { track_id: string; time_ms: number; verified: number; updated_at: string }[];
} | null> {
  try {
    const response = await fetch(`${workerOrigin()}/users/profile?userId=${userId}`);
    if (!response.ok) return null;
    return (await response.json()) as {
      user: Record<string, unknown> | null;
      names: { nickname: string; first_seen: string; last_seen: string }[];
      styles: { car_style: string; first_seen: string; last_seen: string }[];
      personal_bests: { track_id: string; time_ms: number; verified: number; updated_at: string }[];
    };
  } catch {
    return null;
  }
}
