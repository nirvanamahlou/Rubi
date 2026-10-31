'use client';

import * as Select from '@radix-ui/react-select';
import {
  Check,
  ChevronDown,
  Circle,
  Clock3,
  MessageCircle,
  CircleCheck,
  CircleX,
  Flag,
  ChevronsUp,
  Zap,
} from 'lucide-react';
import { useDisplayLanguage, useUiTranslation } from '@/i18n/locale-context';
import styles from './request-choice.module.css';

const symbols = {
  NEW: Circle,
  OPEN: Circle,
  IN_PROGRESS: Clock3,
  WAITING_CUSTOMER: MessageCircle,
  CLOSED: CircleCheck,
  COMPLETED: CircleCheck,
  CANCELLED: CircleX,
  NORMAL: Flag,
  HIGH: ChevronsUp,
  URGENT: Zap,
};

function ChoiceIcon({ value }: { value: string }) {
  const Icon = symbols[value as keyof typeof symbols] ?? Circle;
  return (
    <span className={styles.symbol} data-value={value}>
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}

/** Short, fixed workflow choices: no search or accidental free-text entry. */
export function RequestChoice({
  label,
  name,
  value,
  options,
  disabled,
  onValueChange,
}: {
  label: string;
  name?: string;
  value: string;
  options: Record<string, string>;
  disabled: boolean;
  onValueChange: (value: string) => void;
}) {
  const language = useDisplayLanguage();
  const t = useUiTranslation();
  return (
    <Select.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      {...(name ? { name } : {})}
      dir={language === 'fa' ? 'rtl' : 'ltr'}
    >
      <Select.Trigger className={styles.trigger} aria-label={t(label)}>
        <span className={styles.current}>
          <ChoiceIcon value={value} />
          <Select.Value>{t(options[value] ?? value)}</Select.Value>
        </span>
        <Select.Icon className={styles.chevron}>
          <ChevronDown size={16} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={styles.menu}
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <Select.Viewport className={styles.viewport}>
            {Object.entries(options).map(([key, title]) => (
              <Select.Item
                className={styles.option}
                key={key}
                value={key}
                textValue={t(title)}
              >
                <ChoiceIcon value={key} />
                <Select.ItemText>{t(title)}</Select.ItemText>
                <span className={styles.check}>
                  <Select.ItemIndicator>
                    <Check size={16} aria-hidden="true" />
                  </Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
