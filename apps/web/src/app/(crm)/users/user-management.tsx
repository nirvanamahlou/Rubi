'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  USER_ACCESS_GROUPS,
  USER_ACCESS_SCREENS,
  USER_JOB_TITLES,
  screenPermission,
  canViewScreen,
  type AuthenticatedActor,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { AccessGroupCard } from './access-group-card';
import styles from './user-management.module.css';
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
      typeof body?.message === 'string'
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
  const [users, setUsers] = useState<UserRow[]>([]),
    [options, setOptions] = useState<Options>({
      permissions: [],
      branches: [],
    }),
    [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null),
    [search, setSearch] = useState(''),
    [title, setTitle] = useState<string>(USER_JOB_TITLES[1]),
    [permissionIds, setPermissionIds] = useState<string[]>([]),
    [screenIds, setScreenIds] = useState<string[]>([]),
    [branchIds, setBranchIds] = useState<string[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const saving = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    try {
      const [rows, choices, access] = await Promise.all([
        request('/iam/users'),
        request('/iam/users/access-options'),
        request('/iam/auth/access'),
      ]);
      setUsers(rows);
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
  function edit(user: UserRow | null) {
    setSelected(user);
    setMessage('');
    form.current?.reset();
    const roles =
      user?.roles.filter((r) => r.role.isActive).map((r) => r.role) ?? [];
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
      ).filter((id) => actor && canViewScreen(actor.permissions, id)),
    );
    setBranchIds(user?.branches.map((b) => b.branch.id) ?? []);
    if (user && !codes.includes('ui.profile'))
      setMessage(
        'این حساب از نقش قدیمی استفاده می‌کند؛ ذخیره، دسترسی آن را با انتخاب‌های این فرم جایگزین می‌کند. فقط مجوزهای قابل واگذاری شما انتخاب شده‌اند.',
      );
  }
  const change = (items: string[], ids: string[], checked: boolean) =>
    checked
      ? [...new Set([...items, ...ids])]
      : items.filter((id) => !ids.includes(id));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canManage) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    const fields = new FormData(event.currentTarget);
    const access = {
      accessTitle: title,
      permissionIds,
      screenIds,
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
            <Input
              aria-label="جست‌وجوی کاربران"
              placeholder="نام، نام کاربری یا نقش"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canManage && (
              <Button type="button" onClick={() => edit(null)}>
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
          <form ref={form} onSubmit={save} className={styles.editor}>
            <h2 className={styles.editorTitle}>
              {selected ? 'دسترسی ' + selected.displayName : 'تعریف کاربر جدید'}
            </h2>
            <fieldset disabled={!canManage || busy} className="grid gap-4">
              {!selected && (
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
                      pattern="[a-zA-Z0-9._-]+"
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
                      minLength={10}
                      required
                      autoComplete="new-password"
                    />
                    <small>
                      حداقل ۱۰ نویسه شامل حرف بزرگ، کوچک، رقم و علامت
                    </small>
                  </label>
                </div>
              )}
              <label className="grid gap-2">
                نقش کاربر
                <select
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={styles.roleSelect}
                >
                  {USER_JOB_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
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
              <div className={styles.accessHeading}>
                <strong>دسترسی به بخش‌های سامانه</strong>
                <span>
                  تیک بخش را بزنید، سپس دسترسی زیربخش‌ها را تنظیم کنید.
                </span>
              </div>
              <div className={styles.accessGrid}>
                {USER_ACCESS_GROUPS.map((group) => {
                  const screens = USER_ACCESS_SCREENS.filter(
                    (s) => s.group === group.id,
                  );
                  const permissions = options.permissions.filter((p) =>
                    group.prefixes.some(
                      (prefix) =>
                        p.code.startsWith(prefix + '.') ||
                        p.code.startsWith(prefix + '-'),
                    ),
                  );
                  const allowedScreens = screens.filter(
                    (s) => actor && canViewScreen(actor.permissions, s.id),
                  );
                  const allowedPermissions = permissions.filter((p) =>
                    actor?.permissions.some((code) => code === p.code),
                  );
                  const total =
                    allowedScreens.length + allowedPermissions.length;
                  const count =
                    allowedScreens.filter((s) => screenIds.includes(s.id))
                      .length +
                    allowedPermissions.filter((p) =>
                      permissionIds.includes(p.id),
                    ).length;
                  return (
                    <AccessGroupCard
                      key={group.id}
                      id={group.id}
                      title={group.title}
                      count={count}
                      total={total}
                      onChange={(v) => {
                        setScreenIds(
                          change(
                            screenIds,
                            allowedScreens.map((s) => s.id),
                            v,
                          ),
                        );
                        setPermissionIds(
                          change(
                            permissionIds,
                            allowedPermissions.map((p) => p.id),
                            v,
                          ),
                        );
                      }}
                    >
                      <fieldset className={styles.childSection}>
                        <legend className="text-sm font-bold">
                          بخش‌های قابل مشاهده
                        </legend>
                        {screens.map((s) => (
                          <Check
                            key={s.id}
                            label={s.title}
                            checked={screenIds.includes(s.id)}
                            disabled={
                              !actor || !canViewScreen(actor.permissions, s.id)
                            }
                            onChange={(v) =>
                              setScreenIds(change(screenIds, [s.id], v))
                            }
                          />
                        ))}
                      </fieldset>
                      <fieldset className={styles.childSection}>
                        <legend className="text-sm font-bold">
                          مجوزهای عملیات
                        </legend>
                        {permissions.map((p) => (
                          <Check
                            key={p.id}
                            label={p.name}
                            checked={permissionIds.includes(p.id)}
                            disabled={
                              !actor?.permissions.some(
                                (code) => code === p.code,
                              )
                            }
                            onChange={(v) =>
                              setPermissionIds(change(permissionIds, [p.id], v))
                            }
                          />
                        ))}
                      </fieldset>
                    </AccessGroupCard>
                  );
                })}
              </div>
              {canManage && (
                <Button
                  type="submit"
                  disabled={busy}
                  className={styles.saveButton}
                >
                  {busy ? 'در حال ذخیره…' : 'ذخیره کاربر و دسترسی‌ها'}
                </Button>
              )}
            </fieldset>
          </form>
        </div>
      )}
    </div>
  );
}
