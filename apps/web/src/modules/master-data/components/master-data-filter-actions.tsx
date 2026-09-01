'use client';

import { FilterX, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MasterDataFilterActionsProps {
  className?: string;
  onClear: () => void;
  onRefresh: () => void;
  refreshLabel?: string;
}

export function MasterDataFilterActions({
  className,
  onClear,
  onRefresh,
  refreshLabel = 'تازه‌سازی',
}: MasterDataFilterActionsProps) {
  return (
    <div
      aria-label="عملیات فیلتر"
      className={cn(
        'col-span-full mt-1 flex w-full flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3',
        className,
      )}
      role="group"
    >
      <Button
        className="border-border bg-background shadow-xs hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
        onClick={onClear}
        type="button"
        variant="outline"
      >
        <FilterX aria-hidden="true" className="size-4" />
        پاک‌کردن
      </Button>
      <Button
        className="border-primary/25 bg-primary/5 text-primary shadow-xs hover:border-primary/40 hover:bg-primary/10"
        onClick={onRefresh}
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {refreshLabel}
      </Button>
    </div>
  );
}
