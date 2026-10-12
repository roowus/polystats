import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Page background + centered content shell with consistent spacing. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-[#0a0714] text-zinc-100">
      {/* ambient gradients */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-purple-600/15 blur-[128px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[480px] rounded-full bg-fuchsia-600/8 blur-[110px]" />
      </div>
      <div className="relative pt-20">
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={cn('mx-auto w-full max-w-6xl px-4 py-10 sm:px-6', className)}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <h1 className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">{subtitle}</p>}
    </header>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/8 bg-white/[0.03] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm',
        className
      )}
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
    <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
      {children}
    </div>
  );
}
