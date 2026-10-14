import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '@/components/Home';
import { resetDataStatusCache } from '@/components/Freshness';
import { getProxyUrl } from '@/lib/polytrack';

vi.mock('@/lib/polytrack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/polytrack')>();
  return { ...actual, getProxyUrl: vi.fn() };
});

function mockStatus(status: Record<string, unknown>) {
  (getProxyUrl as ReturnType<typeof vi.fn>).mockReturnValue('https://worker.example/?url=');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
    if (String(url).includes('/status')) {
      return new Response(JSON.stringify(status), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The status cache is module-level; without this a successful fetch in one
  // test would satisfy the next one's assertion.
  resetDataStatusCache();
});
afterEach(() => vi.restoreAllMocks());

describe('Home — database stats', () => {
  it('renders live database counts from /status', async () => {
    mockStatus({ users: 9701, results: 14050, wr_history: 409, snapshots: 900, totw_archive: 1, last_fresh_run: '2026-10-13T18:00:00Z' });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('9,701')).toBeInTheDocument());
    expect(screen.getByText('14,050')).toBeInTheDocument();
    expect(screen.getByText('409')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('Players cataloged')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('renders feature cards for all sections', () => {
    mockStatus({});
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    // nav + feature cards both contain these labels
    expect(screen.getAllByText('Track of the Week').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Compare Players').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('World Records').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Leaderboards').length).toBeGreaterThanOrEqual(1);
  });

  it('hides the stats panel when the status fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    (getProxyUrl as ReturnType<typeof vi.fn>).mockReturnValue('https://worker.example/?url=');
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Players cataloged')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Track of the Week').length).toBeGreaterThanOrEqual(1); // page still works
  });
});
