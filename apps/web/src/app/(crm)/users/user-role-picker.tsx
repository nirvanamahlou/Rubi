'use client';

import { useId } from 'react';
import { ShieldCheck } from 'lucide-react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Input } from '@/components/ui/form-controls';
import styles from './user-management.module.css';

interface Props {
  roles: Array<{ id: string; name: string }>;
  title: string;
  disabled: boolean;
  onRoleChange: (id: string) => void;
  onTitleChange: (title: string) => void;
}

export function UserRolePicker({
  roles,
  title,
  disabled,
  onRoleChange,
  onTitleChange,
}: Props) {
  const id = useId();
  const selected = roles.find((role) => role.name === title)?.id ?? '';
  return (
    <section className={styles.rolePicker} aria-labelledby={`${id}-heading`}>
      <div className={styles.rolePickerHeading}>
        <span className={styles.rolePickerIcon}>
          <ShieldCheck size={22} aria-hidden="true" />
        </span>
        <h2 id={`${id}-heading`}>انتخاب نقش</h2>
      </div>
      <div className={styles.rolePickerFields}>
        <div className={styles.rolePickerField}>
          <label htmlFor={`${id}-role`}>نقش‌های تعریف‌شده</label>
          <NativeSearchSelect
            id={`${id}-role`}
            aria-label="انتخاب نقش کاربر"
            value={selected}
            disabled={disabled || roles.length === 0}
            optionLimit={roles.length + 1}
            onChange={(event) => onRoleChange(event.target.value)}
          >
            <option value="">دسترسی اختصاصی / انتخاب نقش</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </NativeSearchSelect>
          {roles.length === 0 && (
            <p className={styles.rolePickerEmpty}>هنوز نقشی تعریف نشده است.</p>
          )}
        </div>
        <div className={styles.rolePickerField}>
          <label htmlFor={`${id}-title`}>عنوان شغلی</label>
          <Input
            id={`${id}-title`}
            value={title}
            maxLength={80}
            disabled={disabled}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
