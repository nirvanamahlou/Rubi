'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function DossierHeaderAction({
  targetId,
  children,
}: {
  targetId?: string;
  children: ReactNode;
}) {
  const target =
    typeof document === 'undefined' || !targetId
      ? null
      : document.getElementById(targetId);

  return target ? createPortal(children, target) : null;
}
