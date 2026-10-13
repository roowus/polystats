import type { TrackInfo } from './tracks';
import { ALL_TRACKS as EMBEDDED_TRACKS } from './tracks';
import { getProxyUrl } from './polytrack';

/**
 * Live track catalog: derived from the current game client so new official
 * and community tracks appear automatically after every game update, without
 * a code change.
 *
 * The game bundle (~1.8 MB) is fetched through the proxy worker at most once
 * per day per browser (cached in localStorage), parsed client-side, and
 * merged with the embedded catalog as a fallback.
 */

export type TrackSource = 'cache' | 'live' | 'embedded';

export interface LiveCatalog {
  tracks: TrackInfo[];
  source: TrackSource;
  gameVersion: string | null;
  fetchedAt: string;
}

const CACHE_KEY = 'polystats_live_tracks';
const GAME_VERSION_RE = /app-polytrack\.kodub\.com\/([\d.]+)/;
const TRACK_RE = /\{id:"([a-f0-9]{64})",group:"([^"]*)",trackMetadata:\{name:"((?:[^"\\]|\\.)*)",author:"((?:[^"\\]|\\.)*)",lastModified:(?:null|"[^"]*")\},environment:Cl\.A\.(\w+)/g;

interface CacheEntry {
  date: string;
  tracks: TrackInfo[];
  gameVersion: string;
}

function environmentOf(token: string): TrackInfo['environment'] {
  if (token === 'Winter') return 'winter';
  if (token === 'Desert') return 'desert';
  return 'summer';
}

function parseBundle(bundle: string): { tracks: TrackInfo[]; version: string | null } {
  const tracks: TrackInfo[] = [];
  const seen = new Set<string>();
  for (const m of bundle.matchAll(TRACK_RE)) {
    const [, id, group, rawName, , envToken] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    let name = rawName;
    try {
      name = JSON.parse(`"${rawName}"`) as string; // unescape \" etc.
    } catch {
      // keep raw
    }
    tracks.push({
      id,
      name,
      group: group || undefined,
      environment: environmentOf(envToken),
    });
  }
  return { tracks, version: bundle.match(GAME_VERSION_RE)?.[1] ?? null };
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.date === new Date().toISOString().slice(0, 10) && entry.tracks?.length) return entry;
  } catch {
    // ignore
  }
  return null;
}

function writeCache(entry: CacheEntry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

/** Merge live tracks over the embedded catalog (embedded wins on conflicts). */
export function mergeCatalog(live: TrackInfo[]): TrackInfo[] {
  const embeddedIds = new Set(EMBEDDED_TRACKS.map((t) => t.id));
  const merged = [...EMBEDDED_TRACKS];
  for (const t of live) {
    if (!embeddedIds.has(t.id)) merged.push(t);
  }
  return merged;
}

/**
 * Full track catalog: embedded (shipped with the site) plus any tracks found
 * in the live game client. Fresh once per day per browser; falls back to the
 * embedded catalog offline.
 */
export async function getTrackCatalog(): Promise<{ tracks: TrackInfo[]; source: TrackSource }> {
  const cached = readCache();
  if (cached) {
    return { tracks: mergeCatalog(cached.tracks), source: 'cache' };
  }
  try {
    const base = getProxyUrl().split('?')[0].replace(/\/$/, '');
    const response = await fetch(`${base}/polytrack-bundle`);
    if (!response.ok) throw new Error(String(response.status));
    const bundle = await response.text();
    const { tracks, version } = parseBundle(bundle);
    if (tracks.length === 0) throw new Error('no tracks parsed');
    writeCache({ date: new Date().toISOString().slice(0, 10), tracks, gameVersion: version ?? '' });
    return { tracks: mergeCatalog(tracks), source: 'live' };
  } catch {
    return { tracks: EMBEDDED_TRACKS, source: 'embedded' };
  }
}

/** True when the cached catalog is from today (pages can skip refetching). */
export function liveCatalogIsFresh(): boolean {
  return readCache() !== null;
}
