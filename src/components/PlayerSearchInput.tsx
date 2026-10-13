import { useEffect, useRef, useState } from 'react';
import { searchUsers, type UserSearchResult } from '@/lib/catalog';
import { cn } from '@/lib/utils';
import { CarPic } from './CarPic';

type Status = 'idle' | 'searching' | 'done';

/**
 * Text input with live autocomplete against the player catalog.
 * Suggests by username (case-insensitive); picking a suggestion returns
 * the full user id via onPick.
 *
 * Shows an explicit empty state when a search returns nothing, so a miss is
 * distinguishable from the dropdown simply not having opened yet.
 */
export function PlayerSearchInput({
  value,
  onChange,
  onPick,
  placeholder,
  className,
  /** How many suggestions to request. The list is height-capped and scrolls. */
  limit = 12,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (userId: string) => void;
  placeholder?: string;
  className?: string;
  limit?: number;
}) {
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [searched, setSearched] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced suggestion fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2 || /^[a-f0-9]{64}$/i.test(q)) {
      setSuggestions([]);
      setOpen(false);
      setStatus('idle');
      return;
    }
    setStatus('searching');
    setOpen(true);
    debounceRef.current = setTimeout(async () => {
      const users = await searchUsers(q, limit);
      setSuggestions(users);
      setSearched(q);
      setStatus('done');
      setOpen(true);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, limit]);

  const showEmpty = open && status === 'done' && suggestions.length === 0 && searched.length >= 2;

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => (suggestions.length > 0 || showEmpty) && setOpen(true)}
        placeholder={placeholder}
        className="pt-input w-full px-4 py-3 text-base outline-none transition"
      />
      {open && (suggestions.length > 0 || showEmpty || status === 'searching') && (
        <div className="pt-panel absolute left-0 right-0 top-full z-30 mt-1 max-h-[26rem] overflow-y-auto">
          {status === 'searching' && suggestions.length === 0 && (
            <div className="px-4 py-3 text-base text-zinc-400">Searching…</div>
          )}

          {showEmpty && <div className="px-4 py-3 text-base text-zinc-400">No user found with this game</div>}

          {suggestions.map((u) => (
            <button
              key={u.user_id}
              onClick={() => {
                setOpen(false);
                onPick(u.user_id);
              }}
              className="flex w-full items-center gap-4 border-b border-white/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/10"
            >
              <CarPic carStyle={u.car_style} size={40} className="shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold text-white">
                  {u.nickname ?? 'Unknown'}
                </span>
                <span className="truncate font-mono text-[15px] text-zinc-400">{u.user_id}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
