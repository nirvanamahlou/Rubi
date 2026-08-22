'use client';

import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

interface UserRow {
  id: string;
  displayName: string;
  email: string;
  status: string;
  roles: Array<{ role: { name: string } }>;
  branches: Array<{ branch: { name: string } }>;
}
interface Option {
  id: string;
  name: string;
}

export function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [roleId, setRoleId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    const api = getPublicApiBaseUrl();
    if (!api) return;
    const [userResponse, optionResponse] = await Promise.all([
      fetch(`${api}/iam/users`, { credentials: 'include' }),
      fetch(`${api}/iam/access-options`, { credentials: 'include' }),
    ]);
    if (userResponse.status === 401) {
      router.replace('/login');
      return;
    }
    if (userResponse.ok) setUsers((await userResponse.json()) as UserRow[]);
    if (optionResponse.ok) {
      const options = (await optionResponse.json()) as {
        roles: Option[];
        branches: Option[];
      };
      setRoles(options.roles);
      setBranches(options.branches);
      setRoleId((value) => value || options.roles[0]?.id || '');
      setBranchId((value) => value || options.branches[0]?.id || '');
    }
  }
  useEffect(() => {
    const api = getPublicApiBaseUrl();
    if (!api) return;
    void Promise.all([
      fetch(`${api}/iam/users`, { credentials: 'include' }),
      fetch(`${api}/iam/access-options`, { credentials: 'include' }),
    ]).then(async ([userResponse, optionResponse]) => {
      if (userResponse.status === 401) {
        router.replace('/login');
        return;
      }
      if (userResponse.ok) setUsers((await userResponse.json()) as UserRow[]);
      if (optionResponse.ok) {
        const options = (await optionResponse.json()) as {
          roles: Option[];
          branches: Option[];
        };
        setRoles(options.roles);
        setBranches(options.branches);
        setRoleId(options.roles[0]?.id ?? '');
        setBranchId(options.branches[0]?.id ?? '');
      }
    });
  }, [router]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const api = getPublicApiBaseUrl();
    if (!api) return;
    const data = new FormData(event.currentTarget);
    const response = await fetch(`${api}/iam/users`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: data.get('email'),
        displayName: data.get('displayName'),
        password: data.get('password'),
        roleIds: roleId ? [roleId] : [],
        branchIds: branchId ? [branchId] : [],
      }),
    });
    setMessage(
      response.ok
        ? 'کاربر با موفقیت ساخته شد.'
        : 'ایجاد کاربر انجام نشد؛ ورودی و مجوز خود را بررسی کنید.',
    );
    if (response.ok) {
      event.currentTarget.reset();
      await load();
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h1 className="text-xl font-black">کاربران و دسترسی‌ها</h1>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="p-3">کاربر</th>
                <th className="p-3">وضعیت</th>
                <th className="p-3">نقش‌ها</th>
                <th className="p-3">شعب</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-b last:border-0" key={user.id}>
                  <td className="p-3">
                    <strong className="block">{user.displayName}</strong>
                    <span dir="ltr" className="text-muted-foreground">
                      {user.email}
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="rounded-2xl border bg-surface p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-black">
          <UserPlus className="size-5" />
          کاربر جدید
        </h2>
        <form className="mt-5 grid gap-4" onSubmit={create}>
          <FormField label="نام نمایشی">
            <Input name="displayName" required />
          </FormField>
          <FormField label="ایمیل">
            <Input dir="ltr" name="email" required type="email" />
          </FormField>
          <FormField
            description="حداقل ۱۲ نویسه شامل بزرگ، کوچک، رقم و نویسه ویژه"
            label="رمز اولیه"
          >
            <Input
              dir="ltr"
              minLength={12}
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
                {roles.map((role) => (
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
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <Button type="submit">ایجاد کاربر</Button>
          {message ? (
            <p aria-live="polite" className="text-sm">
              {message}
            </p>
          ) : null}
        </form>
      </aside>
    </div>
  );
}
