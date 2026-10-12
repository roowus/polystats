import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_VERSION,
  API_BASE,
  DEFAULT_PROXY_URL,
  PROXY_STORAGE_KEY,
  buildLeaderboardUrl,
  buildRecordingsUrl,
  buildTrackOfTheWeekUrl,
  buildUserUrl,
  decodeCarStyle,
  fetchLeaderboard,
  fetchUser,
  formatTime,
  getProxyUrl,
  normalizeEntry,
  proxyUrl,
  setProxyUrl,
  sha256Hex,
} from '@/lib/polytrack';

const TRACK_ID = '5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038';

describe('proxy configuration', () => {
  beforeEach(() => {
    localStorage.removeItem(PROXY_STORAGE_KEY);
  });

  it('falls back to the default proxy URL', () => {
    expect(getProxyUrl()).toBe(DEFAULT_PROXY_URL);
  });

  it('honours a localStorage override', () => {
    setProxyUrl('https://my-proxy.example/?url=');
    expect(getProxyUrl()).toBe('https://my-proxy.example/?url=');
    setProxyUrl(null);
    expect(getProxyUrl()).toBe(DEFAULT_PROXY_URL);
  });

  it('wraps target URLs with an encoded target', () => {
    const wrapped = proxyUrl('https://vps.kodub.com/v6/user?a=1');
    expect(wrapped.startsWith(getProxyUrl())).toBe(true);
    expect(wrapped.endsWith(encodeURIComponent('https://vps.kodub.com/v6/user?a=1'))).toBe(true);
  });
});

describe('URL builders', () => {
  it('builds a v6 leaderboard URL with required params', () => {
    const url = decodeURIComponent(buildLeaderboardUrl({ trackId: TRACK_ID, skip: 5, amount: 10, onlyVerified: true }));
    expect(url).toContain(`${API_BASE}leaderboard?version=${API_VERSION}`);
    expect(url).toContain(`trackId=${TRACK_ID}`);
    expect(url).toContain('skip=5');
    expect(url).toContain('amount=10');
    expect(url).toContain('onlyVerified=true');
  });

  it('appends userTokenHash only when provided', () => {
    const without = decodeURIComponent(buildLeaderboardUrl({ trackId: TRACK_ID }));
    expect(without).not.toContain('userTokenHash');
    const withHash = decodeURIComponent(
      buildLeaderboardUrl({ trackId: TRACK_ID, userTokenHash: 'abc123' })
    );
    expect(withHash).toContain('userTokenHash=abc123');
  });

  it('encodes the user token in the user URL', () => {
    const url = decodeURIComponent(buildUserUrl('tok en+1'));
    expect(url).toContain(`${API_BASE}user?version=${API_VERSION}&userToken=${encodeURIComponent('tok en+1')}`);
  });

  it('joins recording ids with commas', () => {
    const url = decodeURIComponent(buildRecordingsUrl([1, 2, 3]));
    expect(url).toContain(`${API_BASE}recordings?version=${API_VERSION}&ids=1,2,3`);
  });

  it('builds the track of the week URL', () => {
    const url = decodeURIComponent(buildTrackOfTheWeekUrl());
    expect(url).toContain(`${API_BASE}trackOfTheWeek?version=${API_VERSION}`);
  });
});

describe('sha256Hex', () => {
  it('hashes to the expected hex digest', async () => {
    // sha256("abc") from the NIST test vectors.
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

describe('decodeCarStyle', () => {
  it('decodes a serialized car style into four RGB hex colors', () => {
    // Sampled from the live API: pattern 4, rims 0, exhaust 0,
    // colors black / purple / purple / black.
    expect(decodeCarStyle('AAQAAAAAAI4AU44AUwAAAA')).toBe('0000008e00538e0053000000');
  });

  it('returns empty for invalid input', () => {
    expect(decodeCarStyle('')).toBe('');
    expect(decodeCarStyle('!!!not base64!!!')).toBe('');
    // Valid base64 but too short.
    expect(decodeCarStyle(btoa('short'))).toBe('');
  });
});

describe('normalizeEntry', () => {
  it('maps nickname/carStyle to the legacy name/carColors fields', () => {
    const entry = normalizeEntry({
      id: 1,
      userId: 'u1',
      nickname: 'Monstrosity',
      countryCode: null,
      carStyle: 'AAQAAAAAAI4AU44AUwAAAA',
      frames: 22123,
      time: '2026-10-09T08:22:09.000Z',
      verifiedState: 1,
    });
    expect(entry.name).toBe('Monstrosity');
    expect(entry.nickname).toBe('Monstrosity');
    expect(entry.carColors).toBe('0000008e00538e0053000000');
    expect(entry.frames).toBe(22123);
    expect(entry.verifiedState).toBe(1);
  });

  it('tolerates missing fields', () => {
    const entry = normalizeEntry({ id: 2, userId: 'u2' });
    expect(entry.name).toBe('');
    expect(entry.carColors).toBe('');
    expect(entry.frames).toBe(0);
    expect(entry.verifiedState).toBeUndefined();
  });
});

describe('formatTime', () => {
  it('formats milliseconds as mm:ss.mmm', () => {
    expect(formatTime(22123)).toBe('00:22.123');
    expect(formatTime(127975)).toBe('02:07.975');
    expect(formatTime(0)).toBe('00:00.000');
    expect(formatTime(3_723_487)).toBe('62:03.487'); // hours spill into minutes
  });
});

describe('fetchLeaderboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes entries and userEntry from a raw payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 2,
          entries: [
            {
              id: 1,
              userId: 'u1',
              nickname: 'a',
              carStyle: 'AAQAAAAAAI4AU44AUwAAAA',
              frames: 100,
              verifiedState: 1,
            },
          ],
          userEntry: { position: 4, frames: 100, verifiedState: 1, id: 1 },
        }),
        { status: 200 }
      )
    );
    const data = await fetchLeaderboard({ trackId: TRACK_ID });
    expect(data.total).toBe(2);
    expect(data.entries[0].name).toBe('a');
    expect(data.userEntry?.position).toBe(4);
  });

  it('throws on non-OK responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    await expect(fetchLeaderboard({ trackId: TRACK_ID })).rejects.toThrow('403');
  });
});

describe('fetchUser', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes the v6 user payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ nickname: 'Pix', countryCode: 'de', carStyle: 'AAQAAAAAAI4AU44AUwAAAA', isVerifier: true }),
        { status: 200 }
      )
    );
    const user = await fetchUser('token');
    expect(user?.name).toBe('Pix');
    expect(user?.carColors).toBe('0000008e00538e0053000000');
    expect(user?.isVerifier).toBe(true);
  });

  it('returns null for an empty payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));
    expect(await fetchUser('token')).toBeNull();
  });
});
