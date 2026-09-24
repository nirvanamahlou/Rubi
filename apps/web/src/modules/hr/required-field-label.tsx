import type { ReactNode } from 'react';
import styles from './hr-workspace.module.css';

export function RequiredFieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span>
      {children}
      {required ? (
        <span
          aria-hidden="true"
          className={styles.requiredMark}
          data-required-indicator="true"
        >
          *
        </span>
      ) : null}
    </span>
  );
}
