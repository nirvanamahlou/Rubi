'use client';

import { useId, useState, type ReactNode } from 'react';
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
  children: ReactNode | ((query: string) => ReactNode);
}) {
  const bodyId = useId();
  const active = count > 0;
  const mixed = active && count < total;
  const [expanded, setExpanded] = useState(active);
  const [query, setQuery] = useState('');
  return (
    <section
      className={`${styles.groupCard} ${active ? styles.activeGroup : ''}`}
    >
      <div className={styles.groupHeader}>
        <label className={styles.groupSelection}>
          <input
            type="checkbox"
            checked={total > 0 && count === total}
            disabled={total === 0}
            aria-label={'انتخاب کل بخش ' + title}
            aria-checked={mixed ? 'mixed' : total > 0 && count === total}
            ref={(node) => {
              if (node) node.indeterminate = mixed;
            }}
            onChange={(event) => {
              if (event.target.checked) setExpanded(true);
              onChange(event.target.checked);
            }}
          />
          <span className={styles.groupName}>
            {title}
            <small>انتخاب همهٔ زیربخش‌ها و مجوزها</small>
          </span>
        </label>
        <span className={styles.count}>
          {count}
          <span> / {total}</span>
        </span>
        <button
          type="button"
          className={styles.groupExpand}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'بستن زیربخش‌ها' : 'نمایش زیربخش‌ها'}
        </button>
      </div>
      {expanded && (
        <div id={bodyId} className={styles.groupBody}>
          {typeof children === 'function' ? (
            <input
              type="search"
              className={styles.groupSearch}
              aria-label={'جست‌وجوی زیربخش‌ها و مجوزهای ' + title}
              placeholder="جست‌وجوی زیربخش یا مجوز…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          {typeof children === 'function' ? children(query) : children}
        </div>
      )}
    </section>
  );
}
