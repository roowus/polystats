import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDataStatus, resetDataStatusCache } from './Freshness';

const STATUS = {
  last_fresh_run: '2026-10-14T00:01:37.987Z',
  last_backfill_run: '2026-10-14T00:00:12.000Z',
  users: 9707,
};

describe('useDataStatus caching', () => {
  beforeEach(() => {
    resetDataStatusCache();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => STATUS,
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDataStatusCache();
  });

  it('fetches once and reuses the result across mounts', async () => {
    // The worker's read budget is shared with the scrapers, and the freshness
    // line renders on every page, so navigation must not cost a call each time.
    const first = renderHook(() => useDataStatus());
    await waitFor(() => expect(first.result.current).toEqual(STATUS));
    first.unmount();

    const second = renderHook(() => useDataStatus());
    await waitFor(() => expect(second.result.current).toEqual(STATUS));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent mounts into a single request', async () => {
    // Several components can mount at once on one page.
    const a = renderHook(() => useDataStatus());
    const b = renderHook(() => useDataStatus());
    const c = renderHook(() => useDataStatus());
    await waitFor(() => expect(a.result.current).toEqual(STATUS));
    await waitFor(() => expect(c.result.current).toEqual(STATUS));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not cache when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useDataStatus());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();

    // A failure must not be cached, or the UI stays empty for the whole TTL.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => STATUS }));
    const second = renderHook(() => useDataStatus());
    await waitFor(() => expect(second.result.current).toEqual(STATUS));
  });

  it('does not cache a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    renderHook(() => useDataStatus());
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => STATUS }));
    const second = renderHook(() => useDataStatus());
    await waitFor(() => expect(second.result.current).toEqual(STATUS));
  });
});
