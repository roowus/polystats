import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComparePage from '@/pages/ComparePage';
import { useUserStats } from '@/hooks/useUserStats';
import type { UserTrackEntry } from '@/lib/stats';

vi.mock('@/hooks/useUserStats');

const scan = vi.fn();
const reset = vi.fn();

function entry(frames: number, trackId: string, trackName: string): UserTrackEntry {
  return {
    id: 1, userId: 'x', nickname: 'p', name: 'p', carColors: '', frames,
    verifiedState: 1, trackId, trackName, trackGroup: 'official', position: 1, rank: 1,
  };
}

const ID_A = 'a'.repeat(64);
const ID_B = 'b'.repeat(64);
const ID_C = 'c'.repeat(64);

const A = {
  phase: 'done' as const,
  nickname: 'Alice',
  entries: [entry(20000, 'summer', 'Summer 1'), entry(30000, 'winter', 'Winter 1')],
};
const B = {
  phase: 'done' as const,
  nickname: 'Bob',
  entries: [entry(21000, 'summer', 'Summer 1'), entry(29000, 'winter', 'Winter 1')],
};
const C = {
  phase: 'done' as const,
  nickname: 'Cara',
  entries: [entry(19500, 'summer', 'Summer 1')],
};

function mockCalls(statuses: typeof A[]) {
  if (statuses.length === 0) statuses = [{ phase: 'idle' } as unknown as typeof A];
  (useUserStats as ReturnType<typeof vi.fn>).mockReset();
  // rerenders re-call the hook; cycle through statuses instead of a one-shot queue
  (useUserStats as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const next = (useUserStats as ReturnType<typeof vi.fn>).mock.calls.length % statuses.length;
    return { status: statuses[next], scan, reset };
  });
}

beforeEach(() => vi.clearAllMocks());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ComparePage />
    </MemoryRouter>
  );
}

describe('ComparePage — multi-player', () => {
  it('renders three player summaries side by side', () => {
    mockCalls([A, B, C]);
    renderAt(`/compare?ids=${ID_A},${ID_B},${ID_C}`);
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cara').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('3/6 players loaded')).toBeInTheDocument();
  });

  it('builds the head-to-head table across all players and highlights the best time', () => {
    mockCalls([A, B, C]);
    renderAt(`/compare?ids=${ID_A},${ID_B},${ID_C}`);
    // 2 shared tracks (Summer 1 has all 3, Winter 1 has 2)
    expect(screen.getByText(/2 shared tracks/)).toBeInTheDocument();
    // best times highlighted: Summer 1 -> Cara 19500; Winter 1 -> Bob 29000
    expect(screen.getAllByText('00:19.500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('00:29.000').length).toBeGreaterThanOrEqual(1);
    // missing entry for Cara on Winter 1 renders a dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('caps the player note at the limit', () => {
    mockCalls([]);
    const sixIds = [ID_A, ID_B, ID_C, 'd'.repeat(64), 'e'.repeat(64), 'f'.repeat(64)].join(',');
    renderAt(`/compare?ids=${sixIds}`);
    expect(screen.getByText('6/6 players loaded')).toBeInTheDocument();
  });

  it('shows the add-player form', () => {
    mockCalls([]);
    renderAt('/compare');
    expect(screen.getByPlaceholderText(/Add a player by name or User ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });
});
