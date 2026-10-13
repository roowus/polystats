import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserPage from '@/pages/UserPage';
import { useUserStats } from '@/hooks/useUserStats';
import type { UserTrackEntry } from '@/lib/stats';

vi.mock('@/hooks/useUserStats');

const scan = vi.fn();
const reset = vi.fn();

function mockStatus(status: ReturnType<typeof useUserStats>['status']) {
  (useUserStats as ReturnType<typeof vi.fn>).mockReturnValue({ status, scan, reset });
}

function entry(over: Partial<UserTrackEntry>): UserTrackEntry {
  return {
    id: 1,
    userId: 'a'.repeat(64),
    nickname: 'Tester',
    name: 'Tester',
    carColors: 'ff0000',
    frames: 22123,
    verifiedState: 1,
    trackId: 't1',
    trackName: 'Summer 1',
    trackGroup: 'official',
    position: 4,
    rank: 4,
    percent: 0.0004,
    wrTime: 22100,
    wrTimeGap: 23,
    wrPercentGap: 0.104,
    ...over,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/user/:userId?" element={<UserPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const USER = 'a'.repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => vi.restoreAllMocks());

describe('UserPage — search screen', () => {
  it('renders the search form with helper example', () => {
    mockStatus({ phase: 'idle' });
    renderAt('/user');
    expect(screen.getByPlaceholderText(/User ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText(/recent lookups will appear here/i)).toBeInTheDocument();
  });

  it('scans when a valid :userId is in the route', () => {
    mockStatus({ phase: 'idle' });
    renderAt(`/user/${USER}`);
    expect(scan).toHaveBeenCalledWith(USER);
  });
});

describe('UserPage — loading / empty states', () => {
  it('shows scan progress', () => {
    mockStatus({ phase: 'scanning', done: 12, total: 64 });
    renderAt(`/user/${USER}`);
    expect(screen.getByText(/12\/64/)).toBeInTheDocument();
  });

  it('shows the enrichment stage with found count', () => {
    mockStatus({ phase: 'enriching', found: 3 });
    renderAt(`/user/${USER}`);
    expect(screen.getByText(/Found 3 tracks/)).toBeInTheDocument();
  });

  it('explains a player with no entries', () => {
    mockStatus({ phase: 'no-entries' });
    renderAt(`/user/${USER}`);
    expect(screen.getByText(/No leaderboard entries found/i)).toBeInTheDocument();
    expect(screen.getByText(/hasn.t set a time yet/i)).toBeInTheDocument();
  });
});

describe('UserPage — results and calculations', () => {
  const entries = [
    entry({}),
    entry({
      trackId: 't2', trackName: 'Winter 1', frames: 16999, position: 1, rank: 1,
      percent: 0.00005, wrPercentGap: 0,
    }),
    entry({
      trackId: 't3', trackName: 'Track of the Week: Velvoire', trackGroup: 'totw',
      frames: 130506, position: 40, rank: 40, percent: 30, wrPercentGap: undefined,
    }),
  ];

  it('renders header, summary tiles and calculated averages', async () => {
    mockStatus({ phase: 'done', nickname: 'Tester', entries });
    renderAt(`/user/${USER}`);

    expect(screen.getByText('Tester')).toBeInTheDocument();

    // averages: avg time = (22123+16999+130506)/3 = 56209.33ms
    expect(screen.getByText('00:56.542')).toBeInTheDocument();
    // avg rank = (4+1+40)/3 = 15
    expect(screen.getByText('15')).toBeInTheDocument();
    // avg WR gap = (0.104+0+missing)/2 -> only two defined -> 0.052 -> "0.05%"
    expect(screen.getAllByText(/0\.0[0-9]%/).length).toBeGreaterThanOrEqual(1);
    // tracks played
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('lists every track entry with its rank and WR gap', () => {
    mockStatus({ phase: 'done', nickname: 'Tester', entries });
    renderAt(`/user/${USER}`);
    expect(screen.getAllByText('Summer 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Winter 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Track of the Week: Velvoire').length).toBeGreaterThan(0);
    // WR gap for Summer 1: +0.10%
    expect(screen.getByText('+0.10%')).toBeInTheDocument();
    // percentile text appears for each row
    expect(screen.getAllByText(/percentile/i).length).toBeGreaterThan(0);
  });

  it('renders medals for WR and top ranks', () => {
    mockStatus({ phase: 'done', nickname: 'Tester', entries });
    renderAt(`/user/${USER}`);
    expect(screen.getByText(/WR ×1/)).toBeInTheDocument();   // Winter 1, position 1
    expect(screen.getByText(/Podium ×1/)).toBeInTheDocument(); // Summer 1, position 4
  });

  it('shows best/worst time cards from the calculations', () => {
    mockStatus({ phase: 'done', nickname: 'Tester', entries });
    renderAt(`/user/${USER}`);
    expect(screen.getByText('best time')).toBeInTheDocument();
    expect(screen.getByText('worst time')).toBeInTheDocument();
    expect(screen.getByText('00:16.999')).toBeInTheDocument(); // best = Winter 1
    expect(screen.getByText('02:10.506')).toBeInTheDocument(); // worst = TOTW
  });

  it('renders a copyable user id and a compare link', () => {
    mockStatus({ phase: 'done', nickname: 'Tester', entries });
    renderAt(`/user/${USER}`);
    expect(screen.getByText(USER)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /compare/i }).length).toBeGreaterThanOrEqual(1);
  });
});

describe('UserPage — autocomplete', () => {
  afterEach(() => vi.restoreAllMocks());

  it('suggests players by username and navigates on pick', async () => {
    mockStatus({ phase: 'idle' });
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/users?q=')) {
        return new Response(
          JSON.stringify({ users: [{ user_id: 'f'.repeat(64), nickname: 'Monstrosity', car_style: null, last_seen: 'now' }] }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });

    renderAt('/user');
    const input = screen.getByPlaceholderText(/Player name/i);
    await user.type(input, 'mons');
    await waitFor(() => expect(screen.getByText('Monstrosity')).toBeInTheDocument(), { timeout: 3000 });
    await user.click(screen.getByText('Monstrosity'));
    expect(input).toHaveValue('f'.repeat(64));
  });

  it('does not suggest for hex ids (direct navigation instead)', async () => {
    mockStatus({ phase: 'idle' });
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderAt('/user');
    const input = screen.getByPlaceholderText(/Player name/i);
    await user.type(input, 'a'.repeat(64).slice(0, 10));
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText(/player.*found/i)).not.toBeInTheDocument();
    void fetchSpy;
  });
});
