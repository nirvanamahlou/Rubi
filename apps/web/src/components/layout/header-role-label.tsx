'use client';

import { useSyncExternalStore } from 'react';
import {
  getHeaderRoleLabel,
  subscribeHeaderSession,
} from '@/lib/header-session';

export function HeaderRoleLabel() {
  const roleLabel = useSyncExternalStore(
    subscribeHeaderSession,
    getHeaderRoleLabel,
    () => '',
  );
  if (!roleLabel) return null;
  return (
    <span
      className="max-w-16 shrink-0 truncate rounded-full border border-current/15 bg-current/5 px-2 py-0.5 text-[10px] font-semibold sm:max-w-36"
      data-header-role-label
      title={roleLabel}
    >
      {roleLabel}
    </span>
  );
}
