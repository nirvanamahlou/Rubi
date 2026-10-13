import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

export type MasterDataKpiTone =
  'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan';

export interface MasterDataKpiItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: MasterDataKpiTone;
  hint?: string;
}

const toneClasses: Record<
  MasterDataKpiTone,
  { card: string; icon: string; accent: string }
> = {
  sky: {
    card: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-sky-100/70 dark:border-sky-400/20 dark:from-sky-950/55 dark:to-sky-900/30',
    icon: 'bg-sky-200/70 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    accent: 'bg-sky-400',
  },
  emerald: {
    card: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/70 dark:border-emerald-400/20 dark:from-emerald-950/55 dark:to-emerald-900/30',
    icon: 'bg-emerald-200/70 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    accent: 'bg-emerald-400',
  },
  violet: {
    card: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-violet-100/70 dark:border-violet-400/20 dark:from-violet-950/55 dark:to-violet-900/30',
    icon: 'bg-violet-200/70 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    accent: 'bg-violet-400',
  },
  amber: {
    card: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-100/70 dark:border-amber-400/20 dark:from-amber-950/55 dark:to-amber-900/30',
    icon: 'bg-amber-200/70 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    accent: 'bg-amber-400',
  },
  rose: {
    card: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/70 dark:border-rose-400/20 dark:from-rose-950/55 dark:to-rose-900/30',
    icon: 'bg-rose-200/70 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
    accent: 'bg-rose-400',
  },
  cyan: {
    card: 'border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-cyan-100/70 dark:border-cyan-400/20 dark:from-cyan-950/55 dark:to-cyan-900/30',
    icon: 'bg-cyan-200/70 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
    accent: 'bg-cyan-400',
  },
};

export function MasterDataKpiGrid({
  items,
  label = 'شاخص‌های واقعی',
}: {
  items: readonly MasterDataKpiItem[];
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const tone = toneClasses[item.tone];
        return (
          <Card
            className={cn(
              'relative min-h-28 overflow-hidden p-4 shadow-sm sm:p-5',
              tone.card,
            )}
            key={item.label}
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-0 start-0 w-1 opacity-80',
                tone.accent,
              )}
            />
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-2xl',
                  tone.icon,
                )}
              >
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-black text-foreground">
                  {typeof item.value === 'number'
                    ? item.value.toLocaleString('fa-IR')
                    : item.value}
                </p>
                {item.hint ? (
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {item.hint}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </section>
  );
}
