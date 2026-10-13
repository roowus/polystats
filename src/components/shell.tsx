import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Single source of truth for content width.
 *
 * Every page container, panel, and the nav use this, so panels stay aligned
 * instead of each page picking its own max-width.
 */
export const PAGE_WIDTH = 'mx-auto w-full max-w-[1600px] px-4 sm:px-6';

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
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">{subtitle}</p>}
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
    <Panel>
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
    </Panel>
  );
}

export function MedalBadge({ icon, label, color, size = 'md' }: { icon: string; label: string; color: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        size === 'sm' && 'px-1.5 py-0 text-[11px]'
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
    <div className="border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
      {children}
    </div>
  );
}
