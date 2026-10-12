import { describe, expect, beforeEach, it } from 'vitest';
import {
  getRecentUsers,
  getSavedUsers,
  isSaved,
  pushRecentUser,
  toggleSavedUser,
} from '@/lib/userStore';

beforeEach(() => localStorage.clear());

describe('userStore', () => {
  it('records recents newest-first and caps the list', () => {
    for (let i = 0; i < 12; i++) pushRecentUser(`id${i}`);
    const recents = getRecentUsers();
    expect(recents).toHaveLength(8); // capped
    expect(recents[0].id).toBe('id11'); // newest first
  });

  it('updates the nickname of an existing recent entry', () => {
    pushRecentUser('abc', undefined);
    pushRecentUser('abc', 'Tester');
    expect(getRecentUsers()).toHaveLength(1);
    expect(getRecentUsers()[0].nickname).toBe('Tester');
  });

  it('toggles saved state and reports it', () => {
    expect(isSaved('u1')).toBe(false);
    expect(toggleSavedUser('u1', 'Alice')).toBe(true);
    expect(isSaved('u1')).toBe(true);
    expect(getSavedUsers()[0].nickname).toBe('Alice');
    expect(toggleSavedUser('u1')).toBe(false);
    expect(getSavedUsers()).toHaveLength(0);
  });

  it('keeps recents and saves independent', () => {
    pushRecentUser('u1');
    toggleSavedUser('u1');
    expect(getRecentUsers()).toHaveLength(1);
    expect(getSavedUsers()).toHaveLength(1);
    toggleSavedUser('u1');
    expect(getRecentUsers()).toHaveLength(1);
  });
});
