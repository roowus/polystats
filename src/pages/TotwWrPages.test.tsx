import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TotwPage from '@/pages/TotwPage';
import WrPage from '@/pages/WrPage';
import * as polytrack from '@/lib/polytrack';

vi.mock('@/lib/liveTracks', () => ({
  getTrackCatalog: vi.fn(async () => ({ tracks: [], source: 'embedded' })),
}));

vi.mock('@/lib/polytrack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/polytrack')>();
  return {
    ...actual,
    fetchTrackOfTheWeek: vi.fn(),
    fetchLeaderboard: vi.fn(),
    fetchWorldRecord: vi.fn(),
  };
});

const mocked = vi.mocked(polytrack);

const TOTW = {
  trackId: 'b'.repeat(64),
  name: 'Velvoire',
  author: 'Jurre',
  environment: 0,
  endTime: new Date(Date.now() + 86400000).toISOString(),
  thumbnailUrl: 'https://vps.kodub.com/x.png',
  coverUrl: 'https://vps.kodub.com/cover.png',
};

function boardEntry(n: number, frames: number, nickname: string) {
  return {
    id: n,
    userId: `u${n}`,
    nickname,
    name: nickname,
    carColors: '',
    frames,
    verifiedState: n === 1 ? 1 : 0,
    position: n,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('TotwPage', () => {
  it('renders track info, countdown and the leaderboard', async () => {
    mocked.fetchTrackOfTheWeek.mockResolvedValue(TOTW);
    mocked.fetchLeaderboard.mockResolvedValue({
      total: 306,
      entries: [boardEntry(1, 127975, 'Jake'), boardEntry(2, 127982, 'hummus')],
      userEntry: null,
    });

    render(
      <MemoryRouter>
        <TotwPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Velvoire')).toBeInTheDocument());
    expect(screen.getByText(/by Jurre/)).toBeInTheDocument();
    expect(screen.getByText(/Summer environment/i)).toBeInTheDocument();
    expect(screen.getByText(/Rotates in/)).toBeInTheDocument();
    // leaderboard rows with formatted times (127975ms -> 02:07.975)
    expect(screen.getByText('02:07.975')).toBeInTheDocument();
    expect(screen.getAllByText('Jake').length).toBeGreaterThan(0);
    // entries count tile
    expect(screen.getByText('306')).toBeInTheDocument();
  });

  it('shows an error when no TOTW is available', async () => {
    mocked.fetchTrackOfTheWeek.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <TotwPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/No Track of the Week available/i)).toBeInTheDocument());
  });
});

describe('WrPage', () => {
  it('renders a WR row per track with formatted times and groups', async () => {
    const { OFFICIAL_TRACKS, COMMUNITY_TRACKS } = await import('@/lib/tracks');
    const queue = [...OFFICIAL_TRACKS, ...COMMUNITY_TRACKS];
    mocked.fetchTrackOfTheWeek.mockResolvedValue(null);
    mocked.fetchWorldRecord.mockImplementation(async (trackId: string) => {
      const idx = queue.findIndex((t) => t.id === trackId);
      if (idx < 0) return null;
      return {
        id: idx,
        userId: `u${idx}`,
        nickname: `holder${idx}`,
        name: `holder${idx}`,
        carColors: '',
        frames: 20000 + idx * 111,
        verifiedState: 1,
      } as polytrack.LeaderboardEntry;
    });

    render(
      <MemoryRouter>
        <WrPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/tracks/)).toBeInTheDocument());
    // one row per track: check a known track name and its holder
    expect(screen.getByText('Summer 1')).toBeInTheDocument();
    expect(screen.getByText('concrete jungle')).toBeInTheDocument();
    // every row has a verified dot
    expect(screen.getAllByText(/verified/i).length).toBeGreaterThan(0);
  });
});
