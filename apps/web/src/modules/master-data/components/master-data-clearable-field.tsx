'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ClearSelectionProps {
  controlId: string;
  label: string;
  value: string;
  onClear: () => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function MasterDataClearSelection({
  controlId,
  label,
  value,
  onClear,
  disabled = false,
  readOnly = false,
}: ClearSelectionProps) {
  if (!value || disabled || readOnly) return null;

  const accessibleLabel = `پاک‌کردن ${label}`;
  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-input bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        onClear();
        document.getElementById(controlId)?.focus();
      }}
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}

export function MasterDataClearableField({
  children,
  ...props
}: ClearSelectionProps & { children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <MasterDataClearSelection {...props} />
    </div>
  );
}
