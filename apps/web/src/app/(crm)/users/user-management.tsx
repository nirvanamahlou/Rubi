'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MANUAL_ACCESS_SECTIONS,
  manualSectionForPermission,
  manualSectionForScreen,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  USER_JOB_TITLES,
  MASTER_DATA_RESOURCES,
  denyPermission,
  screenPermission,
  type AuthenticatedActor,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { AccessGroupCard } from './access-group-card';
import { ManualAccessEditor } from './manual-access-editor';
import styles from './user-management.module.css';

import { RoleAccessProposal } from './role-access-proposal';
import { UserPasswordReset } from './user-password-reset';
import { initialUserPasswordError } from './user-password-policy';
import { getMasterDataDefinition } from '@/modules/master-data/model/catalog';
import { settingsModules } from '@/modules/system-management/model/settings-catalog';
interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}
interface Option {
  id: string;
  name: string;
}
interface UserRow {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  status: string;
  accessRevision: string;
  roles: Array<{
    role: {
      id: string;
      name: string;
      code: string;
      isActive: boolean;
      permissions: Array<{ permission: { id: string; code: string } }>;
    };
  }>;
  branches: Array<{ branch: Option }>;
}
interface Options {
  permissions: Permission[];
  branches: Option[];
  assignableScreenIds: string[];
  assignableControlIds: string[];
  canAssignAll: boolean;
}
const customerFieldLabels: Record<string, string> = {
  kind: 'نوع مشتری',
  organizationId: 'سازمان',
  firstName: 'نام',
  lastName: 'نام خانوادگی',
  displayName: 'نام نمایشی',
  birthDate: 'تاریخ تولد',
  nationalId: 'کد ملی',
  passportNumber: 'شماره گذرنامه',
  passportExpiryDate: 'تاریخ انقضای گذرنامه',
  passportFirstName: 'نام لاتین',
  passportLastName: 'نام خانوادگی لاتین',
  gender: 'جنسیت',
  nationalityCode: 'ملیت',
  passportIssuingCountryCode: 'کشور صادرکننده گذرنامه',
  birthCountryCode: 'کشور محل تولد',
  roles: 'نقش‌های مشتری',
  acquaintanceMethodId: 'نحوه آشنایی',
};
function accessControlLabel(control: { id: string; title: string }) {
  if (control.id.startsWith('field.customers.')) {
    const field = control.id.slice('field.customers.'.length);
    return `مشتری · ${customerFieldLabels[field] ?? field}`;
  }
  if (control.id.startsWith('field.master-data.')) {
    const suffix = control.id.slice('field.master-data.'.length);
    const resource = MASTER_DATA_RESOURCES.find((item) =>
      suffix.startsWith(`${item}.`),
    );
    if (resource) {
      const field = suffix.slice(resource.length + 1);
      const definition = getMasterDataDefinition(resource);
      const fieldLabel = definition.fields.find(
        (item) => item.key === field,
      )?.label;
      return `${definition.label} · ${fieldLabel ?? field}`;
    }
  }
  if (control.id.startsWith('master-data.resource.')) {
    const resource = control.id.slice('master-data.resource.'.length);
    if (MASTER_DATA_RESOURCES.includes(resource as never))
      return `بخش اطلاعات پایه · ${getMasterDataDefinition(resource as never).label}`;
  }
  if (control.id.startsWith('field.system-settings.')) {
    const [namespace, key] = control.id
      .slice('field.system-settings.'.length)
      .split('.');
    const settingModule = settingsModules.find((item) => item.id === namespace);
    const group = settingModule?.groups.find((item) => item.id === key);
    return `${settingModule?.title ?? namespace} · ${group?.title ?? key} (ویرایش تنظیم)`;
  }
  if (control.id.startsWith('system.module.'))
    return `تنظیمات ${settingsModules.find((item) => item.id === control.id.slice('system.module.'.length))?.title ?? control.title}`;
  return control.title;
}
async function request(path: string, init?: RequestInit) {
  const base = getPublicApiBaseUrl();
  if (!base) throw Error('نشانی سرور تنظیم نشده است.');
  let response = await fetch(base + path, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await fetch(base + path, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
    });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw Error(
      Array.isArray(body?.message)
        ? body.message.join(' ')
        : typeof body?.message === 'string'
          ? body.message
          : typeof body?.error?.message === 'string'
            ? body.error.message
            : 'دریافت یا ذخیره اطلاعات انجام نشد.',
    );
  }
  return response.json();
}
function Check({
  checked,
  mixed = false,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={mixed ? 'mixed' : checked}
        ref={(node) => {
          if (node) node.indeterminate = mixed;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function UserManagement() {
  const [templateMode, setTemplateMode] = useState(false);
  const [templates, setTemplates] = useState<
    UserRow['roles'][number]['role'][]
  >([]);
  const [users, setUsers] = useState<UserRow[]>([]),
    [options, setOptions] = useState<Options>({
      permissions: [],
      branches: [],
      assignableScreenIds: [],
      assignableControlIds: [],
      canAssignAll: false,
    }),
    [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null),
    [search, setSearch] = useState(''),
    [title, setTitle] = useState<string>(''),
    [permissionIds, setPermissionIds] = useState<string[]>([]),
    [screenIds, setScreenIds] = useState<string[]>([]),
    [deniedControlIds, setDeniedControlIds] = useState<string[]>(
      USER_ACCESS_DENY_CONTROLS.map((c) => c.id),
    ),
    [branchIds, setBranchIds] = useState<string[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [accessControlSearch, setAccessControlSearch] = useState('');
  const accessGrid = useRef<HTMLDivElement>(null);
  function applyTemplate(nextTitle: string, rows = templates) {
    const codes =
      rows
        .find((r) => r.name === nextTitle)
        ?.permissions.map((p) => p.permission.code) ?? [];
    setPermissionIds(
      options.permissions
        .filter(
          (p) =>
            codes.includes(p.code) &&
            (options.canAssignAll ||
              actor?.permissions.includes(p.code as never)),
        )
        .map((p) => p.id),
    );
    setScreenIds(
      USER_ACCESS_SCREENS.filter(
        (s) =>
          codes.includes(screenPermission(s.id)) &&
          (options.canAssignAll || options.assignableScreenIds.includes(s.id)),
      ).map((s) => s.id),
    );
    setDeniedControlIds(
      USER_ACCESS_DENY_CONTROLS.filter(
        (c) =>
          !rows.some((r) => r.name === nextTitle) ||
          codes.includes(denyPermission(c.id)) ||
          (!options.canAssignAll &&
            !options.assignableControlIds.includes(c.id)),
      ).map((c) => c.id),
    );
    setProposalOpen(false);
  }
  const proposal = {
    screenIds,
    permissionIds,
    groups: [],
    permissions: options.permissions.filter((p) =>
      permissionIds.includes(p.id),
    ),
    reason: 'دسترسی‌های ذخیره‌شدهٔ نقش',
  };
  function applyProposal(customize: boolean) {
    setScreenIds(proposal.screenIds);
    setPermissionIds(proposal.permissionIds);
    setProposalOpen(false);
    setMessage(
      customize
        ? 'پیشنهاد اعمال شد؛ تیک‌های دلخواه را تغییر دهید و سپس ذخیره کنید.'
        : 'پیشنهاد در فرم اعمال شد؛ برای تغییر حساب کاربر، ذخیره را بزنید.',
    );
    if (customize) accessGrid.current?.focus();
  }
  const saving = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    try {
      const [rows, choices, access] = await Promise.all([
        request('/iam/users'),
        request('/iam/users/access-options'),
        request('/iam/auth/access'),
      ]);
      if (access.permissions.includes('iam.users.manage'))
        setTemplates(await request('/iam/access-options/templates'));
      setUsers(rows);
      setSelected((current) =>
        current
          ? (rows.find((row: UserRow) => row.id === current.id) ?? null)
          : null,
      );
      setOptions(choices);
      setActor(access);
      setMessage('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'اطلاعات دریافت نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const canManage = actor?.permissions.includes('iam.users.manage') ?? false;
  const selectedActiveRoles =
    selected?.roles.filter((item) => item.role.isActive) ?? [];
  const editingLegacy = Boolean(
    selected &&
    !selectedActiveRoles.some((item) =>
      item.role.permissions.some(
        ({ permission }) => permission.code === 'ui.profile',
      ),
    ),
  );
  const inheritedCodes = selectedActiveRoles
    .filter((item) => !item.role.code.startsWith('personal-access-'))
    .flatMap((item) =>
      item.role.permissions.map(({ permission }) => permission.code),
    );
  function edit(user: UserRow | null) {
    setTemplateMode(false);
    if (!user) setTitle('');
    setSelected(user);
    setProposalOpen(false);
    setMessage('');
    form.current?.reset();
    const roles =
      user?.roles.filter((r) => r.role.isActive).map((r) => r.role) ?? [];
    if (user)
      setTitle(
        USER_JOB_TITLES.includes(
          roles[0]?.name as (typeof USER_JOB_TITLES)[number],
        )
          ? roles[0]!.name
          : roles.some((role) => role.code === 'administrator')
            ? USER_JOB_TITLES[0]
            : USER_JOB_TITLES[1],
      );
    const codes = roles.flatMap((r) =>
      r.permissions.map((p) => p.permission.code),
    );
    setPermissionIds(
      roles.flatMap((r) =>
        r.permissions
          .filter((p) =>
            options.permissions.some((option) => option.id === p.permission.id),
          )
          .map((p) => p.permission.id),
      ),
    );
    setScreenIds(
      (user
        ? codes.includes('ui.profile')
          ? USER_ACCESS_SCREENS.filter((s) =>
              codes.includes(screenPermission(s.id)),
            ).map((s) => s.id)
          : USER_ACCESS_SCREENS.map((s) => s.id)
        : []
      ).filter((id) => options.assignableScreenIds.includes(id)),
    );
    setDeniedControlIds(
      USER_ACCESS_DENY_CONTROLS.filter(
        (control) => !user || codes.includes(denyPermission(control.id)),
      ).map((control) => control.id),
    );
    setBranchIds(user?.branches.map((b) => b.branch.id) ?? []);
    if (user && !codes.includes('ui.profile'))
      setMessage(
        'این حساب از نقش‌های مشترک/قدیمی استفاده می‌کند. مجوزهای مثبت فقط خواندنی‌اند؛ محدودیت صریح و شعبه را می‌توانید بدون تبدیل یا حذف عضویت نقش ذخیره کنید.',
      );
  }
  const change = (items: string[], ids: string[], checked: boolean) =>
    checked
      ? [...new Set([...items, ...ids])]
      : items.filter((id) => !ids.includes(id));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canManage) return;
    if (templateMode) {
      saving.current = true;
      setBusy(true);
      try {
        await request('/iam/access-options/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessTitle: title,
            permissionIds,
            screenIds,
            deniedControlIds,
          }),
        });
        setTemplates(await request('/iam/access-options/templates'));
        setMessage('دسترسی نقش ذخیره شد.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Save failed.');
      } finally {
        saving.current = false;
        setBusy(false);
      }
      return;
    }
    const fields = new FormData(event.currentTarget);
    if (!selected) {
      const passwordError = initialUserPasswordError(
        String(fields.get('password') ?? ''),
      );
      if (passwordError) {
        setMessage(passwordError);
        return;
      }
    }
    saving.current = true;
    setBusy(true);
    setMessage('');
    const originalBranchIds =
      selected?.branches.map((item) => item.branch.id).sort() ?? [];
    const branchesChanged =
      JSON.stringify([...branchIds].sort()) !==
      JSON.stringify(originalBranchIds);
    const access = selected
      ? {
          accessRevision: selected.accessRevision,
          ...(branchesChanged ? { branchIds } : {}),
        }
      : {
          accessTitle: title,
          permissionIds,
          screenIds,
          deniedControlIds,
          branchIds,
          roleIds: [],
        };
    try {
      await request(
        selected ? '/iam/users/' + selected.id + '/access' : '/iam/users',
        {
          method: selected ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            selected
              ? access
              : {
                  ...access,
                  manualAccessV3: true,
                  displayName: fields.get('displayName'),
                  username: fields.get('username'),
                  ...(fields.get('email')
                    ? { email: fields.get('email') }
                    : {}),
                  password: fields.get('password'),
                },
          ),
        },
      );
      await load();
      if (!selected) edit(null);
      setMessage(selected ? 'دسترسی کاربر ذخیره شد.' : 'کاربر ایجاد شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  async function status(user: UserRow) {
    if (saving.current || !canManage) return;
    saving.current = true;
    setBusy(true);
    try {
      await request('/iam/users/' + user.id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد.',
      );
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <h1 className="text-2xl font-black">مدیریت کاربران</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          تعریف حساب، نقش و دسترسی مستقل هر کاربر؛ تیک هر بخش همهٔ زیربخش‌ها را
          انتخاب می‌کند و می‌توانید هر مورد را جداگانه بردارید.
        </p>
      </header>
      {message && (
        <p role="alert" className="rounded-xl border p-3">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">در حال دریافت کاربران…</p>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.userList}>
            {options.canAssignAll && (
              <Button
                type="button"
                onClick={() => {
                  edit(null);
                  setTemplateMode(true);
                }}
              >
                تنظیم دسترسی نقش‌ها
              </Button>
            )}
            <Input
              aria-label="جست‌وجوی کاربران"
              placeholder="نام، نام کاربری یا نقش"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canManage && (
              <Button
                type="button"
                onClick={() => {
                  setTemplateMode(false);
                  edit(null);
                }}
              >
                تعریف کاربر جدید
              </Button>
            )}
            {users
              .filter((u) =>
                (
                  u.displayName +
                  ' ' +
                  u.username +
                  ' ' +
                  u.roles.map((r) => r.role.name).join(' ')
                ).includes(search),
              )
              .map((user) => (
                <div
                  key={user.id}
                  className={
                    styles.userCard +
                    ' ' +
                    (selected?.id === user.id ? styles.selectedUser : '')
                  }
                >
                  <button
                    type="button"
                    className={styles.userButton}
                    onClick={() => edit(user)}
                  >
                    <strong>{user.displayName}</strong>
                    <span className="block text-sm text-muted-foreground">
                      {user.roles.map((r) => r.role.name).join('، ') ||
                        'بدون نقش'}
                    </span>
                    <span dir="ltr" className="block text-xs">
                      {user.username}
                    </span>
                    <span className="text-xs">
                      {user.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                    </span>
                  </button>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={busy}
                      onClick={() => void status(user)}
                    >
                      {user.status === 'ACTIVE' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </Button>
                  )}
                </div>
              ))}
          </aside>
          <div className={styles.editor}>
            <form ref={form} onSubmit={save} className="grid gap-4">
              <h2 className={styles.editorTitle}>
                {selected
                  ? 'دسترسی ' + selected.displayName
                  : templateMode
                    ? 'تنظیم دسترسی نقش‌ها'
                    : 'تعریف کاربر جدید'}
              </h2>
              <fieldset disabled={!canManage || busy} className="grid gap-4">
                {!selected && !templateMode && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      نام و نام خانوادگی
                      <Input required minLength={2} name="displayName" />
                    </label>
                    <label>
                      نام کاربری
                      <Input
                        required
                        minLength={3}
                        pattern="[a-zA-Z0-9._\-]+"
                        dir="ltr"
                        name="username"
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      ایمیل (اختیاری)
                      <Input name="email" type="email" dir="ltr" />
                    </label>
                    <label>
                      رمز اولیه
                      <Input
                        name="password"
                        type="password"
                        minLength={4}
                        maxLength={200}
                        required
                        autoComplete="new-password"
                      />
                      <small>حداقل ۴ نویسه؛ رمز می‌تواند فقط عدد باشد.</small>
                    </label>
                  </div>
                )}
                {!selected && (
                  <label className="grid gap-2">
                    عنوان شغلی
                    <NativeSearchSelect
                      disabled={editingLegacy}
                      value={title}
                      optionLimit={USER_JOB_TITLES.length}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        applyTemplate(e.target.value);
                      }}
                      className={styles.roleSelect}
                    >
                      <option value="">انتخاب نقش</option>
                      {USER_JOB_TITLES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSearchSelect>
                  </label>
                )}
                {canManage &&
                  !selected &&
                  !editingLegacy &&
                  (proposalOpen ? (
                    <RoleAccessProposal
                      title={title}
                      proposal={proposal}
                      onApply={applyProposal}
                      onKeep={() => setProposalOpen(false)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setProposalOpen(true)}
                    >
                      نمایش پیشنهاد دسترسی این نقش
                    </Button>
                  ))}
                <fieldset className={styles.branches}>
                  <legend className="font-bold">شعب مجاز</legend>
                  {options.branches.map((branch) => (
                    <Check
                      key={branch.id}
                      label={branch.name}
                      checked={branchIds.includes(branch.id)}
                      onChange={(v) =>
                        setBranchIds(change(branchIds, [branch.id], v))
                      }
                    />
                  ))}
                </fieldset>
                {!selected && (
                  <>
                    <div className={styles.accessHeading}>
                      <strong>دسترسی به بخش‌های سامانه</strong>
                      <span>
                        تیک بخش را بزنید، سپس دسترسی زیربخش‌ها را تنظیم کنید.
                      </span>
                    </div>
                    <Input
                      aria-label="جست‌وجوی محدودیت‌های دسترسی"
                      onChange={(event) =>
                        setAccessControlSearch(event.target.value)
                      }
                      placeholder="جست‌وجوی بخش یا فیلد…"
                      value={accessControlSearch}
                    />
                    <div
                      ref={accessGrid}
                      tabIndex={-1}
                      aria-label="سفارشی‌سازی دسترسی‌ها"
                      className={styles.accessGrid}
                    >
                      {MANUAL_ACCESS_SECTIONS.map(([id, title]) => {
                        const group = { id, title };
                        const screens = USER_ACCESS_SCREENS.filter(
                          (s) => manualSectionForScreen(s) === group.id,
                        );
                        const controls = USER_ACCESS_DENY_CONTROLS.filter(
                          (control) =>
                            control.group === group.id &&
                            (control.kind === 'field' ||
                              control.id.startsWith('master-data.resource.')) &&
                            accessControlLabel(control)
                              .toLocaleLowerCase('fa')
                              .includes(
                                accessControlSearch
                                  .trim()
                                  .toLocaleLowerCase('fa'),
                              ),
                        );
                        const permissions = options.permissions.filter(
                          (p) =>
                            manualSectionForPermission(p.code) === group.id,
                        );
                        const allowedScreens = screens.filter((s) =>
                          options.assignableScreenIds.includes(s.id),
                        );
                        const total = allowedScreens.length;
                        const count = allowedScreens.filter((s) =>
                          screenIds.includes(s.id),
                        ).length;
                        return (
                          <AccessGroupCard
                            key={group.id}
                            id={group.id}
                            title={group.title}
                            count={count}
                            total={total}
                            onChange={(v) => {
                              if (editingLegacy) return;
                              setScreenIds(
                                change(
                                  screenIds,
                                  allowedScreens.map((s) => s.id),
                                  v,
                                ),
                              );
                              setDeniedControlIds(
                                change(
                                  deniedControlIds,
                                  allowedScreens
                                    .map((s) => s.id)
                                    .filter((id) =>
                                      USER_ACCESS_DENY_CONTROLS.some(
                                        (c) => c.id === id,
                                      ),
                                    ),
                                  !v,
                                ),
                              );
                            }}
                          >
                            <fieldset
                              className={styles.childSection}
                              disabled={editingLegacy}
                            >
                              <legend className="text-sm font-bold">
                                بخش‌های قابل مشاهده
                              </legend>
                              {screens.map((s) => (
                                <Check
                                  key={s.id}
                                  label={`${s.title}${inheritedCodes.includes(screenPermission(s.id)) ? ' — ارث‌رسیده از نقش' : ''}`}
                                  checked={screenIds.includes(s.id)}
                                  disabled={
                                    editingLegacy ||
                                    inheritedCodes.includes(
                                      screenPermission(s.id),
                                    ) ||
                                    !options.assignableScreenIds.includes(s.id)
                                  }
                                  onChange={(v) => {
                                    setScreenIds(change(screenIds, [s.id], v));
                                    if (
                                      USER_ACCESS_DENY_CONTROLS.some(
                                        (c) => c.id === s.id,
                                      )
                                    )
                                      setDeniedControlIds(
                                        change(deniedControlIds, [s.id], !v),
                                      );
                                  }}
                                />
                              ))}
                            </fieldset>
                            {controls.length ? (
                              <fieldset className={styles.childSection}>
                                <legend className="text-sm font-bold">
                                  ویرایش فیلدها و دسترسی کاتالوگ (پیش‌فرض:
                                  غیرفعال)
                                </legend>
                                {controls.map((control) => {
                                  const denied = deniedControlIds.includes(
                                    control.id,
                                  );
                                  return (
                                    <Check
                                      key={control.id}
                                      label={accessControlLabel(control)}
                                      checked={!denied}
                                      disabled={
                                        inheritedCodes.includes(
                                          denyPermission(control.id),
                                        ) ||
                                        !options.assignableControlIds.includes(
                                          control.id,
                                        )
                                      }
                                      onChange={(inherits) =>
                                        setDeniedControlIds(
                                          change(
                                            deniedControlIds,
                                            [control.id],
                                            !inherits,
                                          ),
                                        )
                                      }
                                    />
                                  );
                                })}
                              </fieldset>
                            ) : null}
                            <fieldset
                              className={styles.childSection}
                              disabled={editingLegacy}
                            >
                              <legend className="text-sm font-bold">
                                مجوزهای عملیات
                              </legend>
                              {permissions.map((p) => (
                                <Check
                                  key={p.id}
                                  label={`${p.name}${inheritedCodes.includes(p.code) ? ' — ارث‌رسیده از نقش' : ''}`}
                                  checked={permissionIds.includes(p.id)}
                                  disabled={
                                    editingLegacy ||
                                    inheritedCodes.includes(p.code) ||
                                    (!options.canAssignAll &&
                                      !actor?.permissions.some(
                                        (code) => code === p.code,
                                      ))
                                  }
                                  onChange={(v) =>
                                    setPermissionIds(
                                      change(permissionIds, [p.id], v),
                                    )
                                  }
                                />
                              ))}
                            </fieldset>
                          </AccessGroupCard>
                        );
                      })}
                    </div>
                  </>
                )}
                {selected && (
                  <ManualAccessEditor
                    key={selected.id}
                    userId={selected.id}
                    canManage={canManage}
                    options={options}
                    controlLabel={accessControlLabel}
                    request={request}
                    onSaved={load}
                  />
                )}
                {proposalOpen && !selected && !editingLegacy && (
                  <p className="text-sm text-muted-foreground">
                    ذخیره، تیک‌های فعلی شما را ثبت می‌کند؛ برای استفاده از
                    پیشنهاد نقش، ابتدا «تأیید و اعمال پیشنهاد» را بزنید.
                  </p>
                )}
                {canManage && (
                  <Button
                    type="submit"
                    disabled={busy || !title}
                    className={styles.saveButton}
                  >
                    {busy
                      ? 'در حال ذخیره…'
                      : selected
                        ? 'ذخیره شعبه‌های کاربر'
                        : templateMode
                          ? 'ذخیره دسترسی نقش'
                          : 'ساخت کاربر با تیک‌های انتخاب‌شده'}
                  </Button>
                )}
              </fieldset>
            </form>
            {selected &&
              canManage &&
              options.canAssignAll &&
              selected.id !== actor?.userId && (
                <UserPasswordReset
                  key={selected.id}
                  name={selected.displayName}
                  disabled={busy}
                  onReset={async (newPassword) => {
                    await request('/iam/users/' + selected.id + '/password', {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Nora-Password-Change': '1',
                      },
                      body: JSON.stringify({ newPassword }),
                    });
                  }}
                />
              )}
          </div>
        </div>
      )}
    </div>
  );
}
