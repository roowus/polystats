/**
 * PolyTrack API client (game version 0.6.x, "v6" API).
 *
 * The PolyTrack leaderboard API lives at https://vps.kodub.com/v6/ and only
 * accepts requests whose `Origin` header is the game's own origin
 * (https://app-polytrack.kodub.com). Requests from any other origin receive
 * HTTP 403, so PolyStats routes every call through a small CORS proxy that
 * sets the correct Origin header. See `worker/` in the repo root for a
 * ready-to-deploy Cloudflare Worker.
 *
 * Proxy URL resolution order:
 *   1. localStorage key `polystats_proxy_url`  (runtime override)
 *   2. build-time env var `VITE_PROXY_URL`
 *   3. DEFAULT_PROXY_URL
 */

export const API_VERSION = '0.6.3';

export const API_ORIGIN = 'https://vps.kodub.com';
export const API_BASE = `${API_ORIGIN}/v6/`;

/** The game origin the API requires; the proxy must send this as `Origin`. */
export const GAME_ORIGIN = 'https://app-polytrack.kodub.com';

export const DEFAULT_PROXY_URL = 'https://polystats-proxy.workers.dev/?url=';

export const PROXY_STORAGE_KEY = 'polystats_proxy_url';

/** Resolve the proxy URL to use (see module docblock). */
export function getProxyUrl(): string {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(PROXY_STORAGE_KEY) : null;
    if (stored) return stored;
  } catch {
    // localStorage unavailable (e.g. tests / privacy mode) — fall through.
  }
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_PROXY_URL || DEFAULT_PROXY_URL;
}

/** Allow tests (or a settings UI) to override the proxy. */
export function setProxyUrl(url: string | null): void {
  try {
    if (url === null) localStorage.removeItem(PROXY_STORAGE_KEY);
    else localStorage.setItem(PROXY_STORAGE_KEY, url);
  } catch {
    // Ignore storage failures; the next getProxyUrl() call falls back.
  }
}

/** Wrap a target API URL with the CORS proxy, as the components expect. */
export function proxyUrl(targetUrl: string): string {
  return `${getProxyUrl()}${encodeURIComponent(targetUrl)}`;
}

// ---------------------------------------------------------------------------
// URL builders — every returned string is already wrapped in the proxy.
// ---------------------------------------------------------------------------

export interface LeaderboardParams {
  trackId: string;
  skip?: number;
  amount?: number;
  onlyVerified?: boolean;
  /** SHA-256 hash of a user token, used to locate that user's entry. */
  userTokenHash?: string;
}

export function buildLeaderboardUrl({
  trackId,
  skip = 0,
  amount = 10,
  onlyVerified = false,
  userTokenHash,
}: LeaderboardParams): string {
  let url =
    `${API_BASE}leaderboard?version=${API_VERSION}` +
    `&trackId=${encodeURIComponent(trackId)}` +
    `&skip=${skip}&amount=${amount}&onlyVerified=${onlyVerified}`;
  if (userTokenHash) url += `&userTokenHash=${encodeURIComponent(userTokenHash)}`;
  return proxyUrl(url);
}

export function buildUserUrl(userToken: string): string {
  return proxyUrl(`${API_BASE}user?version=${API_VERSION}&userToken=${encodeURIComponent(userToken)}`);
}

export function buildRecordingsUrl(ids: number[]): string {
  return proxyUrl(`${API_BASE}recordings?version=${API_VERSION}&ids=${ids.join(',')}`);
}

export function buildTrackOfTheWeekUrl(): string {
  return proxyUrl(`${API_BASE}trackOfTheWeek?version=${API_VERSION}`);
}

// ---------------------------------------------------------------------------
// Data types (normalised to the field names the UI already consumes).
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  id: number;
  userId: string;
  /** Normalised from the API's `nickname`. */
  name: string;
  /** Normalised from the API's `carStyle` — four concatenated RRGGBB hex colors. */
  carColors: string;
  nickname?: string;
  countryCode?: string | null;
  /** Raw serialized car style as returned by the API. */
  carStyle?: string;
  /** Race time in milliseconds (the API calls this field `frames`). */
  frames: number;
  verifiedState?: number;
  position?: number;
  rank?: number;
  percent?: number;
  wrTime?: number;
  wrTimeGap?: number;
  wrPercentGap?: number;
}

export interface LeaderboardData {
  total: number;
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
}

