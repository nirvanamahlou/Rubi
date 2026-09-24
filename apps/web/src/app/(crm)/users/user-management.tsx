'use client';

import { ShieldPlus, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';

interface Option {
  id: string;
  name: string;
}
interface PermissionOption extends Option {
  code: string;
}
interface UserRow {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  status: string;
  roles: Array<{ role: Option }>;
  branches: Array<{ branch: Option }>;
}
interface AccessOptions {
  roles: Option[];
  branches: Option[];
  permissions: PermissionOption[];
}

async function apiRequest(path: string, init?: RequestInit) {
  const api = getPublicApiBaseUrl();
  if (!api) throw new Error('API_NOT_CONFIGURED');
  return fetch(`${api}${path}`, { credentials: 'include', ...init });
}

function AccessEditor({
  branches,
  onChanged,
  roles,
  user,
}: {
  branches: Option[];
  onChanged: () => Promise<void>;
  roles: Option[];
  user: UserRow;
}) {
  const [roleId, setRoleId] = useState(user.roles[0]?.role.id ?? '');
  const [branchId, setBranchId] = useState(user.branches[0]?.branch.id ?? '');
  const [saving, setSaving] = useState(false);
  async function saveAccess() {
    setSaving(true);
    const response = await apiRequest(`/iam/users/${user.id}/access`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roleIds: roleId ? [roleId] : [],
        branchIds: branchId ? [branchId] : [],
      }),
    });
    if (response.ok) await onChanged();
    setSaving(false);
  }
  async function toggleStatus() {
    setSaving(true);
    const response = await apiRequest(`/iam/users/${user.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      }),
    });
    if (response.ok) await onChanged();
    setSaving(false);
  }
  return (
    <div className="grid min-w-56 gap-2">
      <Select onValueChange={setRoleId} value={roleId}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="نقش" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={setBranchId} value={branchId}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="شعبه" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button
          loading={saving}
          onClick={() => void saveAccess()}
          size="sm"
          type="button"
          variant="outline"
        >
          ثبت دسترسی
        </Button>
        <Button
          disabled={saving}
          onClick={() => void toggleStatus()}
          size="sm"
          type="button"
          variant={user.status === 'ACTIVE' ? 'destructive' : 'secondary'}
        >
          {user.status === 'ACTIVE' ? 'غیرفعال' : 'فعال‌سازی'}
        </Button>
      </div>
    </div>
  );
}

export function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [options, setOptions] = useState<AccessOptions>({
    roles: [],
    branches: [],
    permissions: [],
  });
  const [roleId, setRoleId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [userResponse, optionResponse] = await Promise.all([
      apiRequest('/iam/users'),
      apiRequest('/iam/access-options'),
    ]);
    if (userResponse.status === 401) {
      router.replace('/login');
      return;
    }
    if (userResponse.ok) setUsers((await userResponse.json()) as UserRow[]);
    if (optionResponse.ok) {
      const next = (await optionResponse.json()) as AccessOptions;
      setOptions(next);
      setRoleId((value) => value || next.roles[0]?.id || '');
      setBranchId((value) => value || next.branches[0]?.id || '');
    }
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await apiRequest('/iam/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: data.get('email'),
        username: data.get('username'),
        displayName: data.get('displayName'),
        password: data.get('password'),
        roleIds: roleId ? [roleId] : [],
        branchIds: branchId ? [branchId] : [],
      }),
    });
    setMessage(
      response.ok
        ? 'کاربر با موفقیت ساخته شد.'
        : 'ایجاد کاربر انجام نشد؛ ورودی و مجوز را بررسی کنید.',
    );
    if (response.ok) {
      event.currentTarget.reset();
      await load();
    }
  }

  async function createRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await apiRequest('/iam/access-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: data.get('code'),
        name: data.get('name'),
        permissionIds: selectedPermissions,
      }),
    });
    setMessage(
      response.ok
        ? 'نقش و مجوزهای آن ساخته شد.'
        : 'ایجاد نقش انجام نشد؛ کد و مجوزها را بررسی کنید.',
    );
    if (response.ok) {
      event.currentTarget.reset();
      setSelectedPermissions([]);
      await load();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_23rem]">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h1 className="text-xl font-black">کاربران، نقش‌ها و دسترسی‌ها</h1>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="p-3">کاربر</th>
                <th className="p-3">وضعیت</th>
                <th className="p-3">نقش‌ها</th>
                <th className="p-3">شعب</th>
                <th className="p-3">ویرایش دسترسی</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-b align-top last:border-0" key={user.id}>
                  <td className="p-3">
                    <strong className="block">{user.displayName}</strong>
                    <span className="block text-muted-foreground" dir="ltr">
                      @{user.username}
                    </span>
                    {user.email ? (
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {user.email}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {user.status === 'ACTIVE' ? 'فعال' : 'غیرفعال/قفل'}
                  </td>
                  <td className="p-3">
                    {user.roles.map(({ role }) => role.name).join('، ') || '—'}
                  </td>
                  <td className="p-3">
                    {user.branches
                      .map(({ branch }) => branch.name)
                      .join('، ') || '—'}
                  </td>
                  <td className="p-3">
                    <AccessEditor
                      branches={options.branches}
                      onChanged={load}
                      roles={options.roles}
                      user={user}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="grid content-start gap-6">
        <section className="rounded-2xl border bg-surface p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-black">
            <UserPlus className="size-5" />
            کاربر جدید
          </h2>
          <form className="mt-5 grid gap-4" onSubmit={createUser}>
            <FormField label="نام نمایشی">
              <Input name="displayName" required />
            </FormField>
            <FormField label="نام کاربری">
              <Input
                dir="ltr"
                minLength={3}
                name="username"
                pattern="[a-zA-Z0-9._-]+"
                required
              />
            </FormField>
            <FormField label="ایمیل (اختیاری)">
              <Input dir="ltr" name="email" type="email" />
            </FormField>
            <FormField
              description="حداقل ۱۰ نویسه شامل بزرگ، کوچک، رقم و نویسه ویژه"
              label="رمز اولیه"
            >
              <Input
                dir="ltr"
                minLength={10}
                name="password"
                required
                type="password"
              />
            </FormField>
            <FormField label="نقش">
              <Select onValueChange={setRoleId} value={roleId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="شعبه اصلی">
              <Select onValueChange={setBranchId} value={branchId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <Button type="submit">ایجاد کاربر</Button>
          </form>
        </section>
        <section className="rounded-2xl border bg-surface p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-black">
            <ShieldPlus className="size-5" />
            نقش جدید
          </h2>
          <form className="mt-5 grid gap-4" onSubmit={createRole}>
            <FormField label="نام نقش">
              <Input name="name" required />
            </FormField>
            <FormField
              description="فقط حروف کوچک لاتین، رقم و خط تیره"
              label="کد نقش"
            >
              <Input dir="ltr" name="code" pattern="[a-z0-9-]+" required />
            </FormField>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">مجوزها</legend>
              {options.permissions.map((permission) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={permission.id}
                >
                  <input
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={(event) =>
                      setSelectedPermissions((current) =>
                        event.target.checked
                          ? [...current, permission.id]
                          : current.filter((id) => id !== permission.id),
                      )
                    }
                    type="checkbox"
                  />
                  <span>{permission.name}</span>
                  <code className="ms-auto text-[10px] text-muted-foreground">
                    {permission.code}
                  </code>
                </label>
              ))}
            </fieldset>
            <Button type="submit">ایجاد نقش</Button>
          </form>
        </section>
        {message ? (
          <p
            aria-live="polite"
            className="rounded-xl border bg-surface p-3 text-sm"
          >
            {message}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
