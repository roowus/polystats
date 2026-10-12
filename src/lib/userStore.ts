/**
 * Local (browser) storage of searched players: recents are automatic,
 * saves are explicit. Never leaves the browser.
 */

export interface StoredUser {
  id: string;
  nickname?: string;
  at: number;
}

const RECENTS_KEY = 'polystats_recent_users';
const SAVED_KEY = 'polystats_saved_users';
const LIMIT = 8;

function read(key: string): StoredUser[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, users: StoredUser[]) {
  try {
    localStorage.setItem(key, JSON.stringify(users));
  } catch {
    // storage unavailable — ignore
  }
}

export function getRecentUsers(): StoredUser[] {
  return read(RECENTS_KEY);
}

export function getSavedUsers(): StoredUser[] {
  return read(SAVED_KEY);
}

/** Record a successful lookup: bumps recents, nickname updated when known. */
export function pushRecentUser(id: string, nickname?: string) {
  const list = getRecentUsers().filter((u) => u.id !== id);
  list.unshift({ id, nickname, at: Date.now() });
  write(RECENTS_KEY, list.slice(0, LIMIT));
}

export function isSaved(id: string): boolean {
  return getSavedUsers().some((u) => u.id === id);
}

export function toggleSavedUser(id: string, nickname?: string): boolean {
  const list = getSavedUsers();
  const exists = list.some((u) => u.id === id);
  const next = exists
    ? list.filter((u) => u.id !== id)
    : [{ id, nickname, at: Date.now() }, ...list].slice(0, LIMIT * 2);
  write(SAVED_KEY, next);
  return !exists;
}