export interface UserBasicData {
  name: string;
  carColors: string;
  isVerifier: boolean | 'N/A';
  nickname?: string;
  countryCode?: string | null;
  carStyle?: string;
  isVerifierRaw?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 of a string, hex encoded (used to derive user IDs from tokens). */
export async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode the serialized `carStyle` field into the legacy 24-char hex format
 * expected by the UI (four concatenated RRGGBB colors).
 *
 * Binary layout (16 bytes, base64 encoded by the API):
 *   [0] version (0)
 *   [1] pattern, [2] rims, [3] exhaust
 *   [4..6], [7..9], [10..12], [13..15] — four RGB colors
 */
export function decodeCarStyle(carStyle: string): string {
  if (!carStyle) return '';
  let bytes: Uint8Array;
  try {
    const binary = atob(carStyle);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return '';
  }
  if (bytes.length < 16 || bytes[0] !== 0) return '';
  const colors: string[] = [];
  for (let c = 0; c < 4; c++) {
    const r = bytes[4 + c * 3];
    const g = bytes[5 + c * 3];
    const b = bytes[6 + c * 3];
    colors.push(
      r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0')
    );
  }
  return colors.join('');
}

/** Map a raw API entry onto the normalised shape used by the UI. */
export function normalizeEntry(raw: Record<string, unknown>): LeaderboardEntry {
  const nickname = typeof raw.nickname === 'string' ? raw.nickname : '';
  const carStyle = typeof raw.carStyle === 'string' ? raw.carStyle : '';
  return {
    ...raw,
    id: raw.id as number,
    userId: raw.userId as string,
    nickname,
    name: nickname,
    carStyle,
    carColors: decodeCarStyle(carStyle),
    frames: typeof raw.frames === 'number' ? raw.frames : 0,
    verifiedState: typeof raw.verifiedState === 'number' ? raw.verifiedState : undefined,
  } as LeaderboardEntry;
}

/**
 * Format a time in milliseconds as `mm:ss.mmm` (hours spill into minutes),
 * matching the in-game time format.
 */
export function formatTime(framesMs: number): string {
  const n = Math.abs(framesMs);
  const m = Math.floor(n / 60000);
  const s = Math.floor((n - 60000 * m) / 1000);
  const ms = n - 60000 * m - 1000 * s;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}


export interface TrackOfTheWeek {
  trackId: string;
  name: string;
  author: string;
  environment: number;
  endTime: string | null;
  thumbnailUrl?: string;
  coverUrl?: string;
}

/** Fetch the current Track of the Week; null if unavailable. */
export async function fetchTrackOfTheWeek(): Promise<TrackOfTheWeek | null> {
  try {
    const response = await fetch(buildTrackOfTheWeekUrl());
    if (!response.ok) return null;
    const raw = (await response.json()) as {
      current?: { trackId?: string; name?: string; author?: string; environment?: number; endTime?: string; thumbnailUrl?: string; coverUrl?: string } | null;
    };
    const c = raw.current;
    if (!c?.trackId) return null;
    return {
      trackId: c.trackId,
      name: c.name ?? 'Track of the Week',
      author: c.author ?? '',
      environment: c.environment ?? 0,
      endTime: c.endTime ?? null,
      thumbnailUrl: c.thumbnailUrl,
      coverUrl: c.coverUrl,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Fetch a leaderboard page and normalise its entries. */
export async function fetchLeaderboard(params: LeaderboardParams): Promise<LeaderboardData> {
  const response = await fetch(buildLeaderboardUrl(params));
  if (!response.ok) {
    throw new Error(`Leaderboard request failed: ${response.status}`);
  }
  const raw = (await response.json()) as {
    total: number;
    entries?: Record<string, unknown>[] | null;
    userEntry?: Record<string, unknown> | null;
  };
  return {
    total: raw.total ?? 0,
    entries: (raw.entries ?? []).map(normalizeEntry),
    userEntry: raw.userEntry ? normalizeEntry(raw.userEntry) : null,
  };
}

/** Fetch a user profile by token; returns null when the token is unknown. */
export async function fetchUser(userToken: string): Promise<UserBasicData | null> {
  const response = await fetch(buildUserUrl(userToken));
  if (!response.ok) {
    throw new Error(`User request failed: ${response.status}`);
  }
  const raw = (await response.json()) as Record<string, unknown> | null;
  if (!raw) return null;
  const nickname = typeof raw.nickname === 'string' ? raw.nickname : '';
  const carStyle = typeof raw.carStyle === 'string' ? raw.carStyle : '';
  return {
    nickname,
    name: nickname,
    countryCode: (raw.countryCode as string | null) ?? null,
    carStyle,
    carColors: decodeCarStyle(carStyle),
    isVerifier: typeof raw.isVerifier === 'boolean' ? raw.isVerifier : 'N/A',
    isVerifierRaw: typeof raw.isVerifier === 'boolean' ? raw.isVerifier : undefined,
  };
}

export interface UserEntryLight {
  position: number;
  frames: number;
  id: number;
}

/** Light-weight "does this user have an entry on this track" check. */
export async function fetchUserEntryLight(
  trackId: string,
  userTokenHash: string
): Promise<UserEntryLight | null> {
  const response = await fetch(
    buildLeaderboardUrl({ trackId, skip: 0, amount: 1, onlyVerified: false, userTokenHash })
  );
  if (!response.ok) throw new Error(`User entry request failed: ${response.status}`);
  const raw = (await response.json()) as { userEntry?: { position?: number; frames?: number; id?: number } | null };
  const e = raw.userEntry;
  if (!e || typeof e.position !== 'number' || typeof e.frames !== 'number') return null;
  return { position: e.position, frames: e.frames, id: e.id ?? 0 };
}

/** World record (best verified time) for a track; null when none exists. */
export async function fetchWorldRecord(trackId: string): Promise<LeaderboardEntry | null> {
  const data = await fetchLeaderboard({ trackId, skip: 0, amount: 1, onlyVerified: true });
  return data.entries[0] ?? null;
}

/** Run promise-producing tasks with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
