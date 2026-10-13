import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '@/pages/HistoryPage';
import { getProxyUrl } from '@/lib/polytrack';

vi.mock('@/lib/polytrack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/polytrack')>();
  return { ...actual, getProxyUrl: vi.fn() };
});

const H1 = '5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038';

function mockHistory(rows: unknown) {
  (getProxyUrl as ReturnType<typeof vi.fn>).mockReturnValue('https://worker.example/?url=');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.includes('/status')) {
      return new Response(JSON.stringify({ last_fresh_run: '2026-10-13T00:00:00Z', last_backfill_run: null }), { status: 200 });
    }
    return new Response(JSON.stringify({ history: rows }), { status: 200 });
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('HistoryPage', () => {
  it('renders progression rows with calculated improvements', async () => {
    mockHistory([
      { track_id: H1, player: 'pioneer', time_ms: 22329, set_at: '2026-03-10 15:48:59Z' },
      { track_id: H1, player: 'charger', time_ms: 22326, set_at: '2026-03-10 16:49:36Z' },
      { track_id: H1, player: 'solan', time_ms: 22063, set_at: '2026-10-12 13:17:26Z' },
    ]);
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText('solan').length).toBeGreaterThanOrEqual(1));
    // all players listed
    expect(screen.getAllByText('pioneer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('charger').length).toBeGreaterThanOrEqual(1);
    // improvements: 3ms then 263ms
    expect(screen.getByText('−00:00.003')).toBeInTheDocument();
    expect(screen.getByText('−00:00.263')).toBeInTheDocument();
    expect(screen.getByText('first record')).toBeInTheDocument();
    // summary tiles
    expect(screen.getAllByText('00:22.063').length).toBeGreaterThanOrEqual(1); // current WR (tile + table row)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // record holders
  });

  it('shows an empty state when no history exists', async () => {
    mockHistory([]);
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/No history recorded/i)).toBeInTheDocument());
  });

  it('requests history for the selected track through the worker', async () => {
    mockHistory([]);
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes(`/history?trackId=${H1}`))).toBe(true);
    });
  });
});
