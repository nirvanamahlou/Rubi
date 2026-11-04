'use client';

import {
  useEffect,
  useState,
  useRef,
  useImperativeHandle,
  type Ref,
} from 'react';
import {
  MANUAL_ACCESS_SECTIONS,
  CALL_CENTER_SCOPED_ACCESS,
  MANUAL_NEW_PERMISSIONS,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  manualSectionForScreen,
  type ManualAccessSelection,
  screenPermission,
  denyPermission,
  completeManualAccessPrerequisites,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import styles from './user-management.module.css';
import { sectionAccess, changeSectionAccess } from './section-access';
import { permissionInSection, permissionLabel } from './access-permissions';
import { UserRolePicker } from './user-role-picker';
import { manualAccessDraftKey } from './manual-access-draft';

export interface ManualAccessEditorHandle {
  save: () => Promise<boolean>;
}

interface Snapshot {
  revision: string;
  title: string;
  alreadyManual: boolean;
  selection: ManualAccessSelection;
}
interface Props {
  ref?: Ref<ManualAccessEditorHandle>;
  templates?: Array<{
    id: string;
    name: string;
    selection?: ManualAccessSelection;
    permissions: Array<{ permission: { code: string } }>;
  }>;
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
  ref,
  userId,
  canManage,
  options,
  controlLabel,
  request,
  onSaved,
  templates = [],
}: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const baseline = useRef<string | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    request(`/iam/users/${userId}/manual-access`)
      .then((value) => {
        if (active) {
          baseline.current = manualAccessDraftKey(value as Snapshot);
          setSnapshot(value as Snapshot);
        }
      })
      .catch(() => {
        if (active) setMessage('دریافت دسترسی انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [userId, request]);

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
      return {
        ...current,
        selection: checked
          ? completeManualAccessPrerequisites(next, current.selection)
          : next,
      };
    });
  }
  async function save() {
    if (saving.current || !snapshot || !canManage) return false;
    if (manualAccessDraftKey(snapshot) === baseline.current) return true;
    saving.current = true;
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
      baseline.current = manualAccessDraftKey(next);
      await onSaved();
      setMessage(
        'دسترسی‌های دستی ذخیره شد. تغییرات از درخواست بعدی در سرور اعمال می‌شوند.',
      );
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
      return false;
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  useImperativeHandle(ref, () => ({ save }));
  if (!snapshot)
    return <p role="status">{message || 'در حال دریافت دسترسی‌های مؤثر…'}</p>;
  const selection = snapshot.selection;
  const match = (text: string) =>
    text
      .toLocaleLowerCase('fa')
      .includes(search.trim().toLocaleLowerCase('fa'));
  return (
    <section aria-label="مدیریت دستی دسترسی کاربر" className="grid gap-4">
      <UserRolePicker
        roles={templates}
        title={snapshot.title}
        disabled={!canManage || busy}
        onTitleChange={(title) => setSnapshot({ ...snapshot, title })}
        onRoleChange={(id) => {
          const role = templates.find((r) => r.id === id);
          if (!role) return;
          const codes = role.permissions.map((p) => p.permission.code);
          const replace = (
            current: string[],
            available: string[],
            wanted: string[],
          ) => [
            ...new Set([
              ...current.filter((id) => !available.includes(id)),
              ...wanted.filter((id) => available.includes(id)),
            ]),
          ];
          const native = options.permissions.map((p) => p.code);
          const screens = options.canAssignAll
            ? USER_ACCESS_SCREENS.map((s) => s.id)
            : options.assignableScreenIds;
          const controls = options.canAssignAll
            ? USER_ACCESS_DENY_CONTROLS.map((c) => c.id)
            : options.assignableControlIds;
          setSnapshot({
            ...snapshot,
            title: role.name,
            selection: completeManualAccessPrerequisites({
              permissionCodes: replace(
                selection.permissionCodes,
                native,
                role.selection?.permissionCodes ??
                  codes.filter((c) => !c.startsWith('ui.')),
              ),
              screenIds: replace(
                selection.screenIds,
                screens,
                role.selection?.screenIds ??
                  USER_ACCESS_SCREENS.filter((s) =>
                    codes.includes(screenPermission(s.id)),
                  ).map((s) => s.id),
              ),
              allowedControlIds: replace(
                selection.allowedControlIds,
                controls,
                role.selection?.allowedControlIds ??
                  USER_ACCESS_DENY_CONTROLS.filter(
                    (c) =>
                      !codes.includes(denyPermission(c.id)) &&
                      (c.kind === 'field' ||
                        c.id.startsWith('master-data.resource.') ||
                        codes.includes(screenPermission(c.id))),
                  ).map((c) => c.id),
              ),
            }),
          });
        }}
      />
      {message && <p role="status">{message}</p>}
      <Button
        type="button"
        onClick={() => void save()}
        disabled={!canManage || busy}
        loading={busy}
      >
        {busy ? 'در حال ذخیره…' : 'ذخیره دسترسی‌های دستی'}
      </Button>
      <Input
        aria-label="جست‌وجوی دسترسی دستی"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="نام بخش، عملیات یا فیلد"
      />
      <fieldset disabled={!canManage || busy} className="grid gap-3">
        {MANUAL_ACCESS_SECTIONS.map(([id, title]) => {
          const sectionMatch = match(title);
          const screens = USER_ACCESS_SCREENS.filter(
            (s) =>
              manualSectionForScreen(s) === id &&
              (sectionMatch || match(s.title)),
          );
          const permissions = options.permissions.filter(
            (p) =>
              p.code !== CALL_CENTER_SCOPED_ACCESS &&
              permissionInSection(p.code, id) &&
              (sectionMatch || match(permissionLabel(p, id))),
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
                label: permissionLabel(p, id),
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
          // Parent selection is deliberately independent of the search filter.
          const section = sectionAccess(id, options);
          const {
            screenIds: allScreens,
            permissionCodes: allPermissions,
            allowedControlIds: allControls,
          } = section;
          const total =
            allScreens.length + allPermissions.length + allControls.length;
          const count =
            allScreens.filter((x) => selection.screenIds.includes(x)).length +
            allPermissions.filter((x) => selection.permissionCodes.includes(x))
              .length +
            allControls.filter((x) => selection.allowedControlIds.includes(x))
              .length;
          function toggleSection(checked: boolean) {
            setSnapshot((current) => {
              if (!current) return current;
              return {
                ...current,
                selection: checked
                  ? completeManualAccessPrerequisites(
                      changeSectionAccess(current.selection, section, checked),
                      current.selection,
                    )
                  : changeSectionAccess(current.selection, section, checked),
              };
            });
          }
          return (
            <details
              key={id}
              className={styles.groupCard}
              open={search.trim() ? true : undefined}
            >
              <summary className="cursor-pointer p-4 font-bold">
                <input
                  type="checkbox"
                  aria-label={'انتخاب کل بخش ' + title}
                  checked={total > 0 && count === total}
                  aria-checked={
                    count > 0 && count < total ? 'mixed' : count === total
                  }
                  disabled={!total}
                  ref={(node) => {
                    if (node) node.indeterminate = count > 0 && count < total;
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => toggleSection(event.target.checked)}
                />{' '}
                {title}
              </summary>
              <div className="grid gap-4 p-4">
                {id === 'integrations' ? (
                  <p className="text-sm leading-7 text-muted-foreground">
                    ابتدا ورود به صفحه یکپارچه‌سازی‌ها و سپس بخش‌های موردنیاز را
                    تیک بزنید. مشاهده با ویرایش متفاوت است؛ برای ایجاد یا ویرایش
                    سایت، تنظیمات اتصال و دسترسی، مجوز مدیریت تنظیمات و ویرایش
                    فهرست را هم انتخاب کنید. محدودیت شعبه حفظ می‌شود. این تیک‌ها
                    ورود به پنل خارجی یا SSO را فعال نمی‌کنند.
                  </p>
                ) : null}
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
    </section>
  );
}
