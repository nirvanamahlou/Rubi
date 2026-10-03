'use client';

import { useId, type ReactNode } from 'react';
import styles from './user-management.module.css';

export function AccessGroupCard({
  title,
  count,
  total,
  onChange,
  children,
}: {
  id: string;
  title: string;
  count: number;
  total: number;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  const active = count > 0;
  const mixed = active && count < total;
  return (
    <section
      className={`${styles.groupCard} ${active ? styles.activeGroup : ''}`}
    >
      <label className={styles.groupHeader}>
        <input
          type="checkbox"
          checked={total > 0 && count === total}
          disabled={total === 0}
          aria-label={'انتخاب کل بخش ' + title}
          aria-checked={mixed ? 'mixed' : total > 0 && count === total}
          aria-controls={active ? bodyId : undefined}
          ref={(node) => {
            if (node) node.indeterminate = mixed;
          }}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={styles.groupName}>
          {title}
          <small>
            {active ? 'زیربخش‌های انتخاب‌شده' : 'برای انتخاب دسترسی تیک بزنید'}
          </small>
        </span>
        <span className={styles.count}>
          {count}
          <span> / {total}</span>
        </span>
      </label>
      {active && (
        <div id={bodyId} className={styles.groupBody}>
          {children}
        </div>
      )}
    </section>
  );
}
