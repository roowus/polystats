import { useEffect, useRef, useState } from 'react';
import { searchUsers, type UserSearchResult } from '@/lib/catalog';
import { cn } from '@/lib/utils';
import { CarPic } from './CarPic';

/**
 * Text input with live autocomplete against the player catalog.
 * Suggests by username (case-insensitive); picking a suggestion returns
 * the full user id via onPick.
 */
export function PlayerSearchInput({
  value,
  onChange,
  onPick,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (userId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [open, setOpen] = useState(false);
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
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const users = await searchUsers(q, 8);
      setSuggestions(users);
      setOpen(users.length > 0);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="pt-input w-full px-4 py-2.5 text-sm outline-none transition"
      />
      {open && suggestions.length > 0 && (
        <div className="pt-panel absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden">
          {suggestions.map((u) => (
            <button
              key={u.user_id}
              onClick={() => {
                setOpen(false);
                onPick(u.user_id);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <CarPic carStyle={u.car_style} size={12} />
                <span className="truncate font-semibold text-white">{u.nickname ?? 'Unknown'}</span>
              </span>
              <span className="font-mono text-xs text-zinc-400">{u.user_id.slice(0, 12)}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
