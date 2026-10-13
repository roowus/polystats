import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchCatalog, shareToCatalog } from '@/lib/catalog';

afterEach(() => vi.restoreAllMocks());

describe('catalog client', () => {
  it('POSTs to the worker catalog endpoint when sharing', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    shareToCatalog('a'.repeat(64), 'Alice');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/catalog');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      userId: 'a'.repeat(64),
      nickname: 'Alice',
    });
  });

  it('returns users from a successful GET', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [{ user_id: 'a'.repeat(64), nickname: 'A', saved_count: 3, last_seen: 'now' }] }), { status: 200 })
    );
    const users = await fetchCatalog();
    expect(users).toHaveLength(1);
    expect(users![0].saved_count).toBe(3);
  });

  it('returns null on failure instead of throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect(await fetchCatalog()).toBeNull();
  });
});
