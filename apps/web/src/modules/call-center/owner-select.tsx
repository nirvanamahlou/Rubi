'use client';

import { Search, UserRound, UserRoundMinus } from 'lucide-react';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useDisplayLanguage, useUiTranslation } from '@/i18n/locale-context';
import type { Operator } from './workflow-client';
import styles from './owner-select.module.css';

export function OwnerSelect({
  operators,
  value,
  disabled,
  onChange,
  required = false,
}: {
  operators: Operator[];
  value: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const language = useDisplayLanguage();
  const t = useUiTranslation();
  const choices = [
    { value: '', title: t(required ? 'انتخاب کارشناس مسئول' : 'بدون مسئول') },
    ...(value && !operators.some((user) => user.id === value)
      ? [{ value, title: t('مسئول قبلی؛ برای ارجاع جدید انتخاب کنید') }]
      : []),
    ...operators.map((user) => ({
      value: user.id,
      title: user.showPosition
        ? `${user.displayName} — ${user.position || t('سمت ثبت نشده')}`
        : user.displayName,
    })),
  ];
  return (
    <div
      className={styles.field}
      dir={language === 'fa' ? 'rtl' : 'ltr'}
      data-call-owner-select="true"
      onChange={(event) => event.stopPropagation()}
    >
      <Search className={styles.search} size={16} aria-hidden="true" />
      <SearchCombobox
        name="ownerId"
        label={t('کارشناس مسئول')}
        value={value}
        disabled={disabled}
        optionLimit={100}
        placeholder={t('جست‌وجو و انتخاب…')}
        onValueChange={(next) => onChange?.(next)}
        options={choices.map((choice) => ({
          value: choice.value,
          searchText: choice.title,
          label: (
            <span className={styles.identity}>
              <span className={styles.avatar} data-unassigned={!choice.value}>
                {choice.value ? (
                  <UserRound size={17} aria-hidden="true" />
                ) : (
                  <UserRoundMinus size={17} aria-hidden="true" />
                )}
              </span>
              <span className={styles.name}>{choice.title}</span>
            </span>
          ),
        }))}
      />
    </div>
  );
}
