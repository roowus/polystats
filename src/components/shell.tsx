import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Single source of truth for content width.
 *
 * Every page container, panel, and the nav use this, so panels stay aligned
 * instead of each page picking its own max-width.
 */
export const PAGE_WIDTH = 'mx-auto w-full max-w-[1600px] px-4 sm:px-6';

/**
 * Type scale.
 *
 * Sizes are generous on purpose: panels carry real padding, so small text left
 * a lot of dead space. Body copy is 16px, secondary 15px, and the smallest tier
 * is 13px (previously 10-11px, which was unreadable).
 */
export const TEXT = {
  /** Page title */
  title: 'font-game text-4xl font-bold uppercase tracking-wide sm:text-5xl',
  /** Sub-heading under a page title */
  subtitle: 'text-base text-zinc-300',
  /** Panel / section heading */
  heading: 'font-game text-2xl font-bold uppercase tracking-wide',
  /** Stat label, table header, small caps */
  label: 'text-[13px] font-semibold uppercase tracking-wider text-zinc-300',
  /** Default body copy */
  body: 'text-base text-zinc-200',
  /** Secondary copy */
  muted: 'text-[15px] text-zinc-300',
  /** Numeric / time values */
  value: 'text-2xl font-semibold tabular-nums',
} as const;

/** Page background + centered content shell with consistent spacing. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-[#212b58] text-white">
      <div className="relative pt-20">
        <main className={cn('pt-enter py-10', PAGE_WIDTH, className)}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-game text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 max-w-2xl text-base text-zinc-400">{subtitle}</p>}
    </header>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('pt-panel rounded-none p-4', className)}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <Panel className="p-4">
      <p className={TEXT.label}>{label}</p>
      <p className={cn(TEXT.value, 'mt-1.5')} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[14px] text-zinc-400">{hint}</p>}
    </Panel>
  );
}

export function MedalBadge({ icon, label, color, size = 'md' }: { icon: string; label: string; color: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-medium',
        size === 'sm' && 'px-1.5 py-0 text-[12px]'
      )}
      style={{ color, borderColor: `${color}44`, backgroundColor: `${color}14` }}
      title={label}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent', className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="border border-red-500/25 bg-red-500/8 px-4 py-3 text-base text-red-300">
      {children}
    </div>
  );
}
