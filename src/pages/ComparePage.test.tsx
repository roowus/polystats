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
    id: 1,
    userId: 'x',
    nickname: 'p',
    name: 'p',
    carColors: '',
    frames,
    verifiedState: 1,
    trackId,
    trackName,
    trackGroup: 'official',
    position: 1,
    rank: 1,
  };
}

// side A: fast on Summer, slow on Winter. side B: the reverse.
const A = {
  phase: 'done' as const,
  nickname: 'Alice',
  entries: [
    entry(20000, 'summer', 'Summer 1'),
    entry(30000, 'winter', 'Winter 1'),
  ],
};
const B = {
  phase: 'done' as const,
  nickname: 'Bob',
  entries: [
    entry(21000, 'summer', 'Summer 1'),
    entry(29000, 'winter', 'Winter 1'),
  ],
};

function mockHook(status: typeof A | typeof B | { phase: 'idle' }) {
  return { status, scan, reset };
}

beforeEach(() => {
  vi.clearAllMocks();
  (useUserStats as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(mockHook(A))
    .mockReturnValueOnce(mockHook(B));
});

const ID_A = 'a'.repeat(64);
const ID_B = 'b'.repeat(64);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ComparePage />
    </MemoryRouter>
  );
}

describe('ComparePage', () => {
  it('renders both player summaries with calculated averages', () => {
    renderAt(`/compare?ids=${ID_A},${ID_B}`);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // both have 2 tracks, avg rank 1
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
  });

  it('lists shared tracks with per-track deltas and winners', () => {
    renderAt(`/compare?ids=${ID_A},${ID_B}`);
    expect(screen.getByText(/2 shared tracks/)).toBeInTheDocument();
    // Summer 1: A 20s vs B 21s -> A wins by 1000ms -> "+00:01.000"
    expect(screen.getByText('+00:01.000')).toBeInTheDocument();
    // Winter 1: A 30s vs B 29s -> B wins -> "−00:01.000"
    expect(screen.getByText('−00:01.000')).toBeInTheDocument();
    // winner column letters: one A and one B
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('states clearly when players share no tracks', () => {
    (useUserStats as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockReturnValueOnce(mockHook({ ...A, entries: [entry(1, 's'.repeat(64), 'Summer 1')] }))
      .mockReturnValueOnce(mockHook({ ...B, entries: [entry(1, 'w'.repeat(64), 'Winter 1')] }));
    renderAt(`/compare?ids=${'s'.repeat(64)},${'w'.repeat(64)}`);
    expect(screen.getByText(/no tracks in common/i)).toBeInTheDocument();
  });

  it('shows the search form', () => {
    renderAt('/compare');
    expect(screen.getByPlaceholderText(/Player A/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Player B/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /compare/i }).length).toBeGreaterThanOrEqual(2);
  });
});
