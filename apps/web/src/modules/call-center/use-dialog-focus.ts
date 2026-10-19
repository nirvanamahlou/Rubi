'use client';
import { useState } from 'react';
/** Capture before Radix moves focus into a newly mounted editor. */
export function useDialogReturnFocus() {
  const [target] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  return (event: Event) => {
    event.preventDefault();
    const destination = target?.isConnected
      ? target
      : document.querySelector<HTMLElement>('[data-cc-focus-anchor]');
    destination?.focus();
  };
}
