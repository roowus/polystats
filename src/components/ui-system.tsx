/**
 * PolyStats design language — the single source of truth for UI primitives.
 *
 * Rules (see docs/DESIGN.md):
 *  - Flat surfaces, square corners. No border-radius anywhere.
 *  - Three PolyTrack shades only: base #212b58, panel #102052, accent #1a2450.
 *  - Extra-dark #102052 is reserved for INPUTS; panels use it too, chrome uses base.
 *  - Borders are subtle: white/10 default, white/25 for the selected state.
 *    Never pure white, never bright/neon rings.
 *  - All text is white; secondary text is #cfcfe4 / #e2e2f0.
 *  - Parallelograms (pt-skew) only in the top navigation bar.
 *  - Body font is ForcedSquare everywhere, including inputs and numbers.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const COLORS = {
  base: '#212b58',
  panel: '#102052',
  accent: '#1a2450',
  border: 'rgba(255,255,255,0.10)',
  borderSelected: 'rgba(255,255,255,0.25)',
} as const;

/** Filter / selector chip. Same look on every page. */
export function Chip({
  active,
  onClick,
  children,
  className,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'border-2 px-3 py-1.5 text-[15px] font-semibold uppercase tracking-wide transition-colors',
        active
          ? 'border-white/25 bg-[#1a2450] text-white'
          : 'border-transparent text-zinc-300 hover:bg-white/10 hover:text-white',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Small sort switcher used next to filter chips. */
export function SortButton({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 text-[15px] font-semibold uppercase transition-colors',
        active ? 'bg-[#1a2450] text-white' : 'text-zinc-300 hover:text-white'
      )}
    >
      {children}
    </button>
  );
}

/** Section header inside a panel (table titles, list headers). */
export function SectionHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-b-2 border-white/12 px-4 py-3 text-base font-semibold uppercase tracking-wide text-white', className)}>
      {children}
    </div>
  );
}

/** Labeled text input in the panel shade. */
export function TextField({
  value,
  onChange,
  placeholder,
  onKeyDown,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={cn('pt-input px-4 py-3 text-base outline-none transition', className)}
    />
  );
}
