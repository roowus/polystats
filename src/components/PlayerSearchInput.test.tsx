import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerSearchInput } from './PlayerSearchInput';

/**
 * The component is controlled, so tests need something that actually stores the
 * typed value. Passing a no-op onChange leaves the input empty and nothing
 * ever searches.
 */
function Harness({ onPick = () => {} }: { onPick?: (id: string) => void }) {
  const [value, setValue] = useState('');
  return <PlayerSearchInput value={value} onChange={setValue} onPick={onPick} />;
}

const searchUsers = vi.fn();
vi.mock('@/lib/catalog', () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
}));

describe('PlayerSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    searchUsers.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an explicit empty state when no user matches', async () => {
    searchUsers.mockResolvedValue([]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'zzzznotarealuser');
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(screen.getByText('No user found with this name')).toBeTruthy();
    });
  });

  it('lists matches with the full user id, not a truncated one', async () => {
    const id = 'a'.repeat(64);
    searchUsers.mockResolvedValue([{ user_id: id, nickname: 'Monstrosity', car_style: null }]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'mons');
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(screen.getByText('Monstrosity')).toBeTruthy();
      expect(screen.getByText(id)).toBeTruthy();
    });
  });

  it('calls onPick with the user id when a suggestion is chosen', async () => {
    const id = 'b'.repeat(64);
    const onPick = vi.fn();
    searchUsers.mockResolvedValue([{ user_id: id, nickname: 'Neki', car_style: null }]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness onPick={onPick} />);

    await user.type(screen.getByRole('textbox'), 'nek');
    await vi.advanceTimersByTimeAsync(400);

    const option = await screen.findByText('Neki');
    await user.click(option);
    expect(onPick).toHaveBeenCalledWith(id);
  });

  it('does not search until at least two characters are typed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'a');
    await vi.advanceTimersByTimeAsync(400);
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('skips the search for a pasted 64-char user id', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'c'.repeat(64));
    await vi.advanceTimersByTimeAsync(400);
    expect(searchUsers).not.toHaveBeenCalled();
  });
});
