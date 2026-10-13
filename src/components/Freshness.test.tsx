import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Freshness, parseTimestamp, formatTimestamp } from './Freshness';

describe('parseTimestamp', () => {
  it('parses ISO-8601 that already carries a Z zone', () => {
    // This is the shape /status actually returns; appending another Z made it invalid.
    const d = parseTimestamp('2026-10-13T21:20:42.638Z');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-10-13T21:20:42.638Z');
  });

  it('parses a SQLite timestamp with no zone as UTC', () => {
    const d = parseTimestamp('2026-10-13 21:20:42');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-10-13T21:20:42.000Z');
  });

  it('parses an offset timestamp without re-zoning it', () => {
    const d = parseTimestamp('2026-10-13T21:20:42+02:00');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-10-13T19:20:42.000Z');
  });

  it('returns null for junk instead of an Invalid Date', () => {
    expect(parseTimestamp('not a date')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
  });
});

describe('Freshness', () => {
  it('renders a real date rather than "Invalid Date"', () => {
    const { container } = render(<Freshness date="2026-10-13T21:20:42.638Z" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Data as of');
    expect(text).not.toContain('Invalid Date');
  });

  it('renders nothing when the date cannot be parsed', () => {
    const { container } = render(<Freshness date="garbage" />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when no date is given', () => {
    const { container } = render(<Freshness date={null} />);
    expect(container.textContent).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('formats a live /status value', () => {
    expect(formatTimestamp('2026-10-13T21:35:48.216Z')).not.toBe('');
  });

  it('returns empty string for missing or unusable values instead of throwing', () => {
    // HistoryPage passes `last_backfill_run ?? last_fresh_run`; both can be absent
    // on a first run, which previously produced "Invalid Date" or a TypeError.
    expect(formatTimestamp(undefined)).toBe('');
    expect(formatTimestamp(null)).toBe('');
    expect(formatTimestamp('')).toBe('');
    expect(formatTimestamp('undefined')).toBe('');
  });

  it('handles the SQLite shape the history rows use', () => {
    expect(formatTimestamp('2026-03-10 15:48:59Z')).not.toBe('');
    expect(formatTimestamp('2026-03-10 15:48:59')).not.toBe('');
  });
});
