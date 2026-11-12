'use client';
import { AArrowDown, AArrowUp } from 'lucide-react';
import styles from './floating-assistant.module.css';

export const CHAT_TEXT_DEFAULT = 14;
export const CHAT_TEXT_MIN = 12;
export const CHAT_TEXT_MAX = 24;

export function ChatTextSizeControls({
  value,
  onChange,
  english,
}: {
  value: number;
  onChange: (value: number) => void;
  english: boolean;
}) {
  const larger = english ? 'Increase chat text size' : 'بزرگ‌تر کردن متن گفتگو';
  const smaller = english
    ? 'Decrease chat text size'
    : 'کوچک‌تر کردن متن گفتگو';
  return (
    <div
      className={styles.textSizeControls}
      role="group"
      aria-label={english ? 'Chat text size' : 'اندازه متن گفتگو'}
    >
      <button
        type="button"
        className={styles.headerButton}
        aria-label={larger}
        title={larger}
        disabled={value >= CHAT_TEXT_MAX}
        onClick={() => onChange(Math.min(CHAT_TEXT_MAX, value + 2))}
      >
        <AArrowUp size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.headerButton}
        aria-label={smaller}
        title={smaller}
        disabled={value <= CHAT_TEXT_MIN}
        onClick={() => onChange(Math.max(CHAT_TEXT_MIN, value - 2))}
      >
        <AArrowDown size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
