'use client';

import { useEffect, useState } from 'react';
import {
  MANUAL_ACCESS_SECTIONS,
  MANUAL_NEW_PERMISSIONS,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  manualSectionForPermission,
  manualSectionForScreen,
  type ManualAccessSelection,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import styles from './user-management.module.css';

interface Snapshot {
  revision: string;
  title: string;
  alreadyManual: boolean;
  selection: ManualAccessSelection;
}
interface Props {
  userId: string;
  canManage: boolean;
  options: {
    permissions: Array<{ code: string; name: string }>;
    assignableScreenIds: string[];
    assignableControlIds: string[];
    canAssignAll: boolean;
  };
  controlLabel: (control: { id: string; title: string }) => string;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
  onSaved: () => Promise<void>;
}

export function ManualAccessEditor({
  userId,
  canManage,
  options,
  controlLabel,
  request,
  onSaved,
}: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    request(`/iam/users/${userId}/manual-access`)
      .then((value) => {
        if (active) setSnapshot(value as Snapshot);
      })
      .catch(() => {
        if (active) setMessage('دریافت دسترسی انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [userId, request]);

  if (!snapshot)
    return <p role="status">{message || 'در حال دریافت دسترسی‌های مؤثر…'}</p>;
  const selection = snapshot.selection;
  function toggle(
    key: keyof ManualAccessSelection,
    ids: string[],
    checked: boolean,
  ) {
    setSnapshot((current) => {
      if (!current) return current;
      const change = (values: string[], keys: string[]) =>
        checked
          ? [...new Set([...values, ...keys])]
          : values.filter((x) => !keys.includes(x));
      const next = {
        ...current.selection,
        [key]: change(current.selection[key], ids),
      };
      if (key === 'screenIds') {
        const screenControls = ids.filter((id) =>
          USER_ACCESS_DENY_CONTROLS.some((c) => c.id === id),
        );
        next.allowedControlIds = change(next.allowedControlIds, screenControls);
      }
      return { ...current, selection: next };
    });
  }
  async function save() {
    if (busy || !snapshot) return;
    setBusy(true);
    setMessage('');
    try {
      await request(`/iam/users/${userId}/manual-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: snapshot.revision,
          title: snapshot.title,
          ...snapshot.selection,
        }),
      });
      const next = (await request(
        `/iam/users/${userId}/manual-access`,
      )) as Snapshot;
      setSnapshot(next);
      await onSaved();
      setMessage(
        'دسترسی‌های دستی ذخیره شد. تغییرات از درخواست بعدی در سرور اعمال می‌شوند.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  const match = (text: string) =>
    text
      .toLocaleLowerCase('fa')
      .includes(search.trim().toLocaleLowerCase('fa'));
  return (
    <section aria-label="مدیریت دستی دسترسی کاربر" className="grid gap-4">
      <h2 className="text-xl font-bold">تیک‌های اختصاصی این کاربر</h2>
      <p>
        عنوان شغلی مجوز نمی‌دهد. مشاهده، عملیات و ویرایش فیلدها مستقل هستند.
        برداشتن تیک، دسترسی همان کاربر را لغو می‌کند.
      </p>
      {!snapshot.alreadyManual && (
        <p>
          تیک‌ها از دسترسی قبلی این کاربر استخراج شده‌اند. ذخیره، آن‌ها را بدون
          تغییر نقش‌های مشترک به دسترسی دستی تبدیل می‌کند.
        </p>
      )}
      <Input
        aria-label="جست‌وجوی دسترسی دستی"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="نام بخش، عملیات یا فیلد"
      />
      <fieldset disabled={!canManage || busy} className="grid gap-3">
        <label>
          عنوان شغلی
          <Input
            value={snapshot.title}
            maxLength={80}
            onChange={(event) =>
              setSnapshot({ ...snapshot, title: event.target.value })
            }
          />
        </label>
        {MANUAL_ACCESS_SECTIONS.map(([id, title]) => {
          const sectionMatch = match(title);
          const screens = USER_ACCESS_SCREENS.filter(
            (s) =>
              manualSectionForScreen(s) === id &&
              (sectionMatch || match(s.title)),
          );
          const permissions = options.permissions.filter(
            (p) =>
              manualSectionForPermission(p.code) === id &&
              (sectionMatch || match(p.name)),
          );
          const controls = USER_ACCESS_DENY_CONTROLS.filter(
            (c) =>
              (c.kind === 'field' ||
                c.id.startsWith('master-data.resource.')) &&
              c.group === id &&
              (sectionMatch || match(controlLabel(c))),
          );
          if (!screens.length && !permissions.length && !controls.length)
            return null;
          const buckets = [
            {
              key: 'screenIds' as const,
              title: 'مشاهده صفحه‌ها',
              values: screens.map((s) => ({
                id: s.id,
                label: s.title,
                allowed: options.assignableScreenIds.includes(s.id),
              })),
            },
            {
              key: 'permissionCodes' as const,
              title: 'عملیات و اطلاعات حساس',
              values: permissions.map((p) => ({
                id: p.code,
                label: p.name,
                allowed: true,
              })),
            },
            {
              key: 'allowedControlIds' as const,
              title: 'ویرایش فیلدها و دسترسی کاتالوگ',
              values: controls.map((c) => ({
                id: c.id,
                label: controlLabel(c),
                allowed: options.assignableControlIds.includes(c.id),
              })),
            },
          ];
          return (
            <details
              key={id}
              className={styles.groupCard}
              open={search.trim() ? true : undefined}
            >
              <summary className="cursor-pointer p-4 font-bold">
                {title}
              </summary>
              <div className="grid gap-4 p-4">
                {buckets
                  .filter((b) => b.values.length)
                  .map((bucket) => (
                    <fieldset key={bucket.key} className="grid gap-2">
                      <legend className="font-bold">{bucket.title}</legend>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            toggle(
                              bucket.key,
                              bucket.values
                                .filter((x) => x.allowed)
                                .map((x) => x.id),
                              true,
                            )
                          }
                        >
                          انتخاب همه موارد قابل واگذاری
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            toggle(
                              bucket.key,
                              bucket.values
                                .filter((x) => x.allowed)
                                .map((x) => x.id),
                              false,
                            )
                          }
                        >
                          برداشتن تیک‌های این گروه
                        </Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {bucket.values.map((item) => (
                          <label key={item.id} className={styles.check}>
                            <input
                              type="checkbox"
                              checked={selection[bucket.key].includes(item.id)}
                              disabled={!item.allowed}
                              onChange={(event) =>
                                toggle(
                                  bucket.key,
                                  [item.id],
                                  event.target.checked,
                                )
                              }
                            />
                            {item.label}
                            {MANUAL_NEW_PERMISSIONS.some(
                              ([code]) => code === item.id,
                            )
                              ? ' — جدید؛ نیازمند تصمیم دستی'
                              : ''}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
              </div>
            </details>
          );
        })}
        <Button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? 'در حال ذخیره…' : 'ذخیره دسترسی‌های دستی'}
        </Button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
