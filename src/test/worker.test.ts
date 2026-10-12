import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import worker from '../../worker/index';

const OK_BODY = JSON.stringify({ total: 1, entries: [] });

function jsonReq(url: string, method = 'GET'): Request {
  return new Request(url, { method });
}

describe('polytrack proxy worker', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(OK_BODY, { status: 200 }))
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers CORS preflights', async () => {
    const res = await worker.fetch(jsonReq('https://proxy.example/?url=x', 'OPTIONS'));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects non-GET requests', async () => {
    const res = await worker.fetch(jsonReq('https://proxy.example/?url=x', 'POST'));
    expect(res.status).toBe(405);
  });

  it('requires a url parameter', async () => {
    const res = await worker.fetch(jsonReq('https://proxy.example/'));
    expect(res.status).toBe(400);
  });

  it('only proxies the PolyTrack API host', async () => {
    const evil = await worker.fetch(
      jsonReq(`https://proxy.example/?url=${encodeURIComponent('https://evil.example/steal')}`)
    );
    expect(evil.status).toBe(403);

    const http = await worker.fetch(
      jsonReq(`https://proxy.example/?url=${encodeURIComponent('http://vps.kodub.com/v6/trackOfTheWeek')}`)
    );
    expect(http.status).toBe(403);
  });

  it('forwards the game origin and returns CORS headers', async () => {
    const target = 'https://vps.kodub.com/v6/trackOfTheWeek?version=0.6.3';
    const res = await worker.fetch(
      jsonReq(`https://proxy.example/?url=${encodeURIComponent(target)}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain('max-age=30');
    expect(globalThis.fetch).toHaveBeenCalledWith(target, {
      headers: { Origin: 'https://app-polytrack.kodub.com' },
    });
  });

  it('does not cache upstream errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    const res = await worker.fetch(
      jsonReq(`https://proxy.example/?url=${encodeURIComponent('https://vps.kodub.com/v6/trackOfTheWeek')}`)
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
