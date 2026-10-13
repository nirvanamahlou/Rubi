'use client';

import { useRef } from 'react';

export function useMasterDataDialogFocusRestore() {
  const triggerRef = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: () => {
      const activeElement = document.activeElement;
      triggerRef.current =
        activeElement instanceof HTMLElement ? activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const trigger = triggerRef.current;
      if (!trigger?.isConnected) return;
      event.preventDefault();
      trigger.focus();
      triggerRef.current = null;
    },
  };
}
