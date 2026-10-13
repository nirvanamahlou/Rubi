import type { ReactNode } from 'react';

import styles from './master-data-filter-bar.module.css';

export function MasterDataFilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface ${styles.filterBar}`}
    >
      {children}
    </div>
  );
}
